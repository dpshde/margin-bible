# frozen_string_literal: true

require "test_helper"

class FaviconTest < ActiveSupport::TestCase
  test "source is Dylan's open-book PNG, not an SVG glyph" do
    png = png_info(Rails.root.join("app/assets/images/open-book-icon.png"))

    assert_equal [ 192, 192 ], [ png[:width], png[:height] ]
    assert_equal 6, png[:color_type], "source PNG must keep a transparent background"
    refute File.exist?(Rails.root.join("app/assets/images/open-book-icon.svg"))
    refute File.exist?(Rails.root.join("public/icon.svg"))
  end

  test "public icons are the sizes the layout and PWA manifest expect" do
    {
      "favicon-32.png" => [ 32, 6 ],
      "icon-192.png" => [ 192, 6 ],
      "icon-512.png" => [ 512, 6 ],
      "icon.png" => [ 32, 6 ],
      "apple-touch-icon.png" => [ 180, 2 ]
    }.each do |name, (pixels, color_type)|
      info = png_info(Rails.root.join("public", name))
      assert_equal [ pixels, pixels ], [ info[:width], info[:height] ], name
      assert_equal color_type, info[:color_type], "#{name} color type"
      refute info[:has_trns] if color_type == 2
    end

    ico = Rails.root.join("public/favicon.ico").binread
    assert ico.start_with?("\x00\x00\x01\x00".b)
    assert_equal 2, ico[4, 2].unpack1("v")
  end

  test "maskable PWA icon is an opaque 512 square generated onto dark paper" do
    info = png_info(Rails.root.join("public/icon-maskable.png"))
    assert_equal [ 512, 512 ], [ info[:width], info[:height] ]
    assert_equal 2, info[:color_type], "maskable icon must be opaque RGB, not a white-backed web glyph"
    refute info[:has_trns]
    assert_includes Rails.root.join("script/generate-icons").read, "DARK = (26, 24, 22)"
  end

  test "generator reads the PNG source rather than inventing an SVG glyph" do
    script = Rails.root.join("script/generate-icons").read
    assert_includes script, "open-book-icon.png"
    assert_includes script, "def loadSource"
    refute_includes script, "renderSvg"
    assert_includes script, "leftoverSvg"
  end

  test "write-dylan-favicon.py embeds ICO pixels and refuses SVG drawing" do
    script = Rails.root.join("script/write-dylan-favicon.py").read
    assert_includes script, "ICO ="
    refute_includes script, "<svg"
    refute_includes script, "ImageDraw"
    status = system("python3", Rails.root.join("script/write-dylan-favicon.py").to_s, "--self-test")
    assert status, "write-dylan-favicon.py --self-test failed"
  end

  test "PWA manifest points at the outlined book PNGs" do
    manifest = Rails.root.join("app/views/pwa/manifest.json.erb").read

    assert_includes manifest, "/icon-192.png"
    assert_includes manifest, "/icon-512.png"
    assert_includes manifest, "/icon-maskable.png"
    assert_includes manifest, '"purpose": "maskable"'
    refute_match(/"src": "\/icon\.png"/, manifest)
  end

  private

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
