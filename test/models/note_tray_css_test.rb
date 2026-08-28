# frozen_string_literal: true

require "test_helper"

class NoteTrayCssTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "regular outliner does not inherit publication hanging indent" do
    assert_match(/\.note-card,\s*\n\.verse > \.note-tray\s*\{[^}]*text-indent:\s*0/m, css)
    assert_match(/\.note-tray\s*\{[^}]*text-indent:\s*0/, css)
    outliner = css[/\n\.outliner\s*\{[^}]+\}/]
    assert outliner
    assert_match(/display:\s*block/, outliner)
    assert_match(/text-indent:\s*0/, outliner)
    assert_match(/min-height:\s*5\.5rem/, outliner)
    refute_match(/display:\s*contents/, outliner)
    tray = css[/\n\.note-tray\s*\{[^}]+\}/]
    assert tray
    refute_match(/display:\s*block/, tray)
    refute_match(/display:\s*contents/, tray)
    assert_match(/\.note-tray:not\(\[hidden\]\)\s*\{\s*display:\s*block/, css)
    assert_match(/\.note-tray\[hidden\]\s*\{\s*display:\s*none !important/, css)
    assert_match(/\.pub-p \.otext,\s*\n\.pub-q1 \.otext,\s*\n\.pub-q2 \.otext\s*\{[^}]*text-indent:\s*0/, css)
    assert_match(/\.verse:has\(\.note-tray:not\(\[hidden\]\)\) \+ \.verse\s*\{[^}]*margin-top:\s*\.45rem/, css)
    assert_match(/\.is-quiet \.note-tray:not\(\[hidden\]\),\s*\n\.is-quiet \.outliner\s*\{[^}]*display:\s*contents/, css)
  end

  test "chapter tray is not a second card around the editor" do
    rule = css[/\.chapter-tray\s*\{[^}]+\}/]
    assert rule
    refute_match(/background:/, rule)
    refute_match(/border-radius:/, rule)
    refute_match(/padding:/, rule)
    assert_match(/calc\(var\(--verse-inset\) \+ var\(--verse-gutter\) \+ var\(--verse-gutter-gap\)\)/, rule)
  end

  test "tray head is a label-left icon-right row" do
    assert_match(/\.tray-head\s*\{[^}]*display:\s*flex/m, css)
    assert_match(/\.tray-head\s*\{[^}]*justify-content:\s*space-between/m, css)
    refute_match(/\.tray-meta/, css)
  end

  test "phone tray actions are tap sized" do
    assert_match(/@media \(max-width: 640px\) \{[\s\S]*\.tray-clear,[\s\S]*min-height:\s*var\(--tap\)/, css)
  end

  test "note editor has no blue focus ring" do
    assert_match(/\.otext:focus,\s*\.otext:focus-visible/m, css)
    assert_match(/\.otext:focus, \.otext:focus-visible,[\s\S]*?outline:\s*none/, css)
    refute_match(/outline:\s*[^;]*blue/i, css)
    refute_match(/box-shadow:\s*[^;]*#(?:4|5|6|7|8|9|a)[0-9a-f]{2}ff/i, css)
  end

  test "note text shows display-only bold and italics" do
    assert_match(/\.otext strong\s*\{\s*font-weight:\s*600/, css)
    assert_match(/\.otext em\s*\{\s*font-style:\s*italic/, css)
  end

  test "editable note surfaces stay at 16px so iOS does not focus-zoom" do
    otext = css[/\n\.otext,\s*\n\.note-input\s*\{[^}]+\}/]
    assert otext
    assert_match(/font-size:\s*16px/, otext)
    vtext = css[/\n\.vtext\s*\{[^}]+\}/]
    assert vtext
    assert_match(/font-size:\s*var\(--read-size\)/, vtext)
    refute_match(/font-size:\s*16px/, vtext)
  end

  test "viewport locks page scale on the reader" do
    layout = Rails.root.join("app/views/layouts/application.html.erb").read
    assert_match(
      /width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover/,
      layout
    )
  end

  test "chapter and verse press disable extra touch zoom" do
    chapter = css[/\n\.chapter\s*\{[^}]+\}/]
    assert chapter
    assert_match(/touch-action:\s*manipulation/, chapter)
    assert_match(/-webkit-tap-highlight-color:\s*transparent/, chapter)
    press = css[/\n\.verse-press\s*\{[^}]+\}/]
    assert press
    assert_match(/touch-action:\s*manipulation/, press)
    assert_match(/-webkit-tap-highlight-color:\s*transparent/, press)
    assert_match(/outline:\s*none/, press)
    picking = css[/\n\.chapter\.is-picking\s*\{[^}]+\}/]
    assert picking
    assert_match(/touch-action:\s*none/, picking)
    parent_picking = css[/\n\.is-picking \.chapter\s*\{[^}]+\}/]
    assert parent_picking
    assert_match(/touch-action:\s*none/, parent_picking)
    assert_match(/user-select:\s*none/, parent_picking)
  end
end
