# frozen_string_literal: true

require "test_helper"

class HotwireNativePathConfigurationTest < ActiveSupport::TestCase
  def remote_json
    Rails.public_path.join("configurations/ios_v1.json").read
  end

  def bundled_json
    Rails.root.join("ios/Margin/path-configuration.json").read
  end

  def config
    JSON.parse(remote_json)
  end

  test "uses current Hotwire Native settings and rules keys" do
    assert_kind_of Hash, config["settings"]
    assert_kind_of Array, config["rules"]
    assert config["rules"].all? { |rule| rule["patterns"].is_a?(Array) && rule["properties"].is_a?(Hash) }
  end

  test "chapter OSIS routes are web screens that advance the native stack" do
    chapter = config["rules"].find { |rule| rule["patterns"].any? { |pattern| pattern.include?("[a-z]") } }
    assert chapter, "expected an OSIS chapter pattern"
    assert_match(Regexp.new(chapter["patterns"].first), "/jhn.1")
    assert_match(Regexp.new(chapter["patterns"].first), "/jhn.1.3-7")
    assert_match(Regexp.new(chapter["patterns"].first), "/luk.24")
    assert_equal "default", chapter.dig("properties", "context")
    assert_equal "default", chapter.dig("properties", "presentation")
    assert_nil chapter.dig("properties", "view_controller")
  end

  test "bundled iOS path configuration matches the served file" do
    assert_equal JSON.parse(remote_json), JSON.parse(bundled_json)
  end
end
