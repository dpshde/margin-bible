# frozen_string_literal: true

require "test_helper"

class Oauth::AuthorizationsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @registration = register_oauth_client
    @verifier, @challenge = pkce_pair
    @authorize_params = {
      client_id: @registration["client_id"],
      redirect_uri: "http://127.0.0.1/callback",
      response_type: "code",
      scope: "notes:read",
      state: "abc123",
      code_challenge: @challenge,
      code_challenge_method: "S256"
    }
  end

  test "consent requires a signed-in library and names the agent" do
    get oauth_authorize_path, params: @authorize_params
    assert_redirected_to new_session_path
    follow_redirect!
    assert_select ".flash-alert", /sign in/i

    claim_library
    get oauth_authorize_path, params: @authorize_params
    assert_response :success
    assert_select "h1", /Test Agent/
    assert_select "p.lede", /cannot write/i
    assert_select ".grant-actions" do
      assert_select "button.primary", "Allow read access"
      assert_select "button.secondary", "Deny"
      assert_select %(form[action="#{oauth_authorize_path}"][data-turbo="false"])
      assert_select %(form[action="#{oauth_deny_path}"][data-turbo="false"])
    end
  end

  test "allowing consent issues a code bound to the signed-in library" do
    user, library = claim_library
    create_note!(library, "jhn.1.1", "In the beginning.")
    post oauth_authorize_path, params: @authorize_params
    assert_response :redirect
    location = URI.parse(response.location)
    assert_equal "127.0.0.1", location.host
    query = Rack::Utils.parse_query(location.query)
    assert query["code"].present?
    assert_equal "abc123", query["state"]

    post oauth_token_path, params: {
      grant_type: "authorization_code",
      code: query["code"],
      redirect_uri: "http://127.0.0.1/callback",
      client_id: @registration["client_id"],
      code_verifier: @verifier
    }
    assert_response :success
    token = JSON.parse(response.body)
    assert_equal "Bearer", token["token_type"]
    assert_equal "notes:read", token["scope"]
    assert token["access_token"].start_with?("mb_")

    mcp_json({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "list_notes", arguments: {} }
    }, token: token["access_token"])
    notes = mcp_result.dig("result", "structuredContent", "notes")
    assert_equal [ "jhn.1.1" ], notes.map { |note| note["slug"] }
    assert_equal user, OauthAccessToken.authenticate(token["access_token"]).user
    assert_equal library, OauthAccessToken.authenticate(token["access_token"]).library
  end

  test "deny sends the agent back without a code" do
    claim_library
    post oauth_deny_path, params: @authorize_params
    location = URI.parse(response.location)
    query = Rack::Utils.parse_query(location.query)
    assert_equal "access_denied", query["error"]
    assert_nil query["code"]
  end

  test "magic link returns the user to the consent screen" do
    get oauth_authorize_path, params: @authorize_params
    follow_redirect!
    post session_path, params: { email: "reader@example.com" }
    get magic_login_path(MagicLink.last.token)
    assert_response :redirect
    assert_match(%r{/oauth/authorize}, response.location)
    assert_includes response.location, "client_id=#{@registration["client_id"]}"
  end
end
