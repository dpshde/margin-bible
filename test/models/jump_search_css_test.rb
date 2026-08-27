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

  test "jump and page fields stay at 16px so iOS does not focus-zoom" do
    jump = css[/\n\.jump input\[type="search"\]\s*\{[^}]+\}/]
    assert jump
    assert_match(/font-size:\s*16px/, jump)
    chrome = css[/\n\.reader-chrome \.jump input\[type="search"\]\s*\{[^}]+\}/]
    assert chrome
    assert_match(/font-size:\s*16px/, chrome)
    page = css[/\n\.page input\[type="email"\], \.page input\[type="search"\], \.page input\[type="text"\]\s*\{[^}]+\}/]
    assert page
    assert_match(/font-size:\s*16px/, page)
  end

  test "reader dock fab sits in the chrome bar" do
    fab = css[/\.reader-dock-btn\s*\{[^}]+\}/]
    assert fab
    assert_match(/width:\s*var\(--tap\)/, fab)
    assert_match(/min-height:\s*var\(--tap\)/, fab)
    assert_match(/border-radius:\s*\.5rem/, fab)
    refute_match(/border-radius:\s*50%/, fab)
    refute_match(/box-shadow:/, fab)
    bar = css[/\.chrome-bar\s*\{[^}]+\}/]
    assert bar
    assert_match(/display:\s*flex/, bar)
    open_fab = css[/\.reader-dock-menu\[open\] \.reader-dock-btn\s*\{[^}]+\}/]
    assert open_fab
    assert_match(/background:\s*var\(--paper-raised\)/, open_fab)
    refute_match(/var\(--fill\)/, open_fab)
    item = css[/\.dock-item\s*\{[^}]+\}/]
    assert_match(/min-height:\s*var\(--tap\)/, item)
    assert_match(/appearance:\s*none/, item)
    assert_match(/border-radius:\s*0/, item)
    panel = css[/\.reader-dock-panel\s*\{[^}]+\}/]
    assert_match(/padding:\s*0/, panel)
    assert_match(/box-shadow:\s*0 0 0 1px var\(--line\)/, panel)
    assert_match(/overflow:\s*visible/, panel)
    assert_match(/max-height:\s*none/, panel)
    refute_match(/[0-9]+px [0-9]+px/, panel)
    menu = css[/\.menu-panel\s*\{[^}]+\}/]
    assert_match(/padding:\s*0/, menu)
    assert_match(/overflow:\s*hidden/, menu)
    assert_match(/box-shadow:\s*0 0 0 1px var\(--line\)/, menu)
    refute_match(/[0-9]+px [0-9]+px/, menu)
    menu_item = css[/\.menu-item\s*\{[^}]+\}/]
    assert_match(/appearance:\s*none/, menu_item)
    assert_match(/border-radius:\s*0/, menu_item)
    on = css[/\.dock-item\.is-on\s*\{[^}]+\}/]
    assert on
    assert_match(/background:\s*transparent/, on)
    assert_match(/\.dock-item\.is-on \.dock-check \{ opacity:\s*1/, css)
  end

  test "reader dock fab is mobile-only on the web" do
    assert_match(/@media \(min-width: 641px\) \{[\s\S]*?\.reader-dock \{ display: none; \}/, css)
    assert_match(/\.reader-actions-menu \{ display: none; \}/, css)
    assert_match(/html\.hotwire-native \.reader-dock \{ display: flex; \}/, css)
  end

  test "suggest hint is quiet grey preview copy" do
    hint = css[/\n\.suggest-hint\s*\{[^}]+\}/]
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
    assert_match(/\.suggest button\s*\{[^}]*appearance:\s*none/m, css)
    assert_match(/\.suggest button\s*\{[^}]*border-radius:\s*0/m, css)
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

  test "dark tokens only apply when chosen or system asks" do
    refute_match(/@media \(prefers-color-scheme: dark\) \{\s*:root/, css)
    assert_match(/html\[data-theme="dark"\]/, css)
    assert_match(/html\[data-theme="system"\]/, css)
  end

  test "trail pointers are a quiet text row not pills" do
    chip = css[/\.trail-chip\s*\{[^}]+\}/]
    assert chip
    refute_match(/min-height:\s*var\(--tap\)/, chip)
    refute_match(/min-height:\s*2\.25rem/, chip)
    refute_match(/border-radius:\s*999px/, chip)
    assert_match(/background:\s*transparent/, chip)
    assert_match(/text-decoration:\s*none/, chip)
    refute_match(/text-decoration:\s*underline/, chip)
    icon = css[/\.trail-icon\s*\{[^}]+\}/]
    assert icon
    assert_match(/color:\s*var\(--faint\)/, icon)
  end

  test "reader bottom veil fades paper to the screen edge" do
    veil = css[/\.reader-veil\s*\{[^}]+\}/]
    assert veil
    assert_match(/position:\s*fixed/, veil)
    assert_match(/left:\s*0/, veil)
    assert_match(/right:\s*0/, veil)
    assert_match(/linear-gradient/, veil)
    assert_match(/pointer-events:\s*none/, veil)
  end

  test "reader chrome is a bottom bar that can tuck" do
    chrome = css[/\n\.reader-chrome \{\n[^}]+\}/]
    assert chrome
    assert_match(/position:\s*fixed/, chrome)
    assert_match(/bottom:/, chrome)
    assert_match(/right:\s*1rem/, chrome)
    assert_match(/background:\s*transparent/, chrome)
    assert_match(/padding:\s*0/, chrome)
    refute_match(/right:\s*5\.1rem/, css)
    assert_match(/\.reader-chrome\.is-tucked/, css)
    assert_match(/\.reader-chrome \.suggest \{[\s\S]*bottom:\s*100%/, css)
  end
end
