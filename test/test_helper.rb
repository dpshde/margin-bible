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

    def create_note!(library, slug, text)
      passage = Margin::Passage.parse!(slug)
      library.notes.create!(
        slug: passage.slug,
        osis: passage.osis,
        kind: passage.kind,
        book: passage.book,
        chapter: passage.chapter,
        verse_start: passage.verse_start,
        verse_end: passage.verse_end,
        blocks: Note.blocks_from_text(text)
      )
    end

    def issue_library_token(library, user: library.user, name: "Test Agent")
      client = OauthClient.create!(
        uid: SecureRandom.uuid,
        name: name,
        redirect_uris: [ "http://127.0.0.1/callback" ]
      )
      _record, access, _refresh = OauthAccessToken.issue!(
        client: client,
        library: library,
        user: user,
        scopes: Margin::Oauth::READ_SCOPE
      )
      access
    end
  end
end

class ActionDispatch::IntegrationTest
  def claim_as(user)
    get root_path
    Library.last.update!(user: user)
  end

  def claim_library(email: "reader@example.com")
    get root_path
    post session_path, params: { email: email }
    get magic_login_path(MagicLink.last.token)
    [ User.find_by!(email: email), Library.last ]
  end

  def register_oauth_client(name: "Test Agent", redirect_uri: "http://127.0.0.1/callback")
    post oauth_register_path, params: { client_name: name, redirect_uris: [ redirect_uri ] }, as: :json
    assert_response :created
    JSON.parse(response.body)
  end

  def pkce_pair
    verifier = SecureRandom.urlsafe_base64(32)
    [ verifier, Margin::Oauth.pkce_challenge(verifier) ]
  end

  def mcp_json(body, token: nil)
    headers = { "Accept" => "application/json" }
    headers["Authorization"] = "Bearer #{token}" if token
    post mcp_path, params: body, as: :json, headers: headers
  end

  def mcp_result
    JSON.parse(response.body)
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
