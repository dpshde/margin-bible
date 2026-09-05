# frozen_string_literal: true

Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  root "home#show"

  resource :session, only: %i[new create destroy] do
    resource :passkey, only: :create, controller: "sessions/passkeys"
    resource :passkey_registration, only: :create, controller: "sessions/passkey_registrations"
  end
  get "login/:token" => "sessions#show", as: :magic_login
  resource :passkey_challenge, only: :create
  resources :passkeys, only: %i[index create edit update destroy]
  resource :account, only: :update
  post "guest_pack" => "guest_packs#create", as: :guest_pack

  get "resolve" => "resolves#show", as: :resolve
  get "go" => "resolves#show"
  post "export" => "exports#create", as: :export
  patch "notes" => "notes#upsert", as: :notes

  get ".well-known/oauth-protected-resource" => "well_known#oauth_protected_resource"
  get ".well-known/oauth-protected-resource/mcp" => "well_known#oauth_protected_resource"
  get ".well-known/oauth-authorization-server" => "well_known#oauth_authorization_server"

  match "mcp", to: "mcp#handle", via: %i[get post delete options], as: :mcp

  get "oauth/authorize" => "oauth/authorizations#new", as: :oauth_authorize
  post "oauth/authorize" => "oauth/authorizations#create"
  post "oauth/deny" => "oauth/authorizations#destroy", as: :oauth_deny
  post "oauth/token" => "oauth/tokens#create", as: :oauth_token
  post "oauth/register" => "oauth/registrations#create", as: :oauth_register
  post "oauth/revoke" => "oauth/revocations#create", as: :oauth_revoke
  resources :oauth_connections, only: %i[index destroy], path: "oauth/connections", controller: "oauth/connections"

  get "leader-sheets/:osis" => "leader_sheets#show",
      as: :leader_sheet,
      constraints: { osis: /[0-9a-z][0-9a-z.-]+/i }

  get "*slug" => "reader#show",
      as: :read,
      format: false,
      constraints: { slug: /[0-9a-z][0-9a-z.-]+/i }
end
