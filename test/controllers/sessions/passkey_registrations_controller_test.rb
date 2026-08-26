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
