# frozen_string_literal: true

class ApplicationController < ActionController::Base
  LIBRARY_COOKIE = :library_id

  allow_browser versions: :modern if Rails.env.production?

  before_action :set_current_library

  helper_method :current_library, :current_user, :signed_in?

  private
    def current_library
      Current.library
    end

    def current_user
      Current.user
    end

    def signed_in?
      current_user.present?
    end

    def require_signed_in
      return if signed_in?

      redirect_to new_session_path, alert: "Claim this library with a magic link first."
    end

    def after_authentication_path
      session.delete(:return_to).presence || root_path
    end

    def claim_library_for!(user)
      library =
        if user.libraries.any?
          user.libraries.order(:id).first
        else
          current_library.tap { |lib| lib.update!(user: user) }
        end

      Current.library = library
      Current.user = user
      persist_library_cookie!(library)
    end

    def set_current_library
      library = find_or_create_library
      Current.library = library
      Current.user = library.user
      persist_library_cookie!(library)
    end

    def find_or_create_library
      if (id = cookies.signed[LIBRARY_COOKIE]) && (lib = Library.find_by(id: id))
        return lib
      end

      Library.create!
    end

    def persist_library_cookie!(library)
      cookies.signed.permanent[LIBRARY_COOKIE] = library_cookie_options.merge(value: library.id)
    end

    def clear_library_cookie!
      cookies.delete(LIBRARY_COOKIE, library_cookie_options)
    end

    def library_cookie_options
      {
        httponly: true,
        same_site: :lax,
        secure: Rails.env.production?,
        path: "/"
      }
    end

    def inbound_passage
      raw = params[:q].presence || params[:osis].presence || params[:ref].presence
      return if raw.blank?

      Margin::Passage.parse(raw)
    end
end
