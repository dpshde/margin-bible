# frozen_string_literal: true

module Margin
  # Public HTTPS origin for OAuth / MCP metadata URLs.
  #
  # Prefer <APP_HOST>. Fall back to the request host. Never let
  # <RAILWAY_PUBLIC_DOMAIN> win when <APP_HOST> is set and they differ —
  # Railway can leave a retired generated hostname there after a domain rename.
  #
  # A generated Railway hostname baked into <APP_HOST> or X-Forwarded-Host
  # (web-production-<hex>.up.railway.app) is treated as stale when the client
  # reached a different public host.
  module PublicOrigin
    GENERATED_RAILWAY_HOST = /\A[a-z0-9-]+-production-[a-f0-9]+\.up\.railway\.app\z/i
    LOOPBACK_HOSTS = %w[localhost 127.0.0.1 ::1].freeze

    module_function

    def call(request = nil)
      app = from_env(ENV["APP_HOST"])
      incoming = from_request(request)

      if app && incoming && generated_railway_origin?(app) && app != incoming
        return incoming
      end

      app || incoming
    end

    def from_env(value)
      raw = value.to_s.strip.presence
      return if raw.blank?

      raw = raw.delete_suffix("/")
      raw.start_with?("http://", "https://") ? raw : "https://#{raw}"
    end

    def from_request(request)
      return if request.nil?

      host = public_request_host(request)
      return if host.blank?

      if LOOPBACK_HOSTS.include?(host)
        request.base_url.delete_suffix("/")
      else
        "https://#{host}"
      end
    end

    def public_request_host(request)
      forwarded = header_host(request, "HTTP_X_FORWARDED_HOST")
      raw = header_host(request, "HTTP_HOST")
      if generated_railway_host?(forwarded) && raw.present? && forwarded != raw
        return raw
      end

      request.host.presence
    end

    def header_host(request, header)
      request.get_header(header).to_s.split(/,\s*/).first.to_s.sub(/:\d+\z/, "").presence
    end

    def generated_railway_origin?(origin)
      generated_railway_host?(URI.parse(origin.to_s).host)
    rescue URI::InvalidURIError
      false
    end

    def generated_railway_host?(host)
      GENERATED_RAILWAY_HOST.match?(host.to_s)
    end
  end
end
