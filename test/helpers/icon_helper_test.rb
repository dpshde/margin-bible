# frozen_string_literal: true

require "test_helper"

class IconHelperTest < ActionView::TestCase
  test "ph_icon renders a currentColor phosphor path" do
    html = ph_icon("note-pencil")
    assert_includes html, 'viewBox="0 0 256 256"'
    assert_includes html, 'fill="currentColor"'
    assert_includes html, "aria-hidden"
    assert_includes html, "<path"
    refute_includes html, "emoji"
  end

  test "dock icons are a known phosphor set" do
    %w[dots-three clock-counter-clockwise note-pencil arrows-out list-dashes list-numbers share share-network book notebook book-open books caret-left caret-right export check flower-lotus trash squares-four x paperclip link].each do |name|
      assert IconHelper::PHOSPHOR.key?(name), name
    end
  end
end
