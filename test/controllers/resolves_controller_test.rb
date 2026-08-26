# frozen_string_literal: true

require "test_helper"

class ResolvesControllerTest < ActionDispatch::IntegrationTest
  test "resolve q redirects to the canonical slug" do
    get resolve_path, params: { q: "John 3:16" }
    assert_redirected_to read_path("jhn.3.16")
  end

  test "go q is the inbound door from route.bible" do
    get "/go", params: { q: "John 3:16-18" }
    assert_redirected_to read_path("jhn.3.16-18")
  end

  test "go osis expands a verse slug" do
    get "/go", params: { osis: "JHN.1.16" }
    assert_redirected_to read_path("jhn.1.16")
  end

  test "unresolvable go falls back to John 1" do
    get "/go", params: { q: "not-a-passage" }
    assert_redirected_to read_path("jhn.1")
  end
end
