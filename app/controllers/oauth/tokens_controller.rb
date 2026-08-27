# frozen_string_literal: true

class Oauth::TokensController < ActionController::API
  include OauthHttp
  wrap_parameters false

  rate_limit to: 30, within: 1.minute, only: :create, with: -> { json_error("access_denied", "Try again later.", status: :too_many_requests) }

  def create
    case params[:grant_type].to_s
    when "authorization_code"
      exchange_code
    when "refresh_token"
      refresh_token
    else
      json_error("unsupported_grant_type", "Use authorization_code or refresh_token.")
    end
  end

  private
    def exchange_code
      grant = OauthAuthorization.consume(params[:code])
      unless grant
        json_error("invalid_grant", "Authorization code is missing, used, or expired.")
        return
      end

      unless grant.oauth_client.uid == params[:client_id].to_s
        json_error("invalid_client", "client_id does not match this code.")
        return
      end

      unless grant.redirect_uri == params[:redirect_uri].to_s
        json_error("invalid_grant", "redirect_uri does not match.")
        return
      end

      unless grant.pkce_valid?(params[:code_verifier])
        json_error("invalid_grant", "PKCE verification failed.")
        return
      end

      render_tokens(*OauthAccessToken.issue!(
        client: grant.oauth_client,
        library: grant.library,
        user: grant.user,
        scopes: grant.scopes
      ))
    end

    def refresh_token
      rotated = OauthAccessToken.refresh(params[:refresh_token])
      unless rotated
        json_error("invalid_grant", "Refresh token is missing, revoked, or expired.")
        return
      end

      record, access, refresh = rotated
      if params[:client_id].present? && record.oauth_client.uid != params[:client_id].to_s
        record.revoke!
        json_error("invalid_client", "client_id does not match this refresh token.")
        return
      end

      render_tokens(record, access, refresh)
    end

    def render_tokens(record, access, refresh)
      render json: {
        access_token: access,
        refresh_token: refresh,
        token_type: "Bearer",
        expires_in: (record.expires_at - Time.current).to_i,
        scope: record.scopes
      }
    end
end
