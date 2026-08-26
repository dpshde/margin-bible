ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "webauthn/fake_client"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Fixtures are not used; models create their own records.

    WEBAUTHN_ORIGIN = "http://www.example.com"

    def setup_webauthn_request(origin: WEBAUTHN_ORIGIN)
      Current.webauthn_origin = origin
      Current.webauthn_rp_id = URI.parse(origin).host
    end

    def webauthn_client(origin: WEBAUTHN_ORIGIN)
      @webauthn_clients ||= {}
      @webauthn_clients[origin] ||= WebAuthn::FakeClient.new(origin)
    end
  end
end

class ActionDispatch::IntegrationTest
  def claim_as(user)
    get root_path
    Library.last.update!(user: user)
  end

  def refresh_webauthn_challenge(purpose: "authentication")
    post passkey_challenge_path, params: { purpose: purpose }
    assert_response :success
    JSON.parse(response.body).fetch("challenge")
  end

  def passkey_registration_params_from(raw)
    {
      passkey: {
        id: raw["id"],
        client_data_json: raw.dig("response", "clientDataJSON"),
        attestation_object: raw.dig("response", "attestationObject"),
        transports: raw.dig("response", "transports") || [ "internal" ]
      }
    }
  end

  def passkey_authentication_params_from(raw)
    {
      passkey: {
        id: raw["id"],
        client_data_json: raw.dig("response", "clientDataJSON"),
        authenticator_data: raw.dig("response", "authenticatorData"),
        signature: raw.dig("response", "signature")
      }
    }
  end
end

