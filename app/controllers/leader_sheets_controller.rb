# frozen_string_literal: true

class LeaderSheetsController < ApplicationController
  def show
    @passage = Margin::Passage.parse(params[:osis])
    unless @passage
      render plain: "Couldn’t resolve #{params[:osis].inspect} to a passage.", status: :not_found
      return
    end

    @using_samples = params[:library].blank? && Margin::LeaderSheetDemo.using_samples?(@passage)
    notes = if @using_samples
      Margin::LeaderSheetDemo.notes_for(@passage)
    else
      current_library.notes.where(book: @passage.book, chapter: @passage.chapter).order(:verse_start, :id)
    end
    @payload = Margin::StudyPrep.build(passage: @passage, notes: notes, kind: :group)
  end
end
