# frozen_string_literal: true

require "test_helper"

class PublicationTest < ActiveSupport::TestCase
  FakeVerse = Struct.new(:verse, :heading, :text, keyword_init: true)

  test "heading starts an s1 block and following verses share one paragraph" do
    verses = [
      FakeVerse.new(verse: 35, heading: "The First Disciples", text: "The next day John was there again."),
      FakeVerse.new(verse: 36, heading: nil, text: "When he saw Jesus walking by."),
      FakeVerse.new(verse: 37, heading: nil, text: "And when the two disciples heard him."),
      FakeVerse.new(verse: 43, heading: "Jesus Calls Philip and Nathanael", text: "The next day Jesus decided.")
    ]

    groups = Margin::Publication.pericopes(verses)

    assert_equal 2, groups.size
    assert_equal "The First Disciples", groups[0].heading
    assert_equal [ 35, 36, 37 ], groups[0].verses.map(&:verse)
    assert_equal "Jesus Calls Philip and Nathanael", groups[1].heading
    assert_equal [ 43 ], groups[1].verses.map(&:verse)
  end

  test "John 1 First Disciples is one paragraph of verses 35-42" do
    packed = Margin::Bsb.hydrate_chapter!("JHN", 1)
    groups = Margin::Publication.pericopes(packed)
    first = groups.find { |group| group.heading == "The First Disciples" }

    assert first
    assert_equal (35..42).to_a, first.verses.map(&:verse)
    refute groups.any? { |group| group.heading.to_s.start_with?("\\q") }
  end
end
