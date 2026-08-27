# frozen_string_literal: true

module OauthHttp
  extend ActiveSupport::Concern

  included do
    before_action :set_oauth_cors_headers
  end

  def options
    head :no_content
  end

  private
    def set_oauth_cors_headers
      response.set_header("Access-Control-Allow-Origin", "*")
      response.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
      response.set_header("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id")
      response.set_header("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id")
    end

    def json_error(error, description = nil, status: :bad_request)
      body = { error: error }
      body[:error_description] = description if description.present?
      render json: body, status: status
    end
end
