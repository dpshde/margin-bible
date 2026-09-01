# frozen_string_literal: true

require "test_helper"

class FaviconControllerTest < ActionDispatch::IntegrationTest
  test "chapter and inbox pages use the outlined book favicon set" do
    get root_path
    assert_response :success
    assert_icon_links

    get read_path("jhn.1")
    assert_response :success
    assert_icon_links
  end

  test "static favicon files are served from public/" do
    %w[
      /favicon.ico
      /icon.svg
      /favicon-32.png
      /apple-touch-icon.png
      /icon-192.png
      /icon-512.png
      /icon-maskable.png
    ].each do |path|
      get path
      assert_response :success, path
      assert_operator response.body.bytesize, :>, 0, path
    end
  end

  private

  def assert_icon_links
    assert_select %(link[rel="icon"][href="/favicon.ico"])
    assert_select %(link[rel="icon"][href="/icon.svg"][type="image/svg+xml"])
    assert_select %(link[rel="icon"][href="/favicon-32.png"][sizes="32x32"])
    assert_select %(link[rel="apple-touch-icon"][href="/apple-touch-icon.png"])
  end
end
