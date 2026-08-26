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
      "r" => :r,
      "p" => :p,
      "q1" => :q1,
      "q2" => :q2,
      "b" => :b
    }.freeze

    def initialize(view, chapter:, notes_by_verse:, span_start:, span_end:, range_slug:, range_selected:, single_selected:, passage_label:)
      @view = view
      @chapter = chapter
      @notes_by_verse = notes_by_verse
      @span_start = span_start
      @span_end = span_end
      @range_slug = range_slug
      @range_selected = range_selected
      @single_selected = single_selected
      @passage_label = passage_label
      @buf = +""
      @current_verse = nil
      @verse_open = false
      @wj_depth = 0
      @seen = {}
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

      marker = node["marker"].to_s
      kind = PARA[marker]
      return unless node["type"] == "para" && kind

      close_verse
      case kind
      when :s1
        text = Margin::Usj.plain_text(node["content"])
        return if text.blank?

        @buf << %(<h2 class="section-head#{' spaced' if @seen.any?}" data-usfm="s1">#{h(text)}</h2>)
      when :r
        @buf << %(<p class="pub-r" data-usfm="r">)
        render_refs(node["content"])
        @buf << "</p>"
      when :b
        @buf << %(<div class="pub-b" data-usfm="b" aria-hidden="true"></div>)
      else
        @buf << %(<div class="pub-#{kind} pub-line" data-usfm="#{kind}">)
        render_inline(node["content"])
        close_verse
        @buf << "</div>"
      end
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
        @buf << %(<a class="pub-ref" href="#{h(@view.read_path(passage.slug))}">#{h(text)}</a>)
      else
        @buf << %(<span class="pub-ref">#{h(text)}</span>)
      end
    end

    # Separators ("; ") stay breakable. A string that is itself a citation
    # (no USJ ref child) still becomes one nowrap unit. Several citations in
    # one string wrap only at the semicolon.
    def emit_ref_string(text)
      return if text.nil?

      if text.include?(";") && citation_string?(text)
        text.split(/(; )/).each { |part| emit_ref_or_punct(part) }
      elsif citation_string?(text)
        emit_ref_or_punct(text)
      else
        @buf << h(text)
      end
    end

    def emit_ref_or_punct(part)
      match = part.match(/\A(\(*)(.*?)(\)*)\z/)
      if match && citation_string?(match[2])
        @buf << h(match[1]) if match[1].present?
        emit_ref_unit(match[2].strip)
        @buf << h(match[3]) if match[3].present?
      elsif citation_string?(part)
        emit_ref_unit(part.strip)
      else
        @buf << h(part)
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
            emit_wj { render_inline(node["content"]) }
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
      depth = @wj_depth
      depth.times { close_wj_tag }
      close_verse
      depth.times { open_wj_tag }
      @current_verse = n
      first = !@seen[n]
      @seen[n] = true
      slug = @chapter.verse_slug(n)
      classes = [ "verse" ]
      covering = notes_for(n)
      classes << "has-note" if covering.any?
      trays_open = verse_trays_open?(n)
      classes << "is-open" if trays_open
      classes << "is-span" if in_span?(n)
      classes << "is-span-start" if @span_start && n == @span_start && in_span?(n)
      classes << "is-span-end" if @span_end && n == @span_end && in_span?(n)
      id = first ? %( id="v#{n}") : ""
      @buf << %(<span class="#{classes.join(" ")}"#{id} data-verse="#{n}" data-slug="#{h(slug)}">)
      @buf << %(<button type="button" class="verse-press" data-action="click->reader#openVerse">)
      @buf << %(<span class="vnum" data-usfm="v">#{n}</span>) if first
      @buf << %(<span class="vtext">)
      @verse_open = true
    end

    def close_verse
      return unless @verse_open

      @buf << "</span></button></span>"
      @verse_open = false
    end

    def emit_text(text)
      return if text.nil?
      return if text.to_s.strip.empty? && !@verse_open

      start_verse(@current_verse) if @current_verse && !@verse_open && text.to_s.strip.present?
      return unless @verse_open

      @buf << h(text)
    end

    def emit_wj
      start_verse(@current_verse) if @current_verse && !@verse_open
      open_wj_tag
      yield
      close_wj_tag
    end

    def open_wj_tag
      @buf << %(<span class="wj">)
      @wj_depth += 1
    end

    def close_wj_tag
      return if @wj_depth.zero?

      @buf << "</span>"
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
      doc.to_html.html_safe
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
