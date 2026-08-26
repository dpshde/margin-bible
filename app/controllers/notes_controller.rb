# frozen_string_literal: true

class NotesController < ApplicationController
  def upsert
    passage = Margin::Passage.parse(params[:slug])
    unless passage
      render json: { ok: false, error: "unresolvable" }, status: :unprocessable_entity
      return
    end

    note = current_library.notes.find_or_initialize_by(slug: passage.slug)
    note.assign_attributes(
      osis: passage.osis,
      kind: passage.kind,
      book: passage.book,
      chapter: passage.chapter,
      verse_start: passage.verse_start,
      verse_end: passage.verse_end
    )
    apply_note_content!(note)
    if params.key?(:bookmarked)
      note.bookmarked = ActiveModel::Type::Boolean.new.cast(params[:bookmarked])
    end

    if note.empty_content?
      note.destroy if note.persisted?
      render json: { ok: true, deleted: true, slug: passage.slug }
      return
    end

    note.save!
    render json: { ok: true, slug: note.slug, updated_at: note.updated_at, bookmarked: note.bookmarked? }
  end

  private
    def apply_note_content!(note)
      incoming = parsed_blocks
      if incoming
        note.apply_blocks!(incoming)
      else
        note.apply_text!(params[:text].to_s)
      end
    end

    def parsed_blocks
      raw = params[:blocks]
      return nil if raw.blank?

      data = raw.is_a?(String) ? JSON.parse(raw) : raw
      data.is_a?(Array) ? data : nil
    rescue JSON::ParserError
      nil
    end
end
