# frozen_string_literal: true

class OauthAuthorization < ApplicationRecord
  belongs_to :oauth_client
  belongs_to :library
  belongs_to :user

  validates :code_digest, :redirect_uri, :scopes, :code_challenge, :expires_at, presence: true

  def self.issue!(client:, library:, user:, redirect_uri:, scopes:, code_challenge:, code_challenge_method: Margin::Oauth::CHALLENGE_METHOD)
    raw = Margin::Oauth.new_secret
    record = create!(
      oauth_client: client,
      library: library,
      user: user,
      code_digest: Margin::Oauth.digest(raw),
      redirect_uri: redirect_uri,
      scopes: scopes,
      code_challenge: code_challenge,
      code_challenge_method: code_challenge_method,
      expires_at: Margin::Oauth::CODE_TTL.from_now
    )
    [ record, raw ]
  end

  def self.find_usable(code)
    return if code.blank?

    record = find_by(code_digest: Margin::Oauth.digest(code))
    record if record&.usable?
  end

  def consume!
    update!(used_at: Time.current)
  end

  def usable?
    used_at.blank? && expires_at > Time.current
  end

  def pkce_valid?(verifier)
    code_challenge_method == Margin::Oauth::CHALLENGE_METHOD &&
      Margin::Oauth.pkce_match?(code_challenge, verifier)
  end
end
