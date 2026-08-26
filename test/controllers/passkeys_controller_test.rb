# frozen_string_literal: true

require "test_helper"

class PasskeysControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "reader@example.com")
  end

  test "guests cannot manage passkeys" do
    get passkeys_path
    assert_redirected_to new_session_path
  end

  test "signed-in user registers names and removes a passkey" do
    claim_as(@user)

    get passkeys_path
    assert_response :success
    assert_select "h1", "Passkeys"
    assert_select "rails-passkey-registration-button button[data-passkey='register']", "Register a passkey"
    assert_select "rails-passkey-registration-button[options*='client-device']"

    challenge = refresh_webauthn_challenge(purpose: "registration")
    raw = webauthn_client.create(challenge: challenge)
    post passkeys_path, params: passkey_registration_params_from(raw)
    passkey = Passkey.last
    assert_redirected_to edit_passkey_path(passkey, created: true)
    assert_equal @user, passkey.user

    follow_redirect!
    patch passkey_path(passkey), params: { passkey: { name: "MacBook" } }
    assert_redirected_to passkeys_path
    assert_equal "MacBook", passkey.reload.name

    follow_redirect!
    assert_select ".passkey-link strong", "MacBook"

    delete passkey_path(passkey)
    assert_redirected_to passkeys_path
    assert_not Passkey.exists?(passkey.id)
  end

  test "registration challenge is unauthorized for guests" do
    post passkey_challenge_path, params: { purpose: "registration" }
    assert_response :unauthorized
  end
end
