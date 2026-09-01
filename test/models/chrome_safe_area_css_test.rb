# frozen_string_literal: true

require "test_helper"

class ChromeSafeAreaCssTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  def layout
    Rails.root.join("app/views/layouts/application.html.erb").read
  end

  test "viewport includes the safe area so env(safe-area-inset-top) is live" do
    assert_match(/viewport-fit=cover/, layout)
  end

  test "safe-area token lives on :root and feeds the web topbar" do
    root = css[/:root\s*\{[^}]+\}/]
    assert root
    assert_match(/--safe-top:\s*env\(safe-area-inset-top, 0px\)/, root)
    topbar = css[/\n\.topbar\s*\{[^}]+\}/]
    assert topbar
    assert_match(/position:\s*sticky/, topbar)
    assert_match(/padding:\s*calc\(\.55rem \+ var\(--safe-top\)\) 1rem \.55rem/, topbar)
    refute_match(/padding:\s*\.55rem 1rem;/, topbar)
  end

  test "Hotwire Native pads the body for the overlay nav plus safe area" do
    native = css[/html\.hotwire-native\s*\{[^}]+\}/]
    assert native
    assert_match(/--chrome-top:\s*calc\(var\(--tap\) \+ var\(--safe-top\)\)/, native)
    body = css[/html\.hotwire-native body\s*\{[^}]+\}/]
    assert body
    assert_match(/padding-top:\s*var\(--chrome-top\)/, body)
  end

  test "inbox, sign-in, and reader share the native chrome inset instead of a one-page pad" do
    refute_match(/\.inbox-main\s*\{[^}]*padding-top:\s*\d+px/, css)
    refute_match(/\.inbox-empty\s*\{[^}]*padding-top:/, css)
    assert_match(/\.inbox-native-continue\s*\{/, css)
    refute_match(/html\.hotwire-native \.inbox-native-continue\s*\{[^}]*padding-top:\s*var\(--chrome-top\)/, css)
    inbox = css[/\n\.inbox-main\s*\{[^}]+\}/]
    assert inbox
    assert_match(/padding:\s*\.75rem 1\.1rem 6rem/, inbox)
    page = css[/\n\.page\s*\{[^}]+\}/]
    assert page
    assert_match(/padding:\s*1\.5rem 1\.2rem 4rem/, page)
    reader = css[/\n\.reader\s*\{[^}]+\}/]
    assert reader
    assert_match(/--reader-bottom-pad:\s*6\.5rem/, reader)
    assert_match(/padding:\s*\.75rem 1\.1rem var\(--reader-bottom-pad\)/, reader)
    assert_match(/\.reader\.is-chrome-tucked/, css)
    tucked = css[/\.reader:has\(\.reader-chrome\.is-tucked\)\s*\{[^}]+\}/]
    assert tucked
    assert_match(/--reader-bottom-pad:\s*calc\(1\.35rem \+ env\(safe-area-inset-bottom, 0px\)\)/, tucked)
    refute_match(/\.reader:has\(\.reader-chrome\.is-tucked\)\s*\{[^}]*6\.5rem/, css)
    refute_match(/\.reader:has\(\.reader-chrome\.is-tucked\)\s*\{[^}]*8rem/, css)
    refute_match(/\.reader\s*\{\s*padding-bottom:\s*8rem/, css)
    assert_match(/html\.hotwire-native body\s*\{[^}]*padding-top:\s*var\(--chrome-top\)/, css)
  end

  test "native Focus mode does not keep the web pill offset" do
    quiet_native = css[/html\.hotwire-native \.is-quiet \.reader\s*\{[^}]+\}/]
    assert quiet_native
    assert_match(/padding-top:\s*\.75rem/, quiet_native)
    refute_match(/4\.25rem/, quiet_native)
    web_quiet = css[/\n\.is-quiet \.reader\s*\{[^}]+\}/]
    assert web_quiet
    assert_match(/padding-top:\s*calc\(4\.25rem \+ env\(safe-area-inset-top, 0px\)\)/, web_quiet)
  end
end
