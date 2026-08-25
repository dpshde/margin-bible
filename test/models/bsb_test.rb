# frozen_string_literal: true

require "test_helper"
require "stringio"

class BsbTest < ActiveSupport::TestCase
  test "book map covers John and 1 John" do
    assert_equal "JHN", Margin::Bsb.book_code_for("John")
    assert_equal "JHN", Margin::Bsb.book_code_for("john")
    assert_equal "1JN", Margin::Bsb.book_code_for("1 John")
    assert_equal "1JN", Margin::Bsb.book_code_for("1John")
  end

  test "jsonl lines drop events and entities and map English book names" do
    john = Margin::Bsb.parse_jsonl_line(
      %({"ref":"John.1.1","book":"John","chapter":"1","verseNum":"1","text":"In the beginning was the Word.","events":["x"],"entities":["God","Word"]})
    )
    first_john = Margin::Bsb.parse_jsonl_line(
      %({"ref":"1 John.1.1","book":"1 John","chapter":"1","verseNum":"1","text":"That which was from the beginning.","events":[],"entities":["Word"]})
    )

    assert_equal({ book: "JHN", chapter: 1, verse: 1, text: "In the beginning was the Word." }, john)
    assert_equal({ book: "1JN", chapter: 1, verse: 1, text: "That which was from the beginning." }, first_john)
    refute john.key?(:events)
    refute john.key?(:entities)
  end

  test "pack_from_jsonl never stores events or entities" do
    io = StringIO.new(<<~JSONL)
      {"ref":"John.1.1","book":"John","chapter":"1","verseNum":"1","text":"In the beginning was the Word.","events":["x"],"entities":["God"]}
      {"ref":"John.1.2","book":"John","chapter":"1","verseNum":"2","text":"He was with God.","events":[],"entities":[]}
    JSONL
    pack = Margin::Bsb.pack_from_jsonl(io, headings: { "jhn.1" => { 1 => "The Beginning" } })
    verses = pack["jhn.1"]["verses"]

    assert_equal 2, verses.size
    assert_equal "The Beginning", verses[0]["heading"]
    assert_equal [ "v", "text", "heading" ], verses[0].keys
    assert_equal [ "v", "text" ], verses[1].keys
    refute verses.any? { |verse| verse.key?("events") || verse.key?("entities") }
  end

  test "get_request is a full GET and never sends Range" do
    request = Margin::Bsb.get_request(URI(Margin::Bsb::DEFAULT_URL))
    assert_equal "GET", request.method
    assert_nil request["Range"]
  end

  test "hydrate_chapter! loads only that chapter from the pack" do
    assert_equal 0, Verse.count

    verses = Margin::Bsb.hydrate_chapter!("JHN", 1)
    john = verses.find { |verse| verse.verse == 1 }

    assert john
    assert_match(/In the beginning was the Word/, john.text)
    assert_equal "The Beginning", john.heading
    assert_equal verses.size, Verse.count
    assert Verse.where(book: "JHN", chapter: 1).exists?
    assert_equal 0, Verse.where.not(book: "JHN", chapter: 1).count
    refute Verse.column_names.include?("events")
    refute Verse.column_names.include?("entities")
  end

  test "hydrate_chapter! leaves a missing chapter empty" do
    assert_equal 0, Verse.count
    assert_equal 0, Margin::Bsb.hydrate_chapter!("JHN", 99).count
    assert_equal 0, Verse.count
  end
end
