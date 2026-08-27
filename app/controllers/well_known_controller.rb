# frozen_string_literal: true

class WellKnownController < ActionController::API
  include OauthHttp

  def oauth_protected_resource
    render json: Margin::Oauth.protected_resource_metadata(request)
  end

  def oauth_authorization_server
    render json: Margin::Oauth.authorization_server_metadata(request)
  end
end
