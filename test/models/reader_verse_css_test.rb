# frozen_string_literal: true

require "test_helper"

class ReaderVerseCssTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "open verse is a thin rail, not a filled rounded island" do
    open_rule = css[/\.verse\.is-open\s*\{[^}]+\}/]
    assert open_rule
    assert_match(/border-left:/, open_rule)
    refute_match(/background:/, open_rule)
    refute_match(/border-radius:/, open_rule)
    refute_match(/padding-left:/, open_rule)
    refute_match(/margin:/, open_rule)
    refute_match(/--mark-fill/, css)
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
