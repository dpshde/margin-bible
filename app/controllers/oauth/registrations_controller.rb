# frozen_string_literal: true

class Oauth::RegistrationsController < ActionController::API
  include OauthHttp
  wrap_parameters false

  rate_limit to: 20, within: 1.minute, only: :create, with: -> { json_error("access_denied", "Try again later.", status: :too_many_requests) }

  def create
    client = OauthClient.register(registration_params)
    if client.persisted?
      render json: client.as_registration, status: :created
    else
      json_error("invalid_client_metadata", client.errors.full_messages.to_sentence)
    end
  end

  private
    def registration_params
      raw = params.permit(:client_name, :token_endpoint_auth_method, redirect_uris: []).to_h
      if raw["redirect_uris"].blank? && params[:redirect_uris].is_a?(Array)
        raw["redirect_uris"] = params[:redirect_uris]
      end
      raw
    end
end
