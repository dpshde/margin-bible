# frozen_string_literal: true

class SessionsController < ApplicationController
  def new
  end

  def create
    email = params.require(:email)
    user = User.find_or_create_by!(email: email)
    link = MagicLink.issue!(user: user, library: current_library)
    MagicLinkMailer.sign_in(link).deliver_now
    redirect_to new_session_path, notice: notice_for(link)
  end

  def show
    link = MagicLink.live.find_by!(token: params[:token])
    user = link.user
    library = current_library

    if user.libraries.any?
      Current.library = user.libraries.order(:id).first
    else
      library.update!(user: user)
      Current.library = library
    end
    Current.user = user
    cookies.signed.permanent[:library_id] = { value: Current.library.id, httponly: true, same_site: :lax }
    link.destroy
    redirect_to root_path, notice: "Welcome back. Your notes are on this library."
  end

  def destroy
    cookies.delete(:library_id)
    reset_session
    redirect_to root_path, notice: "Signed out of this device’s library cookie."
  end

  private
    def notice_for(link)
      if Rails.env.local?
        "Check your email — or open #{magic_login_url(link.token)} (dev)."
      else
        "Check your email for a sign-in link."
      end
    end
end
