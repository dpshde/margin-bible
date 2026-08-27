# frozen_string_literal: true

require "test_helper"

class NoteAgentSignatureTest < ActiveSupport::TestCase
  test "new notes default to a human source and unused agent columns" do
    library = Library.create!
    note = create_note!(library, "jhn.3.16", "A thought.")
    assert_equal "human", note.source
    assert_nil note.agent_name
    assert_nil note.agent_color
  end

  test "search and covering stay composed as separate records" do
    library = Library.create!
    create_note!(library, "jhn.3.16", "Verse thought.")
    create_note!(library, "jhn.3.16-18", "Range thought.")
    create_note!(library, "jhn.3", "Chapter thought.")

    listed = Note.search_in(library, book: "John", chapter: 3)
    assert_equal [ "jhn.3", "jhn.3.16", "jhn.3.16-18" ].sort, listed.map(&:slug).sort

    covering = Note.covering_verse(library, "jhn.3.16")
    assert_equal [ "jhn.3.16", "jhn.3.16-18" ].sort, covering.map(&:slug).sort

    payload = covering.first.as_mcp
    assert_equal %w[slug osis kind body created_at updated_at], payload.keys.map(&:to_s)
  end

  test "source rejects unknown values" do
    library = Library.create!
    note = library.notes.build(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1, verse_start: 1,
      source: "oracle"
    )
    refute note.valid?
    assert_includes note.errors[:source], "is not included in the list"
  end
end
