# frozen_string_literal: true

require "test_helper"

class NoteTrayCssTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
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

  test "editable note surfaces stay at 16px so iOS does not focus-zoom" do
    otext = css[/\n\.otext,\s*\n\.note-input\s*\{[^}]+\}/]
    assert otext
    assert_match(/font-size:\s*16px/, otext)
    vtext = css[/\n\.vtext\s*\{[^}]+\}/]
    assert vtext
    assert_match(/font-size:\s*1\.18rem/, vtext)
    refute_match(/font-size:\s*16px/, vtext)
  end

  test "viewport does not lock pinch zoom" do
    layout = Rails.root.join("app/views/layouts/application.html.erb").read
    assert_match(/width=device-width,initial-scale=1,viewport-fit=cover/, layout)
    refute_match(/maximum-scale/, layout)
    refute_match(/user-scalable/, layout)
  end
end
