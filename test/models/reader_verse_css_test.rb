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
    assert_match(/--verse-inset:\s*\.2rem/, phone)
    assert_match(/padding-left:\s*var\(--verse-inset\)/, phone)
  end

  test "header copy flashes a check when pressed" do
    assert_match(/\.header-copy-button\.is-copied \.copy-done/, css)
    assert_match(/@keyframes copy-confirm/, css)
  end

  test "quiet reading hides the note rail and selection chrome" do
    rail = css[/\.is-quiet \.rail,\s*\.is-quiet \.note-card:not\(:has\(\.note-tray:not\(\[hidden\]\)\)\),\s*\.is-quiet \.note-tray\[hidden\],\s*\.is-quiet \.tray-head,\s*\.is-quiet \.oindent\s*\{[^}]+\}/]
    assert rail
    assert_match(/display:\s*none/, rail)
    assert_match(/\.is-quiet \.chapter-tray\s*\{\s*display:\s*none/, css)
    quiet = css[/\.is-quiet \.verse\.has-note,\s*\.is-quiet \.verse\.is-open,\s*\.is-quiet \.verse\.is-span\s*\{[^}]+\}/]
    assert quiet
    assert_match(/border(?:-left)?:\s*0/, quiet)
    refute_match(/border-left-color:/, quiet)
  end

  test "quiet reading is a USFM paragraph, not a verse card stack" do
    assert_match(/\.pub-p\s*\{\s*display:\s*contents/, css)
    para = css[/\.is-quiet \.pub-p\s*\{[^}]+\}/]
    assert para
    assert_match(/display:\s*block/, para)
    verse = css[/\.is-quiet \.verse\s*\{[^}]+\}/]
    assert verse
    assert_match(/display:\s*contents/, verse)
    assert_match(/padding:\s*0/, verse)
    refute_match(/margin-bottom:\s*[1-9]/, verse)
    press = css[/\.is-quiet \.verse-press\s*\{[^}]+\}/]
    assert press
    assert_match(/display:\s*contents/, press)
    vtext = css[/\.is-quiet \.vtext\s*\{[^}]+\}/]
    assert vtext
    assert_match(/display:\s*inline/, vtext)
    assert_match(/font-size:\s*max\(16px/, vtext)
    head = css[/\.is-quiet \.section-head\s*\{[^}]+\}/]
    assert head
    assert_match(/display:\s*block/, head)
    vnum = css[/\.is-quiet \.vnum\s*\{[^}]+\}/]
    assert vnum
    assert_match(/vertical-align:\s*super/, vnum)
    assert_match(/display:\s*inline/, vnum)
    otext = css[/\.is-quiet \.otext\s*\{[^}]+\}/]
    assert otext
    assert_match(/background:\s*transparent/, otext)
    assert_match(/border:\s*0/, otext)
    assert_match(/\.is-quiet \.outliner\s*\{/, css)
  end

  test "quiet reading hides trail pointers" do
    assert_match(/\.is-quiet \.trail-inline/, css)
    assert_match(/\.is-quiet \.dock-recent/, css)
    assert_match(/\.is-quiet \.dock-recent \+ \.dock-sep/, css)
  end

  test "quiet reading keeps chapter text below the pill" do
    quiet_reader = css[/\.is-quiet \.reader\s*\{[^}]+\}/]
    assert quiet_reader
    assert_match(/padding-top:\s*calc\(4\.25rem \+ env\(safe-area-inset-top, 0px\)\)/, quiet_reader)
  end

  test "quiet header becomes a pill that can tuck" do
    pill = css[/\.is-quiet \.topbar\s*\{[^}]+\}/]
    assert pill
    assert_match(/position:\s*fixed/, pill)
    assert_match(/border-radius:\s*999px/, pill)
    assert_match(/overflow:\s*hidden/, pill)
    assert_match(/left:\s*\.7rem/, pill)
    assert_match(/right:\s*\.7rem/, pill)
    refute_match(/100vw/, pill)
    assert_match(/\.is-quiet \.topbar\.is-tucked/, css)
    assert_match(/\.is-quiet \.header-copy-button,/, css)
    btn = css[/\.is-quiet \.topbar \.icon-btn\s*\{[^}]+\}/]
    assert btn
    assert_match(/border-radius:\s*50%/, btn)
  end

  test "quiet reading drops the chrome shell around jump" do
    quiet_chrome = css[/\.is-quiet \.reader-chrome\s*\{[^}]+\}/]
    assert quiet_chrome
    assert_match(/background:\s*transparent/, quiet_chrome)
    assert_match(/border:\s*0/, quiet_chrome)
    assert_match(/padding:\s*0/, quiet_chrome)
  end

  test "hiding verse numbers drops the gutter and the digits" do
    assert_match(/\.is-nums-hidden \.vnum\s*\{\s*display:\s*none/, css)
    assert_match(/\.is-nums-hidden \.verse-press\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/, css)
    assert_match(/--verse-gutter:\s*0px/, css)
    assert_match(/\.is-nums-hidden \.verse\s*\{[^}]*padding-left:\s*var\(--verse-inset\)/, css)
  end

  test "quiet plus nums-hidden hides verse number milestones" do
    hidden = css[/\.is-quiet\.is-nums-hidden \.vnum\s*\{[^}]+\}/]
    assert hidden
    assert_match(/display:\s*none/, hidden)
    refute_match(/content:/, hidden)
  end

  test "note tray shares the verse text column" do
    assert_match(/--verse-gutter:\s*1\.4rem/, css)
    assert_match(/grid-template-columns:\s*var\(--verse-gutter\) 1fr/, css)
    assert_match(/\.note-card,\s*\.verse > \.note-tray\s*\{[^}]*margin-left:\s*calc\(var\(--verse-gutter\) \+ var\(--verse-gutter-gap\)\)/m, css)
    refute_match(/\.note-tray, \.chapter-tray \{ padding: \.2rem \.2rem/, css)
  end
end
