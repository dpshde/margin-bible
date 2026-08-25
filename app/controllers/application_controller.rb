# frozen_string_literal: true

class ApplicationController < ActionController::Base
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

    def set_current_library
      library = find_or_create_library
      Current.library = library
      Current.user = library.user
      cookies.signed.permanent[:library_id] = { value: library.id, httponly: true, same_site: :lax }
    end

    def find_or_create_library
      if (id = cookies.signed[:library_id]) && (lib = Library.find_by(id: id))
        return lib
      end

      Library.create!
    end
end
