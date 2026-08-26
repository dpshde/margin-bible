# frozen_string_literal: true

class Sessions::PasskeysController < ApplicationController
  include PasskeyRequest

  rate_limit to: 10, within: 3.minutes, only: :create, with: -> {
    redirect_to new_session_path, alert: "Try again later."
  }

  def create
    if (credential = Passkey.authenticate(passkey_authentication_params, challenge: consume_webauthn_challenge))
      claim_library_for!(credential.user)
      redirect_to root_path, notice: "Welcome back. Your notes are on this library."
    else
      redirect_to new_session_path, alert: "That passkey didn't work. Try again."
    end
  end
end
