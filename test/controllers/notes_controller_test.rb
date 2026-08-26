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

  test "upserting a range slug stores a range note without absorbing verses" do
    [ 2, 3 ].each do |n|
      Verse.create!(translation: "BSB", book: "JHN", chapter: 1, verse: n, text: "Verse #{n}.")
    end
    patch notes_path, params: { slug: "jhn.1.1", text: "Verse one." }
    patch notes_path, params: { slug: "jhn.1.1-3", text: "Range thought." }
    library = Library.last
    range = library.notes.find_by!(slug: "jhn.1.1-3")
    assert_equal "range", range.kind
    assert_equal 1, range.verse_start
    assert_equal 3, range.verse_end
    assert library.notes.find_by(slug: "jhn.1.1")
    patch notes_path, params: { slug: "jhn.1.1-3", text: "   " }
    assert_nil library.notes.find_by(slug: "jhn.1.1-3")
    assert library.notes.find_by(slug: "jhn.1.1")
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

  test "bookmarking a note does not change its body" do
    patch notes_path, params: { slug: "jhn.1.1", text: "The Logos." }
    note = Library.last.notes.find_by!(slug: "jhn.1.1")
    refute note.bookmarked?

    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "The Logos.",
      blocks: [ { id: note.blocks[0]["id"], indent: 0, text: "The Logos." } ].to_json,
      bookmarked: "1"
    }
    note.reload
    assert note.bookmarked?
    assert_equal "The Logos.", note.blocks[0]["text"]

    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "The Logos. Edited.",
      blocks: [ { id: note.blocks[0]["id"], indent: 0, text: "The Logos. Edited." } ].to_json
    }
    note.reload
    assert note.bookmarked?
    assert_equal "The Logos. Edited.", note.blocks[0]["text"]
  end
end
