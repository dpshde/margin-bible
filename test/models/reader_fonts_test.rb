# frozen_string_literal: true

require "test_helper"

class ReaderFontsTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "reading text uses Source Serif 4 and chrome uses Poppins" do
    assert_match(/--read:\s*"Source Serif 4", "Iowan Old Style", Palatino, serif/, css)
    assert_match(/--sans:\s*"Poppins", system-ui, sans-serif/, css)
    assert_match(/--head:\s*"Lexend", system-ui, sans-serif/, css)
    assert_match(/--page-max:\s*36em/, css)
    refute_match(/html\[data-face="deca"\]/, css)
    refute_match(/Lexend Deca/, css)
    assert_match(/\.vtext\s*\{[^}]*font-family:\s*var\(--read\)/m, css)
    assert_match(/\.topbar-title\s*\{[^}]*font-family:\s*var\(--head\)/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-family:\s*var\(--head\)/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-weight:\s*600/m, css)
    assert_match(/\.section-head\s*\{[^}]*font-size:\s*1\.45rem/m, css)
    assert_match(/\.section-sub\s*\{[^}]*font-family:\s*var\(--head\)/m, css)
    assert_match(/\.inbox-day\s*\{[^}]*font-family:\s*var\(--head\)/m, css)
    assert_match(/\.vtext\s*\{[^}]*font-size:\s*var\(--read-size\)/m, css)
    assert_match(/\.vtext\s*\{[^}]*font-weight:\s*400/m, css)
    refute_match(/--read:\s*"Lexend",/, css)
    refute_match(/\.vtext\s*\{[^}]*font-family:\s*var\(--head\)/m, css)
    refute_match(/\.pub-p, \.pub-q1, \.pub-q2\s*\{[^}]*font-family:\s*var\(--head\)/m, css)
    refute_match(/\.section-head\s*\{[^}]*font-style:\s*italic/m, css)
  end

  test "section headings use Lexend" do
    head = css[/\n\.section-head\s*\{[^}]+\}/]
    assert head
    assert_match(/font-family:\s*var\(--head\)/, head)
    assert_match(/--head:\s*"Lexend", system-ui, sans-serif/, css)
    refute_match(/\.section-head\s*\{[^}]*font-family:\s*var\(--read\)/m, css)
  end

  test "root type scale is a touch smaller than browser default" do
    assert_match(/^html \{ font-size: 95%; \}$/, css)
  end

  test "layout loads Source Serif 4 without Deca" do
    layout = Rails.root.join("app/views/layouts/application.html.erb").read
    assert_match(/family=Source\+Serif\+4/, layout)
    refute_match(/family=Lexend\+Deca/, layout)
    assert_match(/family=Poppins/, layout)
    assert_match(/family=Lexend:wght@500;600;700/, layout)
    refute_match(/family=Lexend:wght@300/, layout)
    assert_match(/data-face/, layout)
    refute_match(/face !== "serif" && face !== "deca"/, layout)
    assert_match(/if \(face !== "serif"\) face = "serif"/, layout)
  end

  test "layout loads Fathom once with site EMYGRIAR" do
    layout = Rails.root.join("app/views/layouts/application.html.erb").read
    assert_match(
      /<!-- Fathom - beautiful, simple website analytics -->\s*<script src="https:\/\/cdn\.usefathom\.com\/script\.js" data-site="EMYGRIAR" defer><\/script>\s*<!-- \/ Fathom -->/m,
      layout
    )
    assert_equal 1, layout.scan("cdn.usefathom.com/script.js").size
    assert_equal 1, layout.scan('data-site="EMYGRIAR"').size
    refute_match(/gtag|plausible|umami|analytics\.js/, layout)
  end
end
