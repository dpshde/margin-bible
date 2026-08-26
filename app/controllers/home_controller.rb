# frozen_string_literal: true

class HomeController < ApplicationController
  def show
    notes = current_library.notes.order(created_at: :desc)
    @sections = Margin::Inbox.sections(notes)
    @continue = Margin::Passage.parse(current_library.last_read_slug.to_s)
  end
end
