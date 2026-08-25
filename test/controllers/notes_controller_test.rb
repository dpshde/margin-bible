# frozen_string_literal: true

require "test_helper"

class NotesControllerTest < ActionDispatch::IntegrationTest
  setup do
    Verse.create!(
      translation: "BSB",
      book: "JHN",
      chapter: 1,
      verse: 1,
      text: "In the beginning was the Word."
    )
    get read_path("jhn.1")
  end

  test "upsert preserves block ids across a nested round-trip" do
    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "Parent\n  Child",
      blocks: [
        { id: "b_aaa1", indent: 0, text: "Parent" },
        { id: "b_bbb2", indent: 1, text: "Child" }
      ].to_json
    }
    assert_response :success

    note = Library.last.notes.find_by!(slug: "jhn.1.1")
    assert_equal [ "b_aaa1", "b_bbb2" ], note.blocks.map { |block| block["id"] }
    assert_equal [ 0, 1 ], note.blocks.map { |block| block["indent"] }

    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "Parent\n  Child edited",
      blocks: [
        { id: "b_aaa1", indent: 0, text: "Parent" },
        { id: "b_bbb2", indent: 1, text: "Child edited" }
      ].to_json
    }
    note.reload
    assert_equal [ "b_aaa1", "b_bbb2" ], note.blocks.map { |block| block["id"] }
    assert_equal "Child edited", note.blocks[1]["text"]
    assert_equal 1, note.blocks[1]["indent"]
  end

  test "text-only upsert still hydrates indent blocks and can delete when empty" do
    patch notes_path, params: { slug: "jhn.1.1", text: "Root\n  Nested" }
    note = Library.last.notes.find_by!(slug: "jhn.1.1")
    assert_equal "Root", note.blocks[0]["text"]
    assert_equal 1, note.blocks[1]["indent"]
    first_id = note.blocks[0]["id"]

    patch notes_path, params: { slug: "jhn.1.1", text: "Root changed\n  Nested" }
    note.reload
    assert_equal first_id, note.blocks[0]["id"]

    patch notes_path, params: { slug: "jhn.1.1", text: "   " }
    assert_nil Library.last.notes.find_by(slug: "jhn.1.1")
  end
end
