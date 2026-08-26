# frozen_string_literal: true

class ReaderController < ApplicationController
  def show
    @passage = Margin::Passage.parse(params[:slug])
    unless @passage
      redirect_to read_path("jhn.1"), alert: "Couldn’t resolve that passage."
      return
    end

    @chapter = Margin::Passage.new(book: @passage.book, chapter: @passage.chapter)
    current_library.remember_read!(@passage.slug)
    @trail = current_library.trail_passages.reject { |passage| passage.slug == @passage.slug }

    @verses = Margin::Bsb.hydrate_chapter!(@chapter.book, @chapter.chapter)
    if @verses.empty?
      render :missing, status: :not_found
      return
    end
    @pericopes = Margin::Publication.pericopes(@verses)

    notes = current_library.notes_in_chapter(@chapter.book, @chapter.chapter)
    @chapter_note = notes.find { |note| note.kind == "chapter" || note.slug == @chapter.slug }
    @verse_notes = notes.reject { |note| note == @chapter_note }
    @notes_by_verse = @verses.to_h { |verse|
      [ verse.verse, @verse_notes.select { |note| note.covers_verse?(verse.verse) } ]
    }
    @focus_verse = @passage.span_end || @passage.verse_start
    @prev = @chapter.prev_chapter
    @next = @chapter.next_chapter
    @route_bible_url = Margin::RouteBible.url_for(@passage)
  end
end
