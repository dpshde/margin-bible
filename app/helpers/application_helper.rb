# frozen_string_literal: true

module ApplicationHelper
  def route_bible_url(passage)
    Margin::RouteBible.url_for(passage)
  end

  def inbox_note_path(note)
    read_path(note.slug, Margin::Inbox.href_options(note))
  end

  def wiki_note_html(text, links: true)
    html = ERB::Util.html_escape(text.to_s)
    placeholders = []
    html = html.gsub(/`([^`]+)`/) {
      placeholders << "<code>#{Regexp.last_match(1)}</code>"
      "\u0000#{placeholders.length - 1}\u0000"
    }
    html = html.gsub(/\*\*([\s\S]+?)\*\*/) { "<strong>#{Regexp.last_match(1)}</strong>" }
    html = html.gsub(/(?<!\*)\*(?!\*)([\s\S]+?)(?<!\*)\*(?!\*)/) { "<em>#{Regexp.last_match(1)}</em>" }
    html = html.gsub(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/) {
      target = Regexp.last_match(1)
      label = Regexp.last_match(2).presence || target
      passage = Margin::Passage.parse(target)
      if links && passage
        %(<a href="#{read_path(passage.slug)}" class="wiki">#{label}</a>)
      else
        label
      end
    }
    html = html.gsub(/\u0000(\d+)\u0000/) { placeholders[Regexp.last_match(1).to_i] }
    html.html_safe
  end
end
