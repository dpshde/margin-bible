# frozen_string_literal: true

class User < ApplicationRecord
  has_many :libraries, dependent: :nullify
  has_many :magic_links, dependent: :destroy
  has_many :passkeys, dependent: :destroy do
    def register(params, challenge:)
      Passkey.register(params, holder: proxy_association.owner, challenge: challenge)
    end
  end

  normalizes :email, with: ->(e) { e.to_s.strip.downcase }

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }

  def ensure_webauthn_id!
    return webauthn_id if webauthn_id.present?

    update!(webauthn_id: WebAuthn.generate_user_id)
    webauthn_id
  end
end
