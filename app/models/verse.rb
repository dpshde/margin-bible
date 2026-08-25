# frozen_string_literal: true

class Verse < ApplicationRecord
  TRANSLATION = "BSB"

  validates :translation, :book, :chapter, :verse, :text, presence: true

  scope :bsb, -> { where(translation: TRANSLATION) }
  scope :in_chapter, ->(book, chapter) {
    bsb.where(book: book.to_s.upcase, chapter: chapter.to_i).order(:verse)
  }
end
