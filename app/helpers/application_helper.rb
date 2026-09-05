# frozen_string_literal: true

module ApplicationHelper
  include IconHelper
  def route_bible_url(passage)
    Margin::RouteBible.url_for(passage)
  end

  def inbox_note_path(note)
    read_path(note.slug, Margin::Inbox.href_options(note))
  end

  def xref_read_path(passage)
    return read_path(passage.slug) if passage.kind == "chapter"

    read_path(passage.slug, xref: 1)
  end

  def wiki_note_html(text, links: true)
    html = ERB::Util.html_escape(text.to_s)
    placeholders = []
    stash = ->(fragment) {
      placeholders << fragment
      "\u0000#{placeholders.length - 1}\u0000"
    }
    html = html.gsub(/`([^`]+)`/) { stash.call("<code>#{Regexp.last_match(1)}</code>") }
    html = html.gsub(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/) {
      target = Regexp.last_match(1)
      label = Regexp.last_match(2).presence || target
      passage = Margin::Passage.parse(target)
      if passage && links
        stash.call(%(<a href="#{xref_read_path(passage)}" class="wiki">#{label}</a>))
      elsif passage
        stash.call(label)
      else
        "[[#{target}]]"
      end
    }
    if links
      html = splice_xref_hits(html) { |hit|
        stash.call(%(<a href="#{xref_read_path(hit[:passage])}" class="wiki">#{hit[:text]}</a>))
      }
    end
    html = apply_inline_md(html)
    html = html.gsub(/\u0000(\d+)\u0000/) { placeholders[Regexp.last_match(1).to_i] }
    html.html_safe
  end

  def note_attachment_chip(att)
    row = att.stringify_keys
    title = ERB::Util.html_escape(row["title"].presence || row["slug"] || row["url"])
    id = ERB::Util.html_escape(row["id"])
    source = ERB::Util.html_escape(row["source"].to_s)
    source_attr = source.present? ? %( data-att-source="#{source}") : ""
    if row["kind"] == "xref"
      passage = Margin::Passage.parse(row["slug"])
      return "".html_safe unless passage

      %(<li class="att-item"><a class="att-chip wiki" href="#{xref_read_path(passage)}" data-att-id="#{id}" data-att-kind="xref" data-att-slug="#{ERB::Util.html_escape(passage.slug)}" data-att-title="#{title}"#{source_attr}>#{title}</a><button type="button" class="att-remove" data-action="click->reader#removeAttachment" data-att-id="#{id}" aria-label="Remove attachment">#{ph_icon("x", size: 12)}</button></li>).html_safe
    elsif row["kind"] == "url"
      href = ERB::Util.html_escape(row["url"])
      %(<li class="att-item"><a class="att-chip att-url" href="#{href}" target="_blank" rel="noreferrer" data-att-id="#{id}" data-att-kind="url" data-att-url="#{href}" data-att-title="#{title}"#{source_attr}>#{title}</a><button type="button" class="att-remove" data-action="click->reader#removeAttachment" data-att-id="#{id}" aria-label="Remove attachment">#{ph_icon("x", size: 12)}</button></li>).html_safe
    else
      "".html_safe
    end
  end

  def path_line(paths)
    Array(paths).map { |path|
      row = path.respond_to?(:[]) ? path : {}
      kind = row[:kind] || row["kind"]
      text = row[:text] || row["text"]
      kind.to_s == "note" ? "your note — “#{text}”" : text
    }.join(" / ")
  end

  def wiki_outliner_html(text)
    String(text).split(/(\[\[[^\[\]]+\]\])/).map { |part|
      if (m = part.match(/\A\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\z/))
        target = m[1]
        passage = Margin::Passage.parse(target)
        if passage
          label = m[2].presence || passage.label
          raw = ERB::Util.html_escape(part)
          %(<a href="#{xref_read_path(passage)}" class="wiki" data-wiki-raw="#{raw}" contenteditable="false">#{ERB::Util.html_escape(label)}</a>)
        else
          ERB::Util.html_escape(part)
        end
      else
        outliner_text_with_xrefs(part)
      end
    }.join.html_safe
  end

  private

  def splice_xref_hits(text)
    hits = Margin::Passage.scan(text)
    return text if hits.empty?

    pieces = []
    cursor = 0
    hits.each do |hit|
      pieces << text[cursor...hit[:index]]
      pieces << yield(hit)
      cursor = hit[:index] + hit[:length]
    end
    pieces << text[cursor..]
    pieces.join
  end

  def outliner_text_with_xrefs(text)
    hits = Margin::Passage.scan(text)
    return inline_md_display_html(text) if hits.empty?

    html = +""
    cursor = 0
    hits.each do |hit|
      html << inline_md_display_html(text[cursor...hit[:index]]) if hit[:index] > cursor
      raw = ERB::Util.html_escape(hit[:text])
      html << %(<a href="#{xref_read_path(hit[:passage])}" class="wiki" data-wiki-raw="#{raw}" contenteditable="false">#{raw}</a>)
      cursor = hit[:index] + hit[:length]
    end
    html << inline_md_display_html(text[cursor..]) if cursor < text.length
    html
  end

  def apply_inline_md(html)
    html = html.gsub(/\*\*([\s\S]+?)\*\*/) { "<strong>#{Regexp.last_match(1)}</strong>" }
    html = html.gsub(/(?<!\*)\*(?!\*)([\s\S]+?)(?<!\*)\*(?!\*)/) { "<em>#{Regexp.last_match(1)}</em>" }
    html.gsub(/(?<![A-Za-z0-9&])_([^_\n]+?)_(?![A-Za-z0-9])/) { "<em>#{Regexp.last_match(1)}</em>" }
  end

  def inline_md_display_html(text)
    html = ERB::Util.html_escape(text.to_s)
    placeholders = []
    html = html.gsub(/`([^`]+)`/) {
      placeholders << "<code>#{Regexp.last_match(1)}</code>"
      "\u0000#{placeholders.length - 1}\u0000"
    }
    html = apply_inline_md(html)
    html = html.gsub(/\u0000(\d+)\u0000/) { placeholders[Regexp.last_match(1).to_i] }
    html.gsub("\n", "<br>")
  end
end
