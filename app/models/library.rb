# frozen_string_literal: true

class Library < ApplicationRecord
  belongs_to :user, optional: true
  has_many :notes, dependent: :destroy
  has_many :magic_links, dependent: :destroy

  before_validation :assign_claim_token, on: :create

  validates :claim_token, presence: true, uniqueness: true

  def notes_in_chapter(book, chapter)
    notes.where(book: book.to_s.upcase, chapter: chapter.to_i)
  end

  private
    def assign_claim_token
      self.claim_token ||= SecureRandom.urlsafe_base64(16)
    end
end
