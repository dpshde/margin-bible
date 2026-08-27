# frozen_string_literal: true

module Margin
  module Features
    module_function

    def email_first_sign_in?(request = nil)
      return true if ENV["SIGN_IN_EMAIL_FIRST"] == "1"
      return false unless request

      request.params[:signin].to_s == "email"
    end
  end
end
