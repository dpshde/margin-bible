# frozen_string_literal: true

class OauthClient < ApplicationRecord
  has_many :oauth_authorizations, dependent: :destroy
  has_many :oauth_access_tokens, dependent: :destroy

  validates :uid, presence: true, uniqueness: true
  validates :name, presence: true
  validate :redirect_uris_are_allowed

  def self.register(params)
    uris = Array(params[:redirect_uris] || params["redirect_uris"]).map(&:to_s)
    create(
      uid: SecureRandom.uuid,
      name: (params[:client_name] || params["client_name"]).to_s.strip,
      redirect_uris: uris,
      token_endpoint_auth_method: "none"
    )
  end

  def allows_redirect?(uri)
    Array(redirect_uris).include?(uri.to_s)
  end

  def as_registration
    {
      client_id: uid,
      client_name: name,
      redirect_uris: Array(redirect_uris),
      token_endpoint_auth_method: token_endpoint_auth_method,
      grant_types: [ "authorization_code", "refresh_token" ],
      response_types: [ "code" ]
    }
  end

  private
    def redirect_uris_are_allowed
      uris = Array(redirect_uris)
      if uris.empty?
        errors.add(:redirect_uris, "must include at least one URI")
        return
      end

      uris.each do |uri|
        unless Margin::Oauth.redirect_uri_allowed?(uri)
          errors.add(:redirect_uris, "contains a disallowed URI")
          break
        end
      end
    end
end
