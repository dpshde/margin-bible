# frozen_string_literal: true

class Oauth::AuthorizationsController < ApplicationController
  before_action :require_signed_in_for_oauth
  before_action :load_request

  def new
    return if performed?

    @client = @oauth_request[:client]
    @scopes = @oauth_request[:scopes]
  end

  def create
    return if performed?

    _record, code = OauthAuthorization.issue!(
      client: @oauth_request[:client],
      library: current_library,
      user: current_user,
      redirect_uri: @oauth_request[:redirect_uri],
      scopes: @oauth_request[:scopes],
      code_challenge: @oauth_request[:code_challenge]
    )
    redirect_to redirect_with(code: code, state: @oauth_request[:state]), allow_other_host: true
  end

  def destroy
    return if performed?

    redirect_to redirect_with(error: "access_denied", state: @oauth_request[:state]), allow_other_host: true
  end

  private
    def require_signed_in_for_oauth
      return if signed_in?

      session[:return_to] = request.fullpath if request.get?
      redirect_to new_session_path, alert: "Sign in to connect an agent to your notes."
    end

    def load_request
      client = OauthClient.find_by(uid: params[:client_id].to_s)
      unless client
        render plain: "Unknown agent.", status: :bad_request
        return
      end

      redirect_uri = params[:redirect_uri].to_s
      unless client.allows_redirect?(redirect_uri)
        render plain: "This agent’s redirect URI is not registered.", status: :bad_request
        return
      end

      scopes = Margin::Oauth.normalize_scopes(params[:scope])
      unless scopes
        redirect_to redirect_with(error: "invalid_scope", state: params[:state], uri: redirect_uri), allow_other_host: true
        return
      end

      if params[:code_challenge].blank? || params[:code_challenge_method].to_s != Margin::Oauth::CHALLENGE_METHOD
        redirect_to redirect_with(error: "invalid_request", state: params[:state], uri: redirect_uri), allow_other_host: true
        return
      end

      resource = params[:resource].presence
      if resource && resource != Margin::Oauth.mcp_resource(request)
        redirect_to redirect_with(error: "invalid_target", state: params[:state], uri: redirect_uri), allow_other_host: true
        return
      end

      @oauth_request = {
        client: client,
        redirect_uri: redirect_uri,
        scopes: scopes,
        code_challenge: params[:code_challenge].to_s,
        state: params[:state].to_s.presence
      }
    end

    def redirect_with(uri: @oauth_request&.dig(:redirect_uri) || params[:redirect_uri], **query)
      parsed = URI.parse(uri.to_s)
      extra = query.compact
      parsed.query = [ parsed.query, extra.to_query ].compact.reject(&:blank?).join("&")
      parsed.to_s
    end
end
