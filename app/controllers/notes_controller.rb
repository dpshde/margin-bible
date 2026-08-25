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
    note.apply_text!(params[:text].to_s)

    if note.empty_content?
      note.destroy if note.persisted?
      render json: { ok: true, deleted: true, slug: passage.slug }
      return
    end

    note.save!
    render json: { ok: true, slug: note.slug, updated_at: note.updated_at }
  end
end
