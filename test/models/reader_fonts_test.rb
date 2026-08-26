# frozen_string_literal: true

require "test_helper"

class ReaderFontsTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "reading text uses Source Serif 4 and chrome uses Poppins" do
    assert_match(/--read:\s*"Source Serif 4", "Iowan Old Style", Palatino, serif/, css)
    assert_match(/--sans:\s*"Poppins", system-ui, sans-serif/, css)
    assert_match(/--page-max:\s*36em/, css)
    assert_match(/html\[data-face="deca"\]\s*\{[^}]*--read:\s*"Lexend Deca"/m, css)
    assert_match(/\.vtext\s*\{[^}]*font-family:\s*var\(--read\)/m, css)
    assert_match(/\.topbar-title\s*\{[^}]*font-family:\s*var\(--sans\)/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-family:\s*var\(--sans\)/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-weight:\s*600/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-size:\s*1\.45rem/m, css)
    assert_match(/\.vtext\s*\{[^}]*font-size:\s*var\(--read-size\)/m, css)
    assert_match(/\.vtext\s*\{[^}]*font-weight:\s*400/m, css)
    refute_match(/--read:\s*"Lexend",/, css)
    refute_match(/\.section-head\s*\{[^}]*font-style:\s*italic/m, css)
  end

  test "root type scale is a touch smaller than browser default" do
    assert_match(/^html \{ font-size: 95%; \}$/, css)
  end

  test "layout loads Source Serif 4 and Deca without Lexend 300" do
    layout = Rails.root.join("app/views/layouts/application.html.erb").read
    assert_match(/family=Source\+Serif\+4/, layout)
    assert_match(/family=Lexend\+Deca/, layout)
    assert_match(/family=Poppins/, layout)
    refute_match(/family=Lexend:wght@300/, layout)
    assert_match(/data-face/, layout)
  end
end
