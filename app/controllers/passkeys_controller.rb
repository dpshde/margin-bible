# frozen_string_literal: true

class PasskeysController < ApplicationController
  include PasskeyRequest

  before_action :require_signed_in
  before_action :set_passkey, only: %i[edit update destroy]

  def index
    @passkeys = current_user.passkeys.order(name: :asc, created_at: :desc)
    @registration_options = passkey_registration_options(holder: current_user)
  end

  def create
    passkey = current_user.passkeys.register(passkey_registration_params, challenge: consume_webauthn_challenge)
    redirect_to edit_passkey_path(passkey, created: true)
  rescue WebAuthn::Error, ActiveRecord::RecordInvalid
    redirect_to passkeys_path, alert: "Something went wrong while registering your passkey."
  end

  def edit
  end

  def update
    @passkey.update!(params.require(:passkey).permit(:name))
    redirect_to passkeys_path
  end

  def destroy
    @passkey.destroy!
    redirect_to passkeys_path
  end

  private
    def set_passkey
      @passkey = current_user.passkeys.find(params[:id])
    end
end
