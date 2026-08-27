# frozen_string_literal: true

require "test_helper"

class Oauth::TokensControllerTest < ActionDispatch::IntegrationTest
  test "dynamic client registration is public and PKCE-only" do
    post oauth_register_path, params: {
      client_name: "Cursor",
      redirect_uris: [ "http://127.0.0.1/callback" ]
    }, as: :json
    assert_response :created
    body = JSON.parse(response.body)
    assert body["client_id"].present?
    assert_equal "none", body["token_endpoint_auth_method"]
    refute body.key?("client_secret")
  end

  test "registration rejects a remote http redirect" do
    post oauth_register_path, params: {
      client_name: "Bad",
      redirect_uris: [ "http://evil.example/callback" ]
    }, as: :json
    assert_response :bad_request
  end

  test "token exchange rejects a wrong verifier and a spent code" do
    registration = register_oauth_client
    verifier, challenge = pkce_pair
    claim_library
    post oauth_authorize_path, params: {
      client_id: registration["client_id"],
      redirect_uri: "http://127.0.0.1/callback",
      scope: "notes:read",
      code_challenge: challenge,
      code_challenge_method: "S256"
    }
    code = Rack::Utils.parse_query(URI.parse(response.location).query)["code"]

    post oauth_token_path, params: {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: "http://127.0.0.1/callback",
      client_id: registration["client_id"],
      code_verifier: "wrong-verifier-value-that-is-long"
    }
    assert_response :bad_request
    assert_equal "invalid_grant", JSON.parse(response.body)["error"]

    post oauth_token_path, params: {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: "http://127.0.0.1/callback",
      client_id: registration["client_id"],
      code_verifier: verifier
    }
    assert_response :success

    post oauth_token_path, params: {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: "http://127.0.0.1/callback",
      client_id: registration["client_id"],
      code_verifier: verifier
    }
    assert_response :bad_request
  end

  test "revoking a token denies later MCP calls" do
    user = User.create!(email: "reader@example.com")
    library = Library.create!(user: user)
    token = issue_library_token(library, user: user)
    post oauth_revoke_path, params: { token: token }
    assert_response :ok
    mcp_json({ jsonrpc: "2.0", id: 1, method: "tools/list" }, token: token)
    assert_response :unauthorized
  end
end
