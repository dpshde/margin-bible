# frozen_string_literal: true

require "test_helper"

class ReaderFontsTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "reading text uses Lexend and chrome uses Poppins" do
    assert_match(/--read:\s*"Lexend", system-ui, sans-serif/, css)
    assert_match(/--sans:\s*"Poppins", system-ui, sans-serif/, css)
    assert_match(/\.vtext\s*\{[^}]*font-family:\s*var\(--read\)/m, css)
    assert_match(/\.topbar-title\s*\{[^}]*font-family:\s*var\(--sans\)/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-family:\s*var\(--sans\)/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-weight:\s*600/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-size:\s*1\.45rem/m, css)
    assert_match(/\.vtext\s*\{[^}]*font-size:\s*var\(--read-size\)/m, css)
    assert_match(/\.vtext\s*\{[^}]*font-weight:\s*400/m, css)
    assert_no_match(/Iowan|Palatino|--serif/, css)
    refute_match(/\.section-head\s*\{[^}]*font-style:\s*italic/m, css)
  end

  test "root type scale is a touch smaller than browser default" do
    assert_match(/^html \{ font-size: 95%; \}$/, css)
  end
end
