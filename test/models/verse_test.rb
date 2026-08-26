require "test_helper"

class VerseTest < ActiveSupport::TestCase
  test "rows do not store events or entities" do
    refute_includes Verse.column_names, "events"
    refute_includes Verse.column_names, "entities"
    assert_includes Verse.column_names, "text"
    assert_includes Verse.column_names, "heading"
  end
end
