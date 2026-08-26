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
    @pack_mirror = notes.filter_map { |note|
      next if note.empty_content?

      { slug: note.slug, blocks: note.blocks, bookmarked: note.bookmarked? }
    } if signed_in?
  end
end
