# frozen_string_literal: true

require "test_helper"

class WellKnownControllerTest < ActionDispatch::IntegrationTest
  test "protected resource metadata points agents at this host's MCP and auth server" do
    get "/.well-known/oauth-protected-resource"
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "http://www.example.com/mcp", body["resource"]
    assert_equal [ "http://www.example.com" ], body["authorization_servers"]
    assert_equal [ "notes:read" ], body["scopes_supported"]
  end

  test "authorization server metadata advertises PKCE and registration" do
    get "/.well-known/oauth-authorization-server"
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "http://www.example.com/oauth/authorize", body["authorization_endpoint"]
    assert_equal "http://www.example.com/oauth/token", body["token_endpoint"]
    assert_equal "http://www.example.com/oauth/register", body["registration_endpoint"]
    assert_equal [ "S256" ], body["code_challenge_methods_supported"]
    assert_equal [ "notes:read" ], body["scopes_supported"]
    refute_includes body["scopes_supported"], "notes:write"
  end
end
