# frozen_string_literal: true

class GuestPacksController < ApplicationController
  include GuestPackImport

  rate_limit to: 10, within: 3.minutes, only: :create, with: -> { head :too_many_requests }

  def create
    imported = import_posted_guest_pack
    render json: { ok: true, imported: imported }
  end
end
