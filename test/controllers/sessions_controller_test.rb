# frozen_string_literal: true

require "test_helper"

class SessionsControllerTest < ActionDispatch::IntegrationTest
  test "sign-in page is email first with a quiet passkey path" do
    get new_session_path
    assert_response :success
    assert_select "header.topbar a[aria-label='Notes'][href='/']"
    assert_select "h1.topbar-title", "Sign in"
    assert_select "main.page > h1", "Get into Margin"
    assert_select "header.topbar .theme-seg", count: 0
    assert_select "header.topbar details.topbar-menu button.menu-item[data-theme-pref='system']", "System"
    assert_select "input[name='email'][autocomplete='username webauthn'][placeholder='you@example.com']"
    assert_select ".auth-help", /New here\?/
    assert_select ".auth-help", /Already have an account\?/
    assert_select ".auth-help button.text-btn[data-action='sign-in#startRegistration']", "Create a passkey"
    assert_select "button.primary", "Let's go"
    assert_select "rails-passkey-sign-in-button[mediation='conditional']"
    assert_select "rails-passkey-sign-in-button[options*='client-device']"
    assert_select "rails-passkey-sign-in-button[auto-start]"
    assert_select ".auth-passkey-use:not([hidden]) button.text-btn[data-passkey='sign_in']", "Sign in with a passkey"
    assert_select ".auth-passkey-create[hidden][data-sign-in-target='register'] button[hidden][data-passkey='register']", "Create a passkey"
    assert_select ".passkey-error[hidden]", count: 5
    assert_select ".passkey-error:not([hidden])", count: 0
    assert_select "button.primary[data-passkey]", count: 0
    assert_select "button.secondary", count: 0
    assert_select "button.auth-passkey-switch", count: 0
    assert_no_match(/I already have a passkey/, response.body)
    assert_no_match(/Create a new passkey/, response.body)
    assert_no_match(/Waiting for your passkey/, response.body)
    assert_no_match(/Nothing popped up/, response.body)
    assert_no_match(/Use a passkey/, response.body)
    assert_select "a", text: "Back to notes", count: 0
    assert_select "p.auth-or", count: 0
    body = response.body
    assert_operator body.index("Get into Margin"), :<, body.index("you@example.com")
    assert_operator body.index("you@example.com"), :<, body.index("New here?")
    assert_operator body.index("New here?"), :<, body.index("Let's go")
    assert_operator body.index("Let's go"), :<, body.index("Sign in with a passkey")
  end

  test "magic link claims the current library" do
    get root_path
    library = Library.last
    post session_path, params: { email: "reader@example.com" }
    assert_redirected_to new_session_path
    follow_redirect!
    assert_select ".flash", text: "Check your email."
    assert_select "a.primary", "Open sign-in link"
    assert_no_match(/Check your email — or open/, response.body)

    link = MagicLink.last
    get magic_login_path(link.token)
    assert_redirected_to root_path
    library.reload
    assert_equal "reader@example.com", library.user.email

    follow_redirect!
    assert_select "header.topbar a.ghost.quiet", text: "Passkeys", count: 0
    assert_select "header.topbar details.topbar-menu a.menu-item", "Passkeys"
    assert_select "header.topbar details.topbar-menu button.menu-item", "Sign out"
    assert_not_nil cookies[:library_id]
  end

  test "library cookie restores the claimed user on a later visit" do
    get root_path
    post session_path, params: { email: "reader@example.com" }
    get magic_login_path(MagicLink.last.token)
    follow_redirect!

    get read_path("jhn.1")
    assert_response :success
    assert_select "[data-reader-signed-in-value='true']"
    get root_path
    assert_select "header.topbar details.topbar-menu button.menu-item", "Sign out"
  end

  test "sign out drops the library cookie so the next visit is a guest" do
    get root_path
    post session_path, params: { email: "reader@example.com" }
    get magic_login_path(MagicLink.last.token)
    follow_redirect!

    delete session_path
    assert_redirected_to root_path
    follow_redirect!
    assert_select "header.topbar details.topbar-menu a.menu-item", "Sign in"
    assert_select "header.topbar a.ghost.quiet", text: "Sign in", count: 0
    get read_path("jhn.1")
    assert_select "[data-reader-signed-in-value='false']"
  end
end
