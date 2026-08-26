# frozen_string_literal: true

require "test_helper"

class PasskeyTest < ActiveSupport::TestCase
  setup do
    setup_webauthn_request
    @user = User.create!(email: "reader@example.com")
  end

  test "register then authenticate a discoverable passkey" do
    options = Passkey.registration_options(holder: @user)
    raw = webauthn_client.create(challenge: options.challenge)
    passkey = Passkey.register(registration_params(raw), holder: @user, challenge: options.challenge)

    assert_equal @user, passkey.user
    assert passkey.external_id.present?
    assert passkey.public_key.present?

    assertion_options = Passkey.authentication_options
    assertion = webauthn_client.get(challenge: assertion_options.challenge)
    authenticated = Passkey.authenticate(authentication_params(assertion), challenge: assertion_options.challenge)

    assert_equal passkey, authenticated
    assert_operator authenticated.sign_count, :>=, 0
  end

  test "authenticate returns nil for a missing credential" do
    options = Passkey.authentication_options
    other = WebAuthn::FakeClient.new(WEBAUTHN_ORIGIN)
    other.create(challenge: Passkey.registration_options(holder: @user).challenge)
    assertion = other.get(challenge: options.challenge)

    assert_nil Passkey.authenticate(authentication_params(assertion), challenge: options.challenge)
  end

  private
    def registration_params(raw)
      {
        id: raw["id"],
        client_data_json: raw.dig("response", "clientDataJSON"),
        attestation_object: raw.dig("response", "attestationObject"),
        transports: raw.dig("response", "transports")
      }
    end

    def authentication_params(raw)
      {
        id: raw["id"],
        client_data_json: raw.dig("response", "clientDataJSON"),
        authenticator_data: raw.dig("response", "authenticatorData"),
        signature: raw.dig("response", "signature")
      }
    end
end
