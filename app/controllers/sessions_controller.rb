# frozen_string_literal: true

class SessionsController < ApplicationController
  include PasskeyRequest

  skip_before_action :set_current_library, only: :destroy

  def new
    @authentication_options = passkey_authentication_options
    @registration_options = passkey_registration_options(holder: pending_passkey_holder)
    token = flash[:dev_login_token]
    @dev_login_path = magic_login_path(token) if token.present?
  end

  def create
    email = User.normalized_email(params.require(:email))
    if email.blank?
      redirect_to new_session_path, alert: "Enter an email."
      return
    end

    user = User.find_or_create_by!(email: email)
    link = MagicLink.issue!(user: user, library: current_library)
    mailed = deliver_sign_in_mail(link)
    flash[:dev_login_token] = link.token if Rails.env.local? || !mailed
    notice = if mailed || Rails.env.local?
      "Check your email."
    else
      "Couldn’t send email. Use the sign-in link below."
    end
    redirect_to new_session_path, notice: notice
  end

  def show
    link = MagicLink.live.find_by!(token: params[:token])
    claim_library_for!(link.user)
    link.destroy
    redirect_to after_authentication_path, notice: "Welcome back."
  end

  def destroy
    clear_library_cookie!
    reset_session
    redirect_to root_path, notice: "Signed out."
  end

  private
    def deliver_sign_in_mail(link)
      return false unless ENV["SMTP_ADDRESS"].present?

      MagicLinkMailer.sign_in(link).deliver_now
      true
    rescue StandardError => error
      Rails.logger.error("Magic link email failed: #{error.class}: #{error.message}")
      false
    end
end
