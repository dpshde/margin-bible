# frozen_string_literal: true

class Library < ApplicationRecord
  TRAIL_LIMIT = 3

  belongs_to :user, optional: true
  has_many :notes, dependent: :destroy
  has_many :magic_links, dependent: :destroy

  before_validation :assign_claim_token, on: :create

  validates :claim_token, presence: true, uniqueness: true

  def notes_in_chapter(book, chapter)
    notes.where(book: book.to_s.upcase, chapter: chapter.to_i)
  end

  def remember_read!(slug)
    passage = Margin::Passage.parse(slug)
    return unless passage

    key = passage.slug
    trail = Array(read_trail).map(&:to_s).reject(&:blank?)
    trail.delete(key)
    trail.unshift(key)
    update_columns(read_trail: trail.first(TRAIL_LIMIT), last_read_slug: key, updated_at: Time.current)
  end

  def trail_passages
    Array(read_trail).filter_map { |slug| Margin::Passage.parse(slug) }
  end

  def continue_passage
    trail_passages.first || Margin::Passage.parse(last_read_slug.to_s)
  end

  private
    def assign_claim_token
      self.claim_token ||= SecureRandom.urlsafe_base64(16)
    end
end
