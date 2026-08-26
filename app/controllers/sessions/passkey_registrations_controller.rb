# frozen_string_literal: true

class Sessions::PasskeyRegistrationsController < ApplicationController
  include PasskeyRequest
  include GuestPackImport

  rate_limit to: 10, within: 3.minutes, only: :create, with: -> {
    redirect_to new_session_path, alert: "Try again later."
  }

  def create
    if signed_in?
      redirect_to passkeys_path
      return
    end

    user = nil
    User.transaction do
      user = User.create!(webauthn_id: consume_pending_webauthn_id)
      user.passkeys.register(passkey_registration_params, challenge: consume_webauthn_challenge)
    end
    claim_library_for!(user)
    import_posted_guest_pack
    redirect_to root_path, notice: "You're in. Your notes are on this library."
  rescue WebAuthn::Error, ActiveRecord::RecordInvalid, ArgumentError
    redirect_to new_session_path, alert: "Something went wrong while registering your passkey."
  end
end
