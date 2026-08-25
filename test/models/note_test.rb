# frozen_string_literal: true

require "test_helper"

class NoteTest < ActiveSupport::TestCase
  setup do
    @library = Library.create!
  end

  def note(attrs)
    @library.notes.build({
      slug: "jhn.3.16",
      osis: "JHN.3.16",
      kind: "verse",
      book: "JHN",
      chapter: 3,
      verse_start: 16,
      blocks: []
    }.merge(attrs))
  end

  test "covers_verse? is exact for a verse note" do
    verse_note = note(kind: "verse", slug: "jhn.3.16", verse_start: 16, verse_end: nil)
    assert verse_note.covers_verse?(16)
    refute verse_note.covers_verse?(17)
  end

  test "covers_verse? includes every verse in a range without absorbing" do
    range_note = note(
      kind: "range",
      slug: "jhn.3.16-18",
      osis: "JHN.3.16-18",
      verse_start: 16,
      verse_end: 18
    )
    assert range_note.covers_verse?(16)
    assert range_note.covers_verse?(17)
    assert range_note.covers_verse?(18)
    refute range_note.covers_verse?(15)
    refute range_note.covers_verse?(19)
  end

  test "chapter notes never cover a verse" do
    chapter_note = note(
      kind: "chapter",
      slug: "jhn.3",
      osis: "JHN.3",
      verse_start: nil,
      verse_end: nil
    )
    refute chapter_note.covers_verse?(16)
  end

  test "blocks_from_text preserves ids by LCS when a line is inserted" do
    existing = note(blocks: [
      { "id" => "b_keep1", "indent" => 0, "text" => "Alpha" },
      { "id" => "b_keep2", "indent" => 0, "text" => "Beta" }
    ])
    existing.apply_text!("New\n  Alpha\nBeta")

    assert_equal "New", existing.blocks[0]["text"]
    assert_equal 0, existing.blocks[0]["indent"]
    refute_equal "b_keep1", existing.blocks[0]["id"]
    assert_equal "b_keep1", existing.blocks[1]["id"]
    assert_equal 1, existing.blocks[1]["indent"]
    assert_equal "Alpha", existing.blocks[1]["text"]
    assert_equal "b_keep2", existing.blocks[2]["id"]
    assert_equal "Beta", existing.blocks[2]["text"]
  end

  test "blocks_from_text keeps id when a line is edited in place" do
    existing = note(blocks: [ { "id" => "b_keep1", "indent" => 0, "text" => "Alpha" } ])
    existing.apply_text!("Alpha edited")
    assert_equal [ "b_keep1" ], existing.blocks.map { |block| block["id"] }
    assert_equal "Alpha edited", existing.blocks[0]["text"]
  end

  test "apply_blocks! preserves client ids and intra-block newlines" do
    existing = note(blocks: [])
    existing.apply_blocks!([
      { "id" => "b_root1", "indent" => 0, "text" => "Parent" },
      { "id" => "b_kid02", "indent" => 1, "text" => "Child\nparagraph" }
    ])
    existing.apply_blocks!([
      { "id" => "b_root1", "indent" => 0, "text" => "Parent" },
      { "id" => "b_kid02", "indent" => 1, "text" => "Child\nparagraph edited" }
    ])

    assert_equal [ "b_root1", "b_kid02" ], existing.blocks.map { |block| block["id"] }
    assert_equal 1, existing.blocks[1]["indent"]
    assert_equal "Child\nparagraph edited", existing.blocks[1]["text"]
  end

  test "markdown headings stay as block text and are not parsed into parents" do
    existing = note(blocks: [])
    existing.apply_text!("# Heading\n- item\n  **bold**")

    assert_equal [ 0, 0, 1 ], existing.blocks.map { |block| block["indent"] }
    assert_equal "# Heading", existing.blocks[0]["text"]
    assert_equal "- item", existing.blocks[1]["text"]
    assert_equal "**bold**", existing.blocks[2]["text"]
  end

  test "blank blocks are first-class and empty_content? waits for all text to go" do
    existing = note(blocks: [
      { "id" => "b_blank", "indent" => 0, "text" => "" },
      { "id" => "b_word", "indent" => 1, "text" => "Keep" }
    ])
    refute existing.empty_content?
    existing.apply_text!("\n")
    assert existing.empty_content?
    assert_equal 2, existing.blocks.length
    assert existing.blocks.all? { |block| block["text"].blank? }
  end
end
