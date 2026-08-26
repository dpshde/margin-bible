# frozen_string_literal: true

require "test_helper"

class HotwireNativeConfigurationControllerTest < ActionDispatch::IntegrationTest
  test "serves the iOS path configuration" do
    get "/configurations/ios_v1.json"
    assert_response :success
    body = JSON.parse(response.body)
    assert_kind_of Hash, body["settings"]
    assert body["rules"].any? { |rule| rule["patterns"].any? { |pattern| pattern.include?("[a-z]") } }
  end
end
