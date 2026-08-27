# frozen_string_literal: true

class User < ApplicationRecord
  has_many :libraries, dependent: :nullify
  has_many :magic_links, dependent: :destroy
  has_many :oauth_authorizations, dependent: :destroy
  has_many :oauth_access_tokens, dependent: :destroy

  has_many :passkeys, dependent: :destroy do
    def register(params, challenge:)
      Passkey.register(params, holder: proxy_association.owner, challenge: challenge)
    end
  end

  normalizes :email, with: ->(e) { User.normalized_email(e) }

  validates :email, uniqueness: true, allow_nil: true, format: { with: URI::MailTo::EMAIL_REGEXP, allow_nil: true }

  def self.normalized_email(value)
    value.to_s.strip.downcase.presence
  end

  def webauthn_name
    email.presence || "margin"
  end

  def ensure_webauthn_id!
    return webauthn_id if webauthn_id.present?

    generated = WebAuthn.generate_user_id
    persisted? ? update!(webauthn_id: generated) : self.webauthn_id = generated
    webauthn_id
  end
end
