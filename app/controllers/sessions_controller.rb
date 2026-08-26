# frozen_string_literal: true

class SessionsController < ApplicationController
  include PasskeyRequest

  skip_before_action :set_current_library, only: :destroy

  def new
    @authentication_options = passkey_authentication_options
    token = flash[:dev_login_token]
    @dev_login_path = magic_login_path(token) if token.present?
  end

  def create
    email = params.require(:email)
    user = User.find_or_create_by!(email: email)
    link = MagicLink.issue!(user: user, library: current_library)
    MagicLinkMailer.sign_in(link).deliver_now
    flash[:dev_login_token] = link.token if Rails.env.local?
    redirect_to new_session_path, notice: "Check your email."
  end

  def show
    link = MagicLink.live.find_by!(token: params[:token])
    claim_library_for!(link.user)
    link.destroy
    redirect_to root_path, notice: "Welcome back."
  end

  def destroy
    clear_library_cookie!
    reset_session
    redirect_to root_path, notice: "Signed out."
  end
end
