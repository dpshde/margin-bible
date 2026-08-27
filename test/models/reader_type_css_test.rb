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
    assert_match(/--page-max:\s*36em/, css)
    refute_match(/data-face="deca"/, css)
    refute_match(/Lexend Deca/, css)
  end

  test "Jesus words are italic body color not rust" do
    wj = css[/\n\.wj\s*\{[^}]+\}/]
    assert wj
    assert_match(/color:\s*inherit/, wj)
    assert_match(/font-style:\s*italic/, wj)
    refute_match(/#9a3b32/, css)
    refute_match(/#e0a39c/, css)
  end

  test "regular mode is a flush verse list with a gap between paragraph units" do
    after_head = css[/\n\.section-head \+ \.pub-p,\s*\n\.section-head \+ \.pub-r \+ \.pub-p\s*\{[^}]+\}/]
    assert after_head
    assert_match(/text-indent:\s*0/, after_head)
    assert_match(/margin-top:\s*0/, after_head)
    refute_match(/text-indent:\s*1\.2em/, after_head)
    refute_match(/\.section-head \+ \.pub-p > \.verse:first-child \.verse-press > \.vtext/, css)
    refute_match(/\.pub-p \+ \.pub-p > \.verse:first-child \.verse-press > \.vtext/, css)
    follow = css[/\n\.pub-p \+ \.pub-p\s*\{[^}]+\}/]
    assert follow
    assert_match(/text-indent:\s*0/, follow)
    assert_match(/margin-top:\s*\.65em/, follow)
    refute_match(/text-indent:\s*1\.2em/, follow)
    assert_match(/\.pub-q1, \.pub-q2\s*\{[^}]*text-indent:\s*0/, css)
    refute_match(/\.pub-q1\s*\{[^}]*text-indent:\s*-\.4rem/, css)
    refute_match(/\.pub-q2\s*\{[^}]*text-indent:\s*-\.4rem/, css)
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
    assert_match(/margin:\s*0 0 \.85em/, head)
    refute_match(/margin:\s*0 0 1\.15em/, head)
    assert_match(/\.section-head:has\(\+ \.pub-r\)\s*\{\s*margin-bottom:\s*\.08em/, css)
    assert_match(/\.section-head \+ \.pub-r\s*\{\s*margin-top:\s*0/, css)
    assert_match(/\.is-quiet \.section-head:has\(\+ \.pub-r\)\s*\{\s*margin-bottom:\s*\.85em/, css)
    assert_match(/\.is-quiet \.pub-r\s*\{[^}]*display:\s*none/, css)
    refute_match(/\.note-tray\s*\{[^}]*margin-top:\s*1\.15em/, css)
  end
end
