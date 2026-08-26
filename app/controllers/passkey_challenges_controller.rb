# frozen_string_literal: true

class PasskeyChallengesController < ApplicationController
  include PasskeyRequest

  def create
    options =
      if params[:purpose] == "registration"
        passkey_registration_options(holder: current_user || pending_passkey_holder)
      else
        passkey_authentication_options
      end

    store_webauthn_challenge(options.challenge)
    render json: { challenge: options.challenge }
  end
end
