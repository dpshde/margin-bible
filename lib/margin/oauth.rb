# frozen_string_literal: true

module Margin
  # Small OAuth 2.1 provider for MCP agents (authorization code + PKCE + DCR).
  # Doorkeeper 5.9 does not ship RFC 7591 / RFC 8414 / RFC 9728, and this app's
  # resource owner is a claimed library rather than a Devise user.
  module Oauth
    READ_SCOPE = "notes:read"
    SCOPES = [ READ_SCOPE ].freeze
    CODE_TTL = 10.minutes
    ACCESS_TTL = 1.hour
    REFRESH_TTL = 30.days
    CHALLENGE_METHOD = "S256"

    module_function

    def issuer(request)
      Margin::PublicOrigin.call(request)
    end

    def mcp_resource(request)
      "#{issuer(request)}/mcp"
    end

    def resource_metadata_url(request)
      "#{issuer(request)}/.well-known/oauth-protected-resource"
    end

    def www_authenticate(request)
      %(Bearer realm="margin.bible", resource_metadata="#{resource_metadata_url(request)}")
    end

    def digest(value)
      Digest::SHA256.hexdigest(value.to_s)
    end

    def new_secret
      SecureRandom.urlsafe_base64(32)
    end

    def pkce_challenge(verifier)
      Base64.urlsafe_encode64(Digest::SHA256.digest(verifier.to_s), padding: false)
    end

    def pkce_match?(challenge, verifier)
      return false if challenge.blank? || verifier.blank?

      ActiveSupport::SecurityUtils.secure_compare(pkce_challenge(verifier), challenge.to_s)
    end

    def normalize_scopes(raw)
      requested = raw.to_s.split(/\s+/).reject(&:blank?)
      requested = [ READ_SCOPE ] if requested.empty?
      unknown = requested - SCOPES
      return if unknown.any?

      requested.uniq.join(" ")
    end

    def redirect_uri_allowed?(uri)
      parsed = URI.parse(uri.to_s)
      return false if parsed.scheme.blank?

      case parsed.scheme
      when "https"
        parsed.host.present?
      when "http"
        %w[localhost 127.0.0.1 ::1].include?(parsed.host)
      else
        parsed.scheme.match?(/\A[a-z][a-z0-9+.-]*\z/i) && (parsed.host.present? || parsed.path.present?)
      end
    rescue URI::InvalidURIError
      false
    end

    def protected_resource_metadata(request)
      {
        resource: mcp_resource(request),
        authorization_servers: [ issuer(request) ],
        scopes_supported: SCOPES,
        bearer_methods_supported: [ "header" ]
      }
    end

    def authorization_server_metadata(request)
      base = issuer(request)
      {
        issuer: base,
        authorization_endpoint: "#{base}/oauth/authorize",
        token_endpoint: "#{base}/oauth/token",
        registration_endpoint: "#{base}/oauth/register",
        revocation_endpoint: "#{base}/oauth/revoke",
        scopes_supported: SCOPES,
        response_types_supported: [ "code" ],
        grant_types_supported: [ "authorization_code", "refresh_token" ],
        code_challenge_methods_supported: [ CHALLENGE_METHOD ],
        token_endpoint_auth_methods_supported: [ "none" ],
        revocation_endpoint_auth_methods_supported: [ "none" ]
      }
    end
  end
end
