# frozen_string_literal: true

require "test_helper"

class JumpSearchCssTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "jump search has no blue ring and no fat pill" do
    refute_match(/\.jump input[^{]*\{[^}]*border-radius:\s*999px/m, css)
    assert_match(/\.jump input\[type="search"\]:focus-visible\s*\{[^}]*outline:\s*none/m, css)
    refute_match(/\.jump[^{]*outline:\s*[^;]*blue/i, css)
  end

  test "reader dock fab is a large center control" do
    fab = css[/\.reader-dock-btn\s*\{[^}]+\}/]
    assert fab
    assert_match(/width:\s*3\.5rem/, fab)
    assert_match(/height:\s*3\.5rem/, fab)
    assert_match(/border-radius:\s*50%/, fab)
    item = css[/\.dock-item\s*\{[^}]+\}/]
    assert_match(/min-height:\s*var\(--tap\)/, item)
  end

  test "suggest hint is quiet grey preview copy" do
    hint = css[/\.suggest-hint\s*\{[^}]+\}/]
    assert hint
    assert_match(/color:\s*var\(--faint\)/, hint)
    assert_match(/pointer-events:\s*none/, hint)
  end

  test "suggest list sits flush under the jump input" do
    suggest = css[/\n\.suggest \{.*?\n\}/m]
    assert suggest
    assert_match(/margin:\s*0/, suggest)
    assert_match(/padding:\s*0/, suggest)
    assert_match(/overflow:\s*hidden/, suggest)
    assert_match(/top:\s*100%/, suggest)
    assert_match(/border-top:\s*0/, suggest)
  end

  test "open jump shares one outline onto the suggestion list" do
    assert_match(/\.jump\.is-open \.suggest/, css)
    assert_match(/\.suggest li:last-child button\s*\{[^}]*border-radius:\s*0 0/, css)
    open_input = css[/\.jump\.is-open input\[type="search"\],\s*\.jump:has\(\.suggest:not\(\[hidden\]\)\) input\[type="search"\]\s*\{[^}]+\}/m]
    assert open_input
    assert_match(/border-color:/, open_input)
    assert_match(/border-bottom-color:\s*transparent/, open_input)
    refute_match(/border-bottom-color:\s*transparent;[\s\S]*border-color:/, open_input)
  end

  test "chapter count hint does not double the seam under the input" do
    assert_match(/\.suggest li:first-child\.suggest-hint\s*\{\s*border-top:\s*0/, css)
  end
end
