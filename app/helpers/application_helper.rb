# frozen_string_literal: true

module ApplicationHelper
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
    html = html.gsub(/`([^`]+)`/) {
      placeholders << "<code>#{Regexp.last_match(1)}</code>"
      "\u0000#{placeholders.length - 1}\u0000"
    }
    html = apply_inline_md(html)
    html = html.gsub(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/) {
      target = Regexp.last_match(1)
      label = Regexp.last_match(2).presence || target
      passage = Margin::Passage.parse(target)
      if passage && links
        %(<a href="#{xref_read_path(passage)}" class="wiki">#{label}</a>)
      elsif passage
        label
      else
        "[[#{target}]]"
      end
    }
    html = html.gsub(/\u0000(\d+)\u0000/) { placeholders[Regexp.last_match(1).to_i] }
    html.html_safe
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
        inline_md_display_html(part)
      end
    }.join.html_safe
  end

  private

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
