# frozen_string_literal: true

require "test_helper"

class AccountsControllerTest < ActionDispatch::IntegrationTest
  test "passkey-only user can add change and clear an email on passkeys" do
    get root_path
    get new_session_path
    challenge = refresh_webauthn_challenge(purpose: "registration")
    raw = webauthn_client.create(challenge: challenge)
    post session_passkey_registration_path, params: passkey_registration_params_from(raw)
    user = User.last
    library = Library.last
    assert_nil user.email

    get passkeys_path
    assert_response :success
    assert_select "section.account-email input#account_email"
    assert_select "section.account-email button", "Add email"

    patch account_path, params: { email: "Reader@Example.com" }
    assert_redirected_to passkeys_path
    assert_equal "reader@example.com", user.reload.email
    follow_redirect!
    assert_select ".flash", text: "Email saved."
    assert_select "section.account-email button", "Save email"
    assert_select "input#account_email[value='reader@example.com']"

    patch account_path, params: { email: "other@example.com" }
    assert_equal "other@example.com", user.reload.email

    patch account_path, params: { email: "   " }
    assert_redirected_to passkeys_path
    assert_nil user.reload.email
    follow_redirect!
    assert_select ".flash", text: "Email cleared."

    user.update!(email: "reader@example.com")
    delete session_path
    get root_path
    post session_path, params: { email: "Reader@Example.com" }
    get magic_login_path(MagicLink.last.token)
    assert_redirected_to root_path
    assert_equal user, library.reload.user
    assert_equal 1, User.where(email: "reader@example.com").count
  end

  test "adding an email that is already taken is rejected" do
    User.create!(email: "taken@example.com")
    user = User.create!
    claim_as(user)

    patch account_path, params: { email: "taken@example.com" }
    assert_redirected_to passkeys_path
    follow_redirect!
    assert_select ".flash-alert", /has already been taken/
    assert_nil user.reload.email
  end

  test "invalid email is rejected" do
    user = User.create!
    claim_as(user)

    patch account_path, params: { email: "not-an-email" }
    assert_redirected_to passkeys_path
    follow_redirect!
    assert_select ".flash-alert", /is invalid/
    assert_nil user.reload.email
  end

  test "guests cannot update an account email" do
    patch account_path, params: { email: "reader@example.com" }
    assert_redirected_to new_session_path
  end
end
