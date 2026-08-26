# frozen_string_literal: true

require "test_helper"

class ReaderTypeCssTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "reading column and body measure follow the type brief" do
    assert_match(/--ink:\s*#1c1917/, css)
    assert_match(/--paper:\s*#f6f5f2/, css)
    assert_match(/--read-size:\s*1\.25rem/, css)
    assert_match(/--read-leading:\s*1\.65/, css)
    refute_match(/--ink:\s*#000/, css)
    refute_match(/--paper:\s*#000/, css)
    refute_match(/--ink:\s*#161616/, css)
    assert_match(/\.pub-p, \.pub-q1, \.pub-q2\s*\{[^}]*font-size:\s*var\(--read-size\)/m, css)
    assert_match(/\.vtext\s*\{[^}]*letter-spacing:\s*0/, css)
    refute_match(/text-align:\s*justify/, css)
  end

  test "Jesus words are italic body color not rust" do
    wj = css[/\n\.wj\s*\{[^}]+\}/]
    assert wj
    assert_match(/color:\s*inherit/, wj)
    assert_match(/font-style:\s*italic/, wj)
    refute_match(/#9a3b32/, css)
    refute_match(/#e0a39c/, css)
  end

  test "paragraph indent skips the first after a heading and skips trays" do
    assert_match(/\.section-head \+ \.pub-p,\s*\n\.section-head \+ \.pub-r \+ \.pub-p\s*\{[^}]*text-indent:\s*0/m, css)
    assert_match(/\.pub-p \+ \.pub-p\s*\{[^}]*text-indent:\s*1\.2em/, css)
    assert_match(/\.pub-p \.otext,\s*\n\.pub-q1 \.otext,\s*\n\.pub-q2 \.otext\s*\{[^}]*text-indent:\s*0/, css)
    assert_match(/\.note-tray:not\(\[hidden\]\)\s*\{\s*display:\s*block/, css)
    assert_match(/\.note-tray\[hidden\]\s*\{\s*display:\s*none !important/, css)
  end

  test "pericope titles are lighter with air above" do
    head = css[/\n\.section-head\s*\{[^}]+\}/]
    assert head
    assert_match(/font-weight:\s*600/, head)
    assert_match(/font-size:\s*1\.45rem/, head)
    assert_match(/letter-spacing:\s*\.01em/, head)
    refute_match(/font-weight:\s*700/, head)
    refute_match(/font-weight:\s*800/, head)
    assert_match(/\.section-head\.spaced\s*\{[^}]*margin-top:\s*2\.25em/, css)
  end
end
