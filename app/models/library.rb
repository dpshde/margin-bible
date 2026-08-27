# frozen_string_literal: true

class Library < ApplicationRecord
  TRAIL_LIMIT = 3

  belongs_to :user, optional: true
  has_many :notes, dependent: :destroy
  has_many :magic_links, dependent: :destroy
  has_many :oauth_authorizations, dependent: :destroy
  has_many :oauth_access_tokens, dependent: :destroy


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

  def import_guest_pack!(pack)
    imported = 0
    guest_notes_from(pack).each do |slug, payload|
      imported += 1 if import_guest_note(slug, payload)
    end
    imported
  end

  private
    def assign_claim_token
      self.claim_token ||= SecureRandom.urlsafe_base64(16)
    end

    def guest_notes_from(pack)
      data = stringify_guest_hash(pack)
      return {} if data.blank?

      data["notes"].is_a?(Hash) ? data["notes"] : data
    end

    def import_guest_note(slug, payload)
      payload = stringify_guest_hash(payload)
      passage = Margin::Passage.parse(slug.to_s.presence || payload["slug"].to_s)
      return false unless passage
      return false if guest_blocks_empty?(payload["blocks"])

      note = notes.find_or_initialize_by(slug: passage.slug)
      return false if note.persisted? && !note.empty_content?

      note.assign_attributes(
        osis: passage.osis,
        kind: passage.kind,
        book: passage.book,
        chapter: passage.chapter,
        verse_start: passage.verse_start,
        verse_end: passage.verse_end
      )
      note.apply_blocks!(payload["blocks"])
      if payload.key?("bookmarked")
        note.bookmarked = ActiveModel::Type::Boolean.new.cast(payload["bookmarked"])
      end
      note.save!
      true
    end

    def stringify_guest_hash(value)
      case value
      when ActionController::Parameters then value.to_unsafe_h
      when Hash then value.deep_stringify_keys
      else {}
      end
    end

    def guest_blocks_empty?(blocks)
      Array(blocks).none? { |block|
        row = block.respond_to?(:to_unsafe_h) ? block.to_unsafe_h : block
        next false unless row.respond_to?(:[])

        row["text"].to_s.strip.present? || row[:text].to_s.strip.present?
      }
    end
end
