# frozen_string_literal: true

require "test_helper"

class LeaderSheetDemoTest < ActiveSupport::TestCase
  test "hebrews 12 samples stay separate OSIS rows" do
    passage = Margin::Passage.parse("heb.12")
    notes = Margin::LeaderSheetDemo.notes_for(passage)
    slugs = notes.map(&:slug)
    assert_equal %w[heb.12.1 heb.12.2 heb.12.7 heb.12.11 heb.12.26], slugs
    assert notes.all? { |note| note.kind == "verse" }
    assert Margin::LeaderSheetDemo.using_samples?(passage)
  end

  test "other chapters have no invented sample notes" do
    passage = Margin::Passage.parse("jhn.1")
    assert_empty Margin::LeaderSheetDemo.notes_for(passage)
    refute Margin::LeaderSheetDemo.using_samples?(passage)
  end
end
