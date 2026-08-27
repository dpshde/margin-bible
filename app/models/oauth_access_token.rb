# frozen_string_literal: true

class OauthAccessToken < ApplicationRecord
  belongs_to :oauth_client
  belongs_to :library
  belongs_to :user

  validates :token_digest, :refresh_digest, :scopes, :expires_at, :refresh_expires_at, presence: true

  scope :live, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }

  def self.issue!(client:, library:, user:, scopes:)
    raw_access = "mb_#{Margin::Oauth.new_secret}"
    raw_refresh = "mbr_#{Margin::Oauth.new_secret}"
    record = create!(
      oauth_client: client,
      library: library,
      user: user,
      token_digest: Margin::Oauth.digest(raw_access),
      refresh_digest: Margin::Oauth.digest(raw_refresh),
      scopes: scopes,
      expires_at: Margin::Oauth::ACCESS_TTL.from_now,
      refresh_expires_at: Margin::Oauth::REFRESH_TTL.from_now
    )
    [ record, raw_access, raw_refresh ]
  end

  def self.authenticate(raw)
    return if raw.blank?

    token = find_by(token_digest: Margin::Oauth.digest(raw))
    token if token&.usable?
  end

  def self.refresh(raw)
    return if raw.blank?

    token = find_by(refresh_digest: Margin::Oauth.digest(raw))
    return unless token&.refreshable?

    token.revoke!
    issue!(client: token.oauth_client, library: token.library, user: token.user, scopes: token.scopes)
  end

  def self.revoke(raw)
    return if raw.blank?

    digest = Margin::Oauth.digest(raw)
    token = find_by(token_digest: digest) || find_by(refresh_digest: digest)
    token&.revoke!
    true
  end

  def usable?
    revoked_at.blank? && expires_at > Time.current && scopes.to_s.split.include?(Margin::Oauth::READ_SCOPE)
  end

  def refreshable?
    revoked_at.blank? && refresh_expires_at > Time.current
  end

  def revoke!
    update!(revoked_at: Time.current) if revoked_at.blank?
  end

  def read_only?
    scopes.to_s.split == [ Margin::Oauth::READ_SCOPE ]
  end
end
