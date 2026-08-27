# frozen_string_literal: true

class Oauth::RevocationsController < ActionController::API
  include OauthHttp

  def create
    OauthAccessToken.revoke(params[:token])
    head :ok
  end
end
