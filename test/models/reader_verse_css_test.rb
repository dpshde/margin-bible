# frozen_string_literal: true

require "test_helper"

class ReaderVerseCssTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "open verse is a thin rail, not a filled rounded island" do
    refute_match(/\.verse\.is-open[^{]*\{[^}]*background:/m, css)
    refute_match(/\.verse\.is-span[^{]*\{[^}]*background:/m, css)
    refute_match(/\.verse\.is-span \.vtext\s*\{[^}]*background:/m, css)
    refute_match(/--mark-fill/, css)
    assert_match(/\.verse\.is-span \.vtext\s*\{[^}]*color:/m, css)
    has_note = css[/\.verse\.has-note\s*\{[^}]+\}/]
    assert_match(/border-left:/, has_note)
    refute_match(/background:/, has_note)
    refute_match(/border-radius:/, has_note)
  end

  test "phone verse number column is narrow" do
    phone = css[/@media \(max-width: 390px\)\s*\{[\s\S]*?\n\}/]
    assert phone
    assert_match(/--verse-gutter:\s*1\.05rem/, phone)
    assert_match(/--verse-gutter-gap:\s*\.45rem/, phone)
    assert_match(/\.verse\s*\{[^}]*padding-left:\s*\.2rem/m, phone)
  end

  test "hiding verse numbers drops the gutter and the digits" do
    assert_match(/\.is-nums-hidden \.vnum\s*\{\s*display:\s*none/, css)
    assert_match(/\.is-nums-hidden \.verse-press\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/, css)
    assert_match(/\.is-nums-hidden \.verse\s*\{[^}]*--verse-gutter:\s*0px/m, css)
  end

  test "note tray shares the verse text column" do
    assert_match(/--verse-gutter:\s*1\.4rem/, css)
    assert_match(/grid-template-columns:\s*var\(--verse-gutter\) 1fr/, css)
    assert_match(/\.note-card,\s*\.verse > \.note-tray\s*\{[^}]*margin-left:\s*calc\(var\(--verse-gutter\) \+ var\(--verse-gutter-gap\)\)/m, css)
    refute_match(/\.note-tray, \.chapter-tray \{ padding: \.2rem \.2rem/, css)
  end
end
