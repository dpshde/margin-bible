# frozen_string_literal: true

Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  root "home#show"

  resource :session, only: %i[new create destroy] do
    resource :passkey, only: :create, controller: "sessions/passkeys"
  end
  get "login/:token" => "sessions#show", as: :magic_login
  resource :passkey_challenge, only: :create
  resources :passkeys, only: %i[index create edit update destroy]

  get "resolve" => "resolves#show", as: :resolve
  get "go" => "resolves#show"
  post "export" => "exports#create", as: :export
  patch "notes" => "notes#upsert", as: :notes

  get "*slug" => "reader#show",
      as: :read,
      format: false,
      constraints: { slug: /[0-9a-z][0-9a-z.-]+/i }
end
