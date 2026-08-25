# frozen_string_literal: true

class ReaderController < ApplicationController
  def show
    @passage = Margin::Passage.parse(params[:slug])
    unless @passage
      redirect_to read_path("jhn.1"), alert: "Couldn’t resolve that passage."
      return
    end

    @chapter = Margin::Passage.new(book: @passage.book, chapter: @passage.chapter)
    current_library.update_column(:last_read_slug, @chapter.slug)

    @verses = Verse.in_chapter(@chapter.book, @chapter.chapter)
    if @verses.empty?
      render :missing, status: :not_found
      return
    end

    notes = current_library.notes_in_chapter(@chapter.book, @chapter.chapter)
    @notes_by_slug = notes.index_by(&:slug)
    @chapter_note = @notes_by_slug[@chapter.slug]
    @focus_verse = @passage.focus_verse
    @prev = @chapter.prev_chapter
    @next = @chapter.next_chapter
    @route_bible_url = Margin::RouteBible.url_for(@passage)
  end
end
