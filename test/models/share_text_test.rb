# frozen_string_literal: true

require "test_helper"

class ShareTextTest < ActiveSupport::TestCase
  test "formats a verse with indented notes and a route.bible link" do
    text = Margin::ShareText.format_verse(
      label: "John 1:1",
      text: "In the beginning was the Word.",
      notes: [ { blocks: [ { "indent" => 0, "text" => "The Logos." }, { "indent" => 1, "text" => "Nested." } ] } ],
      url: "https://route.bible/jhn.1.1"
    )
    assert_equal <<~TEXT, text
      John 1:1
      In the beginning was the Word.

        The Logos.
          Nested.

      https://route.bible/jhn.1.1
    TEXT
  end

  test "formats a chapter as a numbered list with outline notes" do
    text = Margin::ShareText.format_chapter(
      label: "John 1",
      chapter_note: [ { "indent" => 0, "text" => "Chapter thought" } ],
      verses: [
        {
          n: 1,
          heading: "The Beginning",
          text: "In the beginning was the Word.",
          notes: [ { blocks: [ { "indent" => 0, "text" => "The Logos." } ] } ]
        },
        { n: 2, heading: nil, text: "He was with God in the beginning.", notes: [] }
      ]
    )
    assert_equal <<~TEXT, text
      John 1

      Chapter thought

      The Beginning

      1. In the beginning was the Word.
        The Logos.

      2. He was with God in the beginning.
    TEXT
  end

  test "document builds a chapter from the BSB pack" do
    text = Margin::ShareText.document(
      scope: "chapter",
      book: "JHN",
      chapter: 1,
      notes: { "jhn.1.1" => [ { "indent" => 0, "text" => "Exact." } ] },
      include_notes: true
    )
    assert_match(/\AJohn 1\n/, text)
    assert_match(/^1\. In the beginning was the Word/, text)
    assert_match(/^  Exact\.$/, text)
    refute_match(/https:\/\/route\.bible/, text)
  end

  test "document omits notes when include_notes is false" do
    text = Margin::ShareText.document(
      scope: "chapter",
      book: "JHN",
      chapter: 1,
      notes: { "jhn.1.1" => [ { "indent" => 0, "text" => "Exact." } ] },
      include_notes: false
    )
    refute_match(/Exact/, text)
    assert_match(/^1\. In the beginning/, text)
  end

  test "book export uses nested markdown bullets for outliner notes" do
    text = Margin::ShareText.document(
      scope: "book",
      book: "JHN",
      notes: {
        "jhn.1" => [
          { "indent" => 0, "text" => "Prologue." },
          { "indent" => 1, "text" => "The Word." }
        ],
        "jhn.1.1" => [
          { "indent" => 0, "text" => "The Logos." },
          { "indent" => 1, "text" => "Nested." }
        ]
      },
      include_notes: true
    )
    assert_match(/\AJohn\n/, text)
    assert_match(/^John 1\n/, text)
    assert_match(/^- Prologue\.$/, text)
    assert_match(/^  - The Word\.$/, text)
    assert_match(/^1\. In the beginning was the Word/, text)
    assert_match(/^  - The Logos\.$/, text)
    assert_match(/^    - Nested\.$/, text)
    refute_match(/^  The Logos\.$/, text)
  end

  test "filename marks note exports" do
    assert_equal "john.md", Margin::ShareText.filename(scope: "book", book: "JHN", include_notes: false)
    assert_equal "john-notes.md", Margin::ShareText.filename(scope: "book", book: "JHN", include_notes: true)
    assert_equal "bible.md", Margin::ShareText.filename(scope: "bible", include_notes: false)
    assert_equal "bible-notes.md", Margin::ShareText.filename(scope: "bible", include_notes: true)
  end
end
