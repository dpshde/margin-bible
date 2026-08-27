# frozen_string_literal: true

require "erb"
require "nokogiri"

module Margin
  # Renders a USJ chapter slice as publication HTML. Verses are milestones
  # with OSIS hooks; they are not paragraph containers.
  class UsjHtml
    include ERB::Util

    PARA = {
      "s1" => :s1,
      "s2" => :s2,
      "r" => :r,
      "p" => :p,
      "q1" => :q1,
      "q2" => :q2,
      "b" => :b,
      "pmo" => :p,
      "pm" => :p,
      "pmc" => :p,
      "m" => :p,
      "mi" => :p,
      "nb" => :p,
      "pi" => :p,
      "pc" => :p,
      "li1" => :p,
      "li2" => :p
    }.freeze
    SKIP = %w[h mt1 mt2 toc1 toc2 toc3].freeze

    def initialize(view, chapter:, notes_by_verse:, span_start:, span_end:, range_slug:, range_selected:, single_selected:, passage_label:, xref_selected: false)
      @view = view
      @chapter = chapter
      @notes_by_verse = notes_by_verse
      @span_start = span_start
      @span_end = span_end
      @range_slug = range_slug
      @range_selected = range_selected
      @single_selected = single_selected
      @passage_label = passage_label
      @xref_selected = xref_selected
      @buf = +""
      @current_verse = nil
      @verse_open = false
      @wj_depth = 0
      @seen = {}
      @section_index = 0
    end

    def render(nodes)
      Array(nodes).each { |node| render_block(node) }
      close_verse
      html = @buf
      attach_trays(html)
    end

    private

    def render_block(node)
      return unless node.is_a?(Hash)
      return unless node["type"] == "para"

      marker = node["marker"].to_s
      return if SKIP.include?(marker)

      kind = PARA[marker] || :p
      close_verse
      case marker
      when "s1"
        emit_heading("h2", "section-head", "s1", node["content"])
      when "s2"
        emit_heading("h3", "section-sub", "s2", node["content"])
      when "r"
        @buf << %(<p class="pub-r" data-usfm="r">)
        render_refs(unwrap_ref_nodes(node["content"]))
        @buf << "</p>"
      when "b"
        @buf << %(<div class="pub-b" data-usfm="b" aria-hidden="true"></div>)
      else
        @buf << %(<div class="pub-#{kind} pub-line" data-usfm="#{h(marker.presence || "p")}">)
        render_inline(node["content"])
        close_verse
        @buf << "</div>"
      end
    end

    def emit_heading(tag, css, marker, content)
      text = Margin::Usj.plain_text(content)
      return if text.blank?

      id = Margin::Usj.section_anchor(text, @section_index)
      @section_index += 1
      spaced = @seen.any? ? " spaced" : ""
      @buf << %(<#{tag} class="#{css}#{spaced}" id="#{h(id)}" data-usfm="#{marker}">#{h(text)}</#{tag}>)
    end

    def unwrap_ref_nodes(nodes)
      list = Array(nodes).map { |node|
        node.is_a?(String) ? Margin::Usj.unwrap_ref_parens(node) : node
      }
      list.shift if list.first.is_a?(String) && list.first.strip.empty?
      list.pop if list.last.is_a?(String) && list.last.strip.empty?
      list
    end

    def render_refs(nodes)
      Array(nodes).each do |node|
        case node
        when String
          emit_ref_string(node)
        when Hash
          if ref_node?(node)
            emit_ref_unit(Margin::Usj.plain_text(node["content"]), loc: node["loc"])
          else
            render_refs(node["content"])
          end
        end
      end
    end

    def ref_node?(node)
      node["type"] == "ref" || node["marker"].to_s == "ref"
    end

    def emit_ref_unit(text, loc: nil)
      return if text.blank?

      passage = Margin::Passage.parse_usj_loc(loc) || Margin::Passage.parse(text)
      if passage
        href = passage.kind == "chapter" ? @view.read_path(passage.slug) : @view.read_path(passage.slug, xref: 1)
        @buf << %(<a class="pub-ref" href="#{h(href)}">#{h(text)}</a>)
      else
        @buf << %(<span class="pub-ref">#{h(text)}</span>)
      end
    end

    # Separators stay breakable. BSB often writes ";" with no following
    # space; always emit "; " so citations do not glue together. A string
    # that is itself a citation (no USJ ref child) still becomes one nowrap
    # unit. Several citations in one string wrap only at the semicolon.
    def emit_ref_string(text)
      return if text.nil?

      if text.include?(";") && citation_string?(text)
        parts = text.split(/;\s*/)
        last = parts.size - 1
        parts.each_with_index do |part, i|
          emit_ref_or_punct(part)
          emit_ref_separator if i < last && citation_string?(part)
        end
      elsif citation_string?(text)
        emit_ref_or_punct(text)
      elsif text.include?(";")
        emit_ref_separator
      else
        @buf << h(text)
      end
    end

    def emit_ref_separator
      @buf << "; "
    end

    def emit_ref_or_punct(part)
      stripped = Margin::Usj.unwrap_ref_parens(part)
      if citation_string?(stripped)
        emit_ref_unit(stripped)
      elsif citation_string?(part)
        emit_ref_unit(part.strip)
      else
        @buf << h(part) unless part.to_s.strip.match?(/\A[()]\z/)
      end
    end

    def citation_string?(text)
      stripped = text.to_s.strip
      stripped.match?(/[A-Za-z].*\d/) && !stripped.match?(/\A[();,.\s]+\z/)
    end

    def render_inline(nodes, refs: false)
      Array(nodes).each do |node|
        case node
        when String
          emit_text(node)
        when Hash
          type = node["type"]
          marker = node["marker"].to_s
          if type == "verse"
            start_verse(node["number"].to_i)
          elsif type == "char" && marker == "wj"
            emit_wj(node["content"])
          elsif type == "note"
            next
          elsif type == "ref" || (type == "char" && marker == "ref")
            emit_text(Margin::Usj.plain_text(node["content"]))
          else
            render_inline(node["content"], refs:)
          end
        end
      end
    end

    def start_verse(n)
      close_verse
      @current_verse = n
      first = !@seen[n]
      @seen[n] = true
      slug = @chapter.verse_slug(n)
      classes = [ "verse" ]
      classes << "is-continuation" unless first
      covering = notes_for(n)
      classes << "has-note" if covering.any? && first
      trays_open = verse_trays_open?(n)
      classes << "is-open" if trays_open
      classes << "is-span" if in_span?(n) && !@xref_selected
      classes << "is-span-start" if @span_start && n == @span_start && in_span?(n) && !@xref_selected
      classes << "is-span-end" if @span_end && n == @span_end && in_span?(n) && !@xref_selected
      classes << "is-xref" if @xref_selected && in_span?(n)
      id = first ? %( id="v#{n}") : ""
      @buf << %(<span class="#{classes.join(" ")}"#{id} data-verse="#{n}" data-slug="#{h(slug)}">)
      @buf << %(<button type="button" class="verse-press" data-action="click->reader#openVerse">)
      @buf << %(<span class="vnum" data-usfm="v">#{n}</span>) if first
      @buf << %(<span class="vtext"><span class="vrun">)
      @verse_open = true
      emit_open_wj_spans
    end

    def close_verse
      return unless @verse_open

      emit_close_wj_spans
      @buf << "</span></span></button></span>"
      @verse_open = false
    end

    def emit_text(text)
      return if text.nil?
      return if text.to_s.strip.empty? && !@verse_open

      start_verse(@current_verse) if @current_verse && !@verse_open && text.to_s.strip.present?
      return unless @verse_open

      @buf << h(text)
    end

    def emit_wj(content)
      unless @verse_open
        start_verse(@current_verse) if @current_verse && !starts_with_verse_milestone?(content)
      end
      open_wj_tag
      render_inline(content)
      close_wj_tag
    end

    def starts_with_verse_milestone?(nodes)
      Array(nodes).each do |node|
        next if node.is_a?(String) && node.to_s.strip.empty?
        return node.is_a?(Hash) && node["type"] == "verse"
      end
      false
    end

    def emit_open_wj_spans
      @wj_depth.times { @buf << %(<span class="wj">) }
    end

    def emit_close_wj_spans
      @wj_depth.times { @buf << "</span>" }
    end

    def open_wj_tag
      @wj_depth += 1
      @buf << %(<span class="wj">) if @verse_open
    end

    def close_wj_tag
      return if @wj_depth.zero?

      @buf << "</span>" if @verse_open
      @wj_depth -= 1
    end

    def attach_trays(html)
      doc = Nokogiri::HTML.fragment(html)
      verse_numbers(doc).each do |n|
        hosts = doc.css(%([data-verse="#{n}"]))
        next if hosts.empty?

        trays = @view.render(
          partial: "reader/verse_trays",
          locals: verse_tray_locals(n)
        )
        hosts.last.add_child(trays) if trays.present?
      end
      restore_ref_separator_spaces(doc.to_html).html_safe
    end

    # HTML4 fragment serialization drops the trailing space in "; ".
    # Put it back only between citation units so verses are untouched.
    def restore_ref_separator_spaces(html)
      html.gsub(%r{(</(?:a|span)>);(<a |<span )}, '\1; \2')
    end

    def verse_numbers(doc)
      nums = doc.css("[data-verse]").map { |node| node["data-verse"].to_i }
      nums |= @notes_by_verse.keys.map(&:to_i)
      nums |= [ @span_start, @span_end ].compact.map(&:to_i)
      nums.uniq.sort
    end

    def verse_tray_locals(n)
      vslug = @chapter.verse_slug(n)
      covering = notes_for(n)
      exact = covering.find { |note| note.slug == vslug }
      range_note = @range_slug && covering.find { |note| note.slug == @range_slug }
      {
        verse_n: n,
        vslug:,
        covering:,
        exact:,
        range_note:,
        range_slug: @range_slug,
        trays_open: verse_trays_open?(n),
        is_end: @range_selected && n == @span_end,
        is_single_open: @single_selected && n == @span_start,
        passage_label: @passage_label
      }
    end

    def notes_for(n)
      @notes_by_verse[n] || @notes_by_verse[n.to_i] || []
    end

    def verse_trays_open?(n)
      (@single_selected && n == @span_start) || (@range_selected && n == @span_end)
    end

    def in_span?(n)
      @span_start && n >= @span_start && n <= @span_end
    end
  end
end
