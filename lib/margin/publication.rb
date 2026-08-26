# frozen_string_literal: true

module Margin
  # Focus/publication rendering is the official BSB USJ stream (`Margin::Usj`).
  # Do not approximate paragraphs by stuffing verses under a heading.
  module Publication
    module_function

    def chapter_nodes(book, chapter)
      Usj.chapter_nodes(book, chapter)
    end
  end
end
