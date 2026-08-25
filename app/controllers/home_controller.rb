# frozen_string_literal: true

class HomeController < ApplicationController
  def show
    slug = current_library.last_read_slug.presence || "jhn.1"
    redirect_to read_path(slug)
  end
end
