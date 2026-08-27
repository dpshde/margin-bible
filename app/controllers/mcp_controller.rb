# frozen_string_literal: true

class McpController < ActionController::API
  include OauthHttp
  wrap_parameters false

  before_action :rewind_body, except: :options

  def handle
    token = bearer_token
    access = OauthAccessToken.authenticate(token)
    unless access
      response.set_header("WWW-Authenticate", Margin::Oauth.www_authenticate(request))
      render json: { error: "invalid_token", error_description: "Sign in and grant this agent access to your library." },
             status: :unauthorized
      return
    end

    status, headers, body = Margin::Mcp.transport(library: access.library, request: request).handle_request(request)
    headers.each do |key, value|
      response.set_header(key, value) unless key.to_s.downcase == "content-length"
    end
    self.status = status
    self.response_body = rack_body(body)
  end

  private
    def rewind_body
      request.body.rewind if request.body.respond_to?(:rewind)
    end

    def bearer_token
      header = request.authorization.to_s
      header.delete_prefix("Bearer ").presence
    end

    def rack_body(body)
      return body if body.is_a?(String)
      return "" if body.nil?

      parts = []
      body.each { |chunk| parts << chunk }
      parts.join
    end
end
