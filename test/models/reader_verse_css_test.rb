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
    assert_match(/grid-template-columns:\s*1\.05rem 1fr/, phone)
    assert_match(/\.verse\s*\{\s*padding-left:\s*\.2rem/, phone)
    assert_match(/gap:\s*\.12rem/, phone)
  end
end
