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

  test "attachments persist without body text and are not absorbed into blocks" do
    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "",
      blocks: [ { id: "b_empty", indent: 0, text: "", bullet: true } ].to_json,
      attachments: [
        { kind: "xref", slug: "jhn.1.6", source: "manual" },
        { kind: "url", url: "https://example.com/note" }
      ].to_json
    }
    assert_response :success
    note = Library.last.notes.find_by!(slug: "jhn.1.1")
    assert_equal [ "xref", "url" ], note.attachments.map { |row| row["kind"] }
    assert_equal "jhn.1.6", note.attachments[0]["slug"]
    assert_equal "https://example.com/note", note.attachments[1]["url"]
    assert note.blocks.none? { |block| block["text"].to_s.strip.present? }

    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "Inline thought.",
      blocks: [ { id: "b_body", indent: 0, text: "Inline thought." } ].to_json
    }
    note.reload
    assert_equal "Inline thought.", note.blocks[0]["text"]
    assert_equal "jhn.1.6", note.attachments[0]["slug"]
  end

  test "parsed xrefs in the body are stored as attachments" do
    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "Cf. John 1:6",
      blocks: [ { id: "b_body", indent: 0, text: "Cf. John 1:6" } ].to_json
    }
    note = Library.last.notes.find_by!(slug: "jhn.1.1")
    assert_equal "Cf. John 1:6", note.blocks[0]["text"]
    assert_equal [ "jhn.1.6" ], note.attachments.map { |row| row["slug"] }

    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "See John 1:7",
      blocks: [ { id: "b_body", indent: 0, text: "See John 1:7" } ].to_json,
      attachments: [
        { kind: "xref", slug: "jhn.1.6" },
        { kind: "xref", slug: "jhn.1.7" }
      ].to_json
    }
    note.reload
    assert_equal [ "jhn.1.7" ], note.attachments.map { |row| row["slug"] }

    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "No refs.",
      blocks: [ { id: "b_body", indent: 0, text: "No refs." } ].to_json,
      attachments: [ { kind: "xref", slug: "rom.8.28", source: "manual" } ].to_json
    }
    note.reload
    assert_equal [ "rom.8.28" ], note.attachments.map { |row| row["slug"] }
    assert_equal "manual", note.attachments[0]["source"]
  end

  test "a verse can be bookmarked with no note body" do
    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "",
      blocks: [ { id: "b_empty", indent: 0, text: "", bullet: true } ].to_json,
      bookmarked: "1"
    }
    assert_response :success
    note = Library.last.notes.find_by!(slug: "jhn.1.1")
    assert note.bookmarked?
    assert note.blocks.none? { |block| block["text"].to_s.strip.present? }

    patch notes_path, params: {
      slug: "jhn.1.1",
      text: "",
      blocks: [ { id: "b_empty", indent: 0, text: "", bullet: true } ].to_json,
      bookmarked: "0"
    }
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
