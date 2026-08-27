# frozen_string_literal: true

require "test_helper"

class OauthAccessTokenTest < ActiveSupport::TestCase
  test "authenticate only returns a live notes:read token for its library" do
    user = User.create!(email: "reader@example.com")
    library = Library.create!(user: user)
    other = Library.create!(user: User.create!(email: "other@example.com"))
    raw = issue_library_token(library, user: user)
    token = OauthAccessToken.authenticate(raw)
    assert_equal library, token.library
    refute_equal other, token.library
    assert token.read_only?
    assert_nil OauthAccessToken.authenticate("mb_missing")
  end

  test "refresh rotates and revoke stops use" do
    user = User.create!(email: "reader@example.com")
    library = Library.create!(user: user)
    client = OauthClient.create!(uid: SecureRandom.uuid, name: "A", redirect_uris: [ "http://127.0.0.1/cb" ])
    record, access, refresh = OauthAccessToken.issue!(client: client, library: library, user: user, scopes: "notes:read")
    rotated, new_access, = OauthAccessToken.refresh(refresh)
    assert rotated.present?
    assert_nil OauthAccessToken.authenticate(access)
    assert OauthAccessToken.authenticate(new_access)
    record.reload
    assert record.revoked_at.present?
  end
end
