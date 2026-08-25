# frozen_string_literal: true

module ApplicationHelper
  def route_bible_url(passage)
    Margin::RouteBible.url_for(passage)
  end

  def wiki_note_html(text)
    html = ERB::Util.html_escape(text.to_s)
    html.gsub(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/) do
      target = Regexp.last_match(1)
      label = Regexp.last_match(2).presence || target
      passage = Margin::Passage.parse(target)
      if passage
        %(<a href="#{read_path(passage.slug)}" class="wiki">#{ERB::Util.html_escape(label)}</a>)
      else
        ERB::Util.html_escape("[[#{target}]]")
      end
    end.html_safe
  end
end
