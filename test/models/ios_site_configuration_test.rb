# frozen_string_literal: true

require "test_helper"

class IosSiteConfigurationTest < ActiveSupport::TestCase
  PRODUCTION_HOST = "https://web-production-0b88ca.up.railway.app"
  LOCAL_HOST = "http://localhost:3000"

  def site_swift
    Rails.root.join("ios/Margin/Site.swift").read
  end

  def info_plist
    Rails.root.join("ios/Margin/Info.plist").read
  end

  def pbxproj
    Rails.root.join("ios/Margin.xcodeproj/project.pbxproj").read
  end

  test "Release fallback and build setting point at Railway production" do
    assert_includes site_swift, %(static let production = URL(string: "#{PRODUCTION_HOST}")!)
    refute_includes site_swift, "https://margin.bible"
    assert_includes pbxproj, %(MARGIN_BASE_URL = "#{PRODUCTION_HOST}")
  end

  test "Debug stays on localhost" do
    assert_includes site_swift, %(static let local = URL(string: "#{LOCAL_HOST}")!)
    assert_match(/#if DEBUG\s+return local/m, site_swift)
    assert_includes pbxproj, %(MARGIN_BASE_URL = "#{LOCAL_HOST}")
  end

  test "Info.plist reads MARGIN_BASE_URL from the build setting" do
    assert_includes info_plist, "<key>MARGIN_BASE_URL</key>"
    assert_includes info_plist, "<string>$(MARGIN_BASE_URL)</string>"
    refute_includes info_plist, "https://margin.bible"
  end

  test "archive identity is bible.margin.ios on iOS 16 with team 467UZHSCC3" do
    assert_includes pbxproj, "PRODUCT_BUNDLE_IDENTIFIER = bible.margin.ios;"
    assert_includes pbxproj, "IPHONEOS_DEPLOYMENT_TARGET = 16.0;"
    assert_includes pbxproj, "DEVELOPMENT_TEAM = 467UZHSCC3;"
    assert_includes pbxproj, "CODE_SIGN_STYLE = Automatic;"
  end
end
