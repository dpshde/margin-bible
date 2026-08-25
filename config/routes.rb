# frozen_string_literal: true

Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  root "home#show"

  resource :session, only: %i[new create destroy]
  get "login/:token" => "sessions#show", as: :magic_login

  get "resolve" => "resolves#show", as: :resolve
  patch "notes" => "notes#upsert", as: :notes

  get "*slug" => "reader#show",
      as: :read,
      format: false,
      constraints: { slug: /[0-9a-z][0-9a-z.]+/i }
end
