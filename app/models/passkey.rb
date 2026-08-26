# frozen_string_literal: true

class Passkey < ApplicationRecord
  belongs_to :user

  validates :external_id, presence: true, uniqueness: true
  validates :public_key, presence: true
  validates :sign_count, numericality: { greater_than_or_equal_to: 0 }

  class << self
    def relying_party
      origin = Current.webauthn_origin
      raise ArgumentError, "WebAuthn origin is not set for this request" if origin.blank?

      WebAuthn::RelyingParty.new(
        allowed_origins: [ origin ],
        id: Current.webauthn_rp_id,
        name: "Margin"
      )
    end

    def registration_options(holder:)
      holder.ensure_webauthn_id!
      handle = holder.try(:webauthn_name) || holder.email.presence || "margin"
      relying_party.options_for_registration(
        user: {
          id: holder.webauthn_id,
          name: handle,
          display_name: handle
        },
        exclude: holder.passkeys.pluck(:external_id),
        authenticator_selection: {
          resident_key: "required",
          user_verification: "preferred"
        }
      )
    end

    def authentication_options
      relying_party.options_for_authentication(user_verification: "preferred")
    end

    def register(params, holder:, challenge:)
      credential = relying_party.verify_registration(create_response(params), challenge)
      holder.passkeys.create!(
        external_id: credential.id,
        public_key: credential.public_key,
        sign_count: credential.sign_count,
        transports: Array(params[:transports])
      )
    end

    def authenticate(params, challenge:)
      return if challenge.blank?

      raw = get_response(params)
      webauthn_credential = WebAuthn::Credential.from_get(raw, relying_party: relying_party)
      stored = find_by(external_id: webauthn_credential.id)
      return unless stored

      webauthn_credential.verify(
        challenge,
        public_key: stored.public_key,
        sign_count: stored.sign_count
      )
      stored.update!(sign_count: webauthn_credential.sign_count)
      stored
    rescue WebAuthn::Error
      nil
    end

    private
      def create_response(params)
        {
          "id" => params[:id],
          "rawId" => params[:id],
          "type" => "public-key",
          "response" => {
            "attestationObject" => params[:attestation_object],
            "clientDataJSON" => params[:client_data_json],
            "transports" => Array(params[:transports])
          }
        }
      end

      def get_response(params)
        {
          "id" => params[:id],
          "rawId" => params[:id],
          "type" => "public-key",
          "response" => {
            "authenticatorData" => params[:authenticator_data],
            "clientDataJSON" => params[:client_data_json],
            "signature" => params[:signature]
          }
        }
      end
  end

  def label
    name.presence || "Passkey"
  end
end
