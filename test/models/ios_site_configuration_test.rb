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

  test "AppIcon catalog is wired so CFBundleIconName is produced" do
    catalog = Rails.root.join("ios/Margin/Assets.xcassets")
    contents = JSON.parse(catalog.join("AppIcon.appiconset/Contents.json").read)

    assert catalog.directory?
    assert_includes pbxproj, "path = Assets.xcassets;"
    assert_includes pbxproj, "Assets.xcassets in Resources"
    assert_includes pbxproj, "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;"
    assert_includes info_plist, "<key>CFBundleIconName</key>"
    assert_includes info_plist, "<string>AppIcon</string>"
    assert(contents["images"].any? { |image| image["filename"] == "AppIcon-120.png" && image["size"] == "60x60" && image["scale"] == "2x" })
    assert(contents["images"].any? { |image| image["filename"] == "AppIcon-180.png" && image["size"] == "60x60" && image["scale"] == "3x" })
    assert(contents["images"].any? { |image| image["filename"] == "AppIcon-1024.png" && image["idiom"] == "ios-marketing" })
  end

  test "iPhone AppIcon PNGs exist at the sizes Apple validation named" do
    {
      "AppIcon-120.png" => 120,
      "AppIcon-180.png" => 180,
      "AppIcon-1024.png" => 1024
    }.each do |name, pixels|
      info = png_info(appiconset.join(name))
      assert_equal [pixels, pixels], [info[:width], info[:height]], name
      assert_equal 2, info[:color_type], "#{name} must be opaque RGB (no alpha)"
      refute info[:has_trns], "#{name} must not carry a tRNS chunk"
    end
  end

  test "iPhone-only target clears iPad icon and multitasking orientation errors" do
    assert_includes pbxproj, "TARGETED_DEVICE_FAMILY = 1;"
    refute_includes pbxproj, 'TARGETED_DEVICE_FAMILY = "1,2";'
    refute_includes pbxproj, "UIRequiresFullScreen"
    contents = JSON.parse(appiconset.join("Contents.json").read)
    refute(contents["images"].any? { |image| image["idiom"] == "ipad" })
  end

  test "haptic bridge component is wired without bumping the archive version" do
    delegate = Rails.root.join("ios/Margin/AppDelegate.swift").read
    assert_includes delegate, "HapticComponent.self"
    assert_includes pbxproj, "HapticComponent.swift in Sources"
    assert_includes pbxproj, "CURRENT_PROJECT_VERSION = 3;"
    refute_includes pbxproj, "CURRENT_PROJECT_VERSION = 4;"
  end

  test "version is 1.0 (3) without changing hosts, team, or bundle id" do
    assert_includes pbxproj, "CURRENT_PROJECT_VERSION = 3;"
    refute_includes pbxproj, "CURRENT_PROJECT_VERSION = 2;"
    assert_includes pbxproj, "MARKETING_VERSION = 1.0;"
    assert_includes pbxproj, %(MARGIN_BASE_URL = "#{LOCAL_HOST}")
    assert_includes pbxproj, %(MARGIN_BASE_URL = "#{PRODUCTION_HOST}")
    assert_equal 2, pbxproj.scan("PRODUCT_BUNDLE_IDENTIFIER = bible.margin.ios;").size
    assert_equal 2, pbxproj.scan("DEVELOPMENT_TEAM = 467UZHSCC3;").size
  end

  private

  def appiconset
    Rails.root.join("ios/Margin/Assets.xcassets/AppIcon.appiconset")
  end

  def png_info(path)
    data = path.binread
    assert data.start_with?("\x89PNG\r\n\x1A\n".b), "#{path} is not a PNG"
    type = data[12, 4]
    assert_equal "IHDR", type, "#{path} first chunk must be IHDR"
    width, height, _bit_depth, color_type = data[16, 10].unpack("NNC2")
    offset = 8
    has_trns = false
    while offset + 12 <= data.bytesize
      length = data[offset, 4].unpack1("N")
      chunk = data[offset + 4, 4]
      break if chunk == "IEND"
      has_trns = true if chunk == "tRNS"
      offset += 12 + length
    end
    { width: width, height: height, color_type: color_type, has_trns: has_trns }
  end
end
