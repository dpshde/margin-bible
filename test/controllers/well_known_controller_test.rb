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

  test "APP_HOST is the issuer even when RAILWAY_PUBLIC_DOMAIN and the request host are retired" do
    prior_app = ENV["APP_HOST"]
    prior_railway = ENV["RAILWAY_PUBLIC_DOMAIN"]
    ENV["APP_HOST"] = "margin-bible.up.railway.app"
    ENV["RAILWAY_PUBLIC_DOMAIN"] = "web-production-0b88ca.up.railway.app"
    host! "web-production-0b88ca.up.railway.app"

    get "/.well-known/oauth-authorization-server"
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "https://margin-bible.up.railway.app", body["issuer"]
    assert_equal "https://margin-bible.up.railway.app/oauth/authorize", body["authorization_endpoint"]
    assert_equal "https://margin-bible.up.railway.app/oauth/token", body["token_endpoint"]
    assert_equal "https://margin-bible.up.railway.app/oauth/register", body["registration_endpoint"]
    assert_equal "https://margin-bible.up.railway.app/oauth/revoke", body["revocation_endpoint"]

    get "/.well-known/oauth-protected-resource"
    resource = JSON.parse(response.body)
    assert_equal "https://margin-bible.up.railway.app/mcp", resource["resource"]
    assert_equal [ "https://margin-bible.up.railway.app" ], resource["authorization_servers"]
  ensure
    prior_app.nil? ? ENV.delete("APP_HOST") : ENV["APP_HOST"] = prior_app
    prior_railway.nil? ? ENV.delete("RAILWAY_PUBLIC_DOMAIN") : ENV["RAILWAY_PUBLIC_DOMAIN"] = prior_railway
    host! "www.example.com"
  end
end
