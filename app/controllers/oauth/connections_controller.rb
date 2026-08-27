# frozen_string_literal: true

class Oauth::ConnectionsController < ApplicationController
  before_action :require_signed_in

  def index
    @tokens = current_library.oauth_access_tokens.live.includes(:oauth_client).order(created_at: :desc)
  end

  def destroy
    token = current_library.oauth_access_tokens.find(params[:id])
    token.revoke!
    redirect_to oauth_connections_path, notice: "That agent can no longer read your notes."
  end
end
