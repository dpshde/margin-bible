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
end
