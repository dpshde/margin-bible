# frozen_string_literal: true

class HomeController < ApplicationController
  def show
    if (passage = inbound_passage)
      redirect_to read_path(passage.slug)
      return
    end

    notes = current_library.notes.order(created_at: :desc)
    @sections = Margin::Inbox.sections(notes)
    @continue = current_library.continue_passage
  end
end
