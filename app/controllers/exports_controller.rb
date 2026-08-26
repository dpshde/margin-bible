# frozen_string_literal: true

class ExportsController < ApplicationController
  def create
    scope = params[:scope].to_s
    include_notes = params[:notes].to_s != "0"
    book = params[:book].presence
    chapter = params[:chapter].presence
    passage = Margin::Passage.parse(params[:slug]) if params[:slug].present?

    book ||= passage&.book
    chapter ||= passage&.chapter
    verse_start = params[:verse_start].presence&.to_i || passage&.verse_start
    verse_end = params[:verse_end].presence&.to_i || passage&.span_end

    text = Margin::ShareText.document(
      scope: scope,
      book: book,
      chapter: chapter,
      verse_start: verse_start,
      verse_end: verse_end,
      notes: export_notes(include_notes),
      include_notes: include_notes,
      include_url: false
    )
    unless text
      head :unprocessable_entity
      return
    end

    send_data text,
      filename: Margin::ShareText.filename(scope:, book:, include_notes:),
      type: "text/markdown; charset=utf-8",
      disposition: "attachment"
  end

  private
    def export_notes(include_notes)
      return {} unless include_notes

      if params[:pack].present?
        JSON.parse(params[:pack])
      else
        current_library.notes.to_a
      end
    rescue JSON::ParserError
      {}
    end
end
