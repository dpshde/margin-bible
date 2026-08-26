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

  test "suggest list sits flush under the jump input" do
    suggest = css[/\.suggest\s*\{[^}]+\}/]
    assert suggest
    assert_match(/margin:\s*0/, suggest)
    assert_match(/top:\s*100%/, suggest)
    assert_match(/border-top:\s*0/, suggest)
    refute_match(/\.suggest\s*\{[^}]*margin:\s*\.35rem/m, css)
  end
end
