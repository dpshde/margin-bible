# frozen_string_literal: true

module ReaderHelper
  def render_usj_chapter(nodes, **kwargs)
    Margin::UsjHtml.new(self, **kwargs).render(nodes)
  end
end
