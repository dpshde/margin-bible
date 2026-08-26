# frozen_string_literal: true

module PasskeyRequest
  extend ActiveSupport::Concern

  included do
    before_action :set_webauthn_request
  end

  private
    def set_webauthn_request
      Current.webauthn_origin = request.base_url
      Current.webauthn_rp_id = request.host
    end

    def passkey_registration_params
      params.require(:passkey).permit(:id, :client_data_json, :attestation_object, transports: [])
    end

    def passkey_authentication_params
      params.require(:passkey).permit(:id, :client_data_json, :authenticator_data, :signature)
    end

    def passkey_registration_options(**options)
      Passkey.registration_options(**options)
    end

    def passkey_authentication_options(**options)
      Passkey.authentication_options(**options)
    end

    def store_webauthn_challenge(challenge)
      session[:webauthn_challenge] = challenge
    end

    def consume_webauthn_challenge
      session.delete(:webauthn_challenge)
    end

    def pending_passkey_holder
      session[:pending_webauthn_id] ||= WebAuthn.generate_user_id
      User.new(webauthn_id: session[:pending_webauthn_id])
    end

    def consume_pending_webauthn_id
      session.delete(:pending_webauthn_id).presence || WebAuthn.generate_user_id
    end
end
