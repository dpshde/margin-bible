# frozen_string_literal: true

require "test_helper"

class Oauth::ConnectionsControllerTest < ActionDispatch::IntegrationTest
  test "signed-in user can list and revoke agents on their library" do
    _user, library = claim_library
    token = issue_library_token(library, user: library.user, name: "Cursor")
    get oauth_connections_path
    assert_response :success
    assert_select "h1", "Connected agents"
    assert_select "li", /Cursor/
    assert_select "li", /notes:read/

    access = OauthAccessToken.authenticate(token)
    delete oauth_connection_path(access)
    assert_redirected_to oauth_connections_path
    assert_nil OauthAccessToken.authenticate(token)
  end

  test "guests cannot review connections" do
    get oauth_connections_path
    assert_redirected_to new_session_path
  end
end
