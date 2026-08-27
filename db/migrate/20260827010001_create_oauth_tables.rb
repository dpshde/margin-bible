# frozen_string_literal: true

class CreateOauthTables < ActiveRecord::Migration[8.1]
  def change
    create_table :oauth_clients do |t|
      t.string :uid, null: false
      t.string :name, null: false
      t.json :redirect_uris, null: false, default: []
      t.string :token_endpoint_auth_method, null: false, default: "none"
      t.timestamps
    end
    add_index :oauth_clients, :uid, unique: true

    create_table :oauth_authorizations do |t|
      t.references :oauth_client, null: false, foreign_key: true
      t.references :library, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :code_digest, null: false
      t.string :redirect_uri, null: false
      t.string :scopes, null: false
      t.string :code_challenge, null: false
      t.string :code_challenge_method, null: false, default: "S256"
      t.datetime :expires_at, null: false
      t.datetime :used_at
      t.timestamps
    end
    add_index :oauth_authorizations, :code_digest, unique: true

    create_table :oauth_access_tokens do |t|
      t.references :oauth_client, null: false, foreign_key: true
      t.references :library, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :token_digest, null: false
      t.string :refresh_digest, null: false
      t.string :scopes, null: false
      t.datetime :expires_at, null: false
      t.datetime :refresh_expires_at, null: false
      t.datetime :revoked_at
      t.timestamps
    end
    add_index :oauth_access_tokens, :token_digest, unique: true
    add_index :oauth_access_tokens, :refresh_digest, unique: true
    add_index :oauth_access_tokens, [ :library_id, :revoked_at ]
  end
end
