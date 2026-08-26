# frozen_string_literal: true

class AccountsController < ApplicationController
  before_action :require_signed_in

  def update
    if current_user.update(email: params[:email])
      notice = current_user.email.present? ? "Email saved." : "Email cleared."
      redirect_to passkeys_path, notice: notice
    else
      redirect_to passkeys_path, alert: current_user.errors.full_messages.to_sentence
    end
  end
end
