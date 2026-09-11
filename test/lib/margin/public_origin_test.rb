# frozen_string_literal: true

require "test_helper"

class PublicOriginTest < ActiveSupport::TestCase
  LIVE_HOST = "margin-bible.up.railway.app"
  RETIRED_HOST = "web-production-0b88ca.up.railway.app"

  test "APP_HOST wins over the request host and a differing RAILWAY_PUBLIC_DOMAIN" do
    with_env(
      "APP_HOST" => LIVE_HOST,
      "RAILWAY_PUBLIC_DOMAIN" => RETIRED_HOST
    ) do
      assert_equal "https://#{LIVE_HOST}", Margin::PublicOrigin.call(request_for(RETIRED_HOST))
      assert_equal "https://#{LIVE_HOST}", Margin::Oauth.issuer(request_for(RETIRED_HOST))
    end
  end

  test "APP_HOST with a scheme is used as-is" do
    with_env("APP_HOST" => "https://#{LIVE_HOST}/") do
      assert_equal "https://#{LIVE_HOST}", Margin::PublicOrigin.call(request_for("www.example.com"))
    end
  end

  test "a retired generated APP_HOST yields to the live request host" do
    with_env(
      "APP_HOST" => RETIRED_HOST,
      "RAILWAY_PUBLIC_DOMAIN" => RETIRED_HOST
    ) do
      assert_equal "https://#{LIVE_HOST}", Margin::PublicOrigin.call(request_for(LIVE_HOST))
    end
  end

  test "RAILWAY_PUBLIC_DOMAIN is never the issuer when APP_HOST is set" do
    with_env(
      "APP_HOST" => LIVE_HOST,
      "RAILWAY_PUBLIC_DOMAIN" => RETIRED_HOST
    ) do
      origin = Margin::PublicOrigin.call(request_for("www.example.com"))
      assert_equal "https://#{LIVE_HOST}", origin
      refute_includes origin, RETIRED_HOST
    end
  end

  test "without APP_HOST the request host is the issuer" do
    with_env("APP_HOST" => nil, "RAILWAY_PUBLIC_DOMAIN" => RETIRED_HOST) do
      assert_equal "https://#{LIVE_HOST}", Margin::PublicOrigin.call(request_for(LIVE_HOST))
    end
  end

  test "a generated X-Forwarded-Host does not beat the Host header" do
    with_env("APP_HOST" => nil) do
      request = request_for(LIVE_HOST, forwarded: RETIRED_HOST)
      assert_equal "https://#{LIVE_HOST}", Margin::PublicOrigin.call(request)
    end
  end

  test "loopback request hosts keep the request scheme and port" do
    with_env("APP_HOST" => nil) do
      request = ActionDispatch::TestRequest.create({ "HTTP_HOST" => "localhost:3000" })
      assert_equal "http://localhost:3000", Margin::PublicOrigin.call(request)
    end
  end

  test "authorization metadata and WWW-Authenticate use APP_HOST" do
    request = request_for(RETIRED_HOST)
    with_env("APP_HOST" => LIVE_HOST, "RAILWAY_PUBLIC_DOMAIN" => RETIRED_HOST) do
      metadata = Margin::Oauth.authorization_server_metadata(request)
      assert_equal "https://#{LIVE_HOST}", metadata[:issuer]
      assert_equal "https://#{LIVE_HOST}/oauth/authorize", metadata[:authorization_endpoint]
      assert_equal "https://#{LIVE_HOST}/oauth/token", metadata[:token_endpoint]
      assert_equal "https://#{LIVE_HOST}/oauth/register", metadata[:registration_endpoint]
      assert_equal "https://#{LIVE_HOST}/oauth/revoke", metadata[:revocation_endpoint]

      resource = Margin::Oauth.protected_resource_metadata(request)
      assert_equal "https://#{LIVE_HOST}/mcp", resource[:resource]
      assert_equal [ "https://#{LIVE_HOST}" ], resource[:authorization_servers]

      assert_equal(
        %(Bearer realm="margin.bible", resource_metadata="https://#{LIVE_HOST}/.well-known/oauth-protected-resource"),
        Margin::Oauth.www_authenticate(request)
      )
    end
  end

  private

    def request_for(host, forwarded: nil)
      env = { "HTTP_HOST" => host, "HTTPS" => "on" }
      env["HTTP_X_FORWARDED_HOST"] = forwarded if forwarded
      ActionDispatch::TestRequest.create(env)
    end

    def with_env(vars)
      prior = vars.keys.index_with { |key| ENV.key?(key) ? ENV[key] : :__unset__ }
      vars.each do |key, value|
        if value.nil?
          ENV.delete(key)
        else
          ENV[key] = value
        end
      end
      yield
    ensure
      prior.each do |key, value|
        if value == :__unset__
          ENV.delete(key)
        else
          ENV[key] = value
        end
      end
    end
end
