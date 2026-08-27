# frozen_string_literal: true

require "test_helper"

class Sessions::PasskeyRegistrationsControllerTest < ActionDispatch::IntegrationTest
  test "create a passkey from sign-in claims the cookie library without an email" do
    get root_path
    library = Library.last

    get new_session_path
    challenge = refresh_webauthn_challenge(purpose: "registration")
    raw = webauthn_client.create(challenge: challenge)
    post session_passkey_registration_path, params: passkey_registration_params_from(raw)

    assert_redirected_to root_path
    user = User.last
    assert_nil user.email
    assert_equal 1, user.passkeys.count
    library.reload
    assert_equal user, library.user

    follow_redirect!
    assert_select "header.topbar details.topbar-menu a.menu-item", "Passkeys"

    delete session_path
    get new_session_path
    challenge = refresh_webauthn_challenge(purpose: "authentication")
    assertion = webauthn_client.get(challenge: challenge)
    post session_passkey_path, params: passkey_authentication_params_from(assertion)

    assert_redirected_to root_path
    assert_equal user, library.reload.user

    patch account_path, params: { email: "reader@example.com" }
    assert_equal "reader@example.com", user.reload.email

    delete session_path
    get new_session_path
    challenge = refresh_webauthn_challenge(purpose: "authentication")
    assertion = webauthn_client.get(challenge: challenge)
    post session_passkey_path, params: passkey_authentication_params_from(assertion)
    assert_redirected_to root_path
    assert_equal user, library.reload.user
    assert_equal "reader@example.com", user.reload.email
  end

  test "heb.11 passkey claim survives sign-out and the same passkey" do
    get root_path
    library = Library.last

    get new_session_path
    assert_select ".auth-passkey-use[hidden] button[hidden][data-passkey='sign_in']", "Use a passkey"
    assert_select ".auth-passkey-create:not([hidden]) button.text-btn[data-passkey='register']", "Create a passkey"

    challenge = refresh_webauthn_challenge(purpose: "registration")
    raw = webauthn_client.create(challenge: challenge)
    post session_passkey_registration_path, params: passkey_registration_params_from(raw).merge(
      pack: {
        notes: {
          "heb.11.1" => {
            "slug" => "heb.11.1",
            "blocks" => [ { "id" => "b_faith", "indent" => 0, "text" => "Faith is the assurance." } ]
          }
        }
      }.to_json
    )

    assert_redirected_to root_path
    user = User.last
    library.reload
    assert_equal user, library.user
    assert_equal "Faith is the assurance.", library.notes.find_by!(slug: "heb.11.1").blocks[0]["text"]

    delete session_path
    assert_redirected_to root_path
    follow_redirect!
    assert_select "[data-inbox-signed-in-value='false']"
    assert_select "header.topbar details.topbar-menu a.menu-item", "Sign in"

    get new_session_path
    assert_select ".auth-passkey-use[hidden] button[hidden][data-passkey='sign_in']", "Use a passkey"
    assert_select ".auth-passkey-create:not([hidden]) button.text-btn[data-passkey='register']", "Create a passkey"
    assert_no_match(/I already have a passkey/, response.body)
    assert_no_match(/Create a new passkey/, response.body)

    challenge = refresh_webauthn_challenge(purpose: "authentication")
    assertion = webauthn_client.get(challenge: challenge)
    post session_passkey_path, params: passkey_authentication_params_from(assertion)

    assert_redirected_to root_path
    assert_equal user, User.find(user.id)
    library.reload
    assert_equal user, library.user
    assert_equal "Faith is the assurance.", library.notes.find_by!(slug: "heb.11.1").blocks[0]["text"]
    assert_equal 1, User.count
    assert_equal [ library.id ], user.libraries.order(:id).pluck(:id)
  end

  test "passkey-first claim imports guest pack notes without absorbing slugs" do
    get root_path
    library = Library.last
    library.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ { "id" => "b_srv", "indent" => 0, "text" => "Server stays." } ]
    )

    get new_session_path
    challenge = refresh_webauthn_challenge(purpose: "registration")
    raw = webauthn_client.create(challenge: challenge)
    post session_passkey_registration_path, params: passkey_registration_params_from(raw).merge(
      pack: {
        notes: {
          "jhn.1.1" => { "slug" => "jhn.1.1", "blocks" => [ { "id" => "b_g1", "indent" => 0, "text" => "Guest should not win." } ] },
          "jhn.1.1-3" => { "slug" => "jhn.1.1-3", "blocks" => [ { "id" => "b_g2", "indent" => 0, "text" => "Range thought." } ] },
          "jhn.3.16" => { "slug" => "jhn.3.16", "blocks" => [ { "id" => "b_g3", "indent" => 0, "text" => "   " } ] }
        }
      }.to_json
    )

    assert_redirected_to root_path
    library.reload
    assert_equal "Server stays.", library.notes.find_by!(slug: "jhn.1.1").blocks[0]["text"]
    range = library.notes.find_by!(slug: "jhn.1.1-3")
    assert_equal "range", range.kind
    assert_equal "Range thought.", range.blocks[0]["text"]
    assert_nil library.notes.find_by(slug: "jhn.3.16")
    assert_equal library.user, User.last
  end

  test "empty guest pack is a no-op on passkey-first claim" do
    get root_path
    library = Library.last

    get new_session_path
    challenge = refresh_webauthn_challenge(purpose: "registration")
    raw = webauthn_client.create(challenge: challenge)
    post session_passkey_registration_path, params: passkey_registration_params_from(raw).merge(
      pack: { notes: {} }.to_json
    )

    assert_redirected_to root_path
    assert_equal 0, library.notes.count
    assert_equal library.reload.user, User.last
  end

  test "signed-in users add more keys on /passkeys instead of creating another user" do
    user = User.create!(email: "reader@example.com")
    claim_as(user)
    assert_no_difference("User.count") do
      post session_passkey_registration_path, params: {
        passkey: { id: "nope", client_data_json: "e30", attestation_object: "e30" }
      }
    end
    assert_redirected_to passkeys_path
  end
end
