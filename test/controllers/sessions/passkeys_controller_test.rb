# frozen_string_literal: true

require "test_helper"

class Sessions::PasskeysControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "reader@example.com")
  end

  test "passkey sign-in claims the user's library" do
    claim_as(@user)
    library = Library.last
    challenge = refresh_webauthn_challenge(purpose: "registration")
    raw = webauthn_client.create(challenge: challenge)
    post passkeys_path, params: passkey_registration_params_from(raw)
    assert_equal 1, @user.passkeys.count

    delete session_path
    get root_path
    assert_select "header.topbar details.topbar-menu a.menu-item", "Sign in"

    get new_session_path
    challenge = refresh_webauthn_challenge(purpose: "authentication")
    assertion = webauthn_client.get(challenge: challenge)
    post session_passkey_path, params: passkey_authentication_params_from(assertion)

    assert_redirected_to root_path
    library.reload
    assert_equal @user, library.user

    follow_redirect!
    assert_select "header.topbar a.ghost.quiet", text: "Passkeys", count: 0
    assert_select "header.topbar details.topbar-menu a.menu-item", "Passkeys"
  end

  test "a bad assertion stays on the sign-in page" do
    post session_passkey_path, params: {
      passkey: {
        id: "nope",
        client_data_json: "e30",
        authenticator_data: "e30",
        signature: "e30"
      }
    }
    assert_redirected_to new_session_path
  end
end
