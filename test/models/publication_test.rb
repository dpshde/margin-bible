# frozen_string_literal: true

require "test_helper"

class PublicationTest < ActiveSupport::TestCase
  test "official BSB USJ is version 3.1 with JHN book code" do
    book = Margin::Usj.load_book("JHN")
    assert_equal "USJ", book["type"]
    assert_equal "3.1", book["version"]
    id = book["content"].find { |node| node.is_a?(Hash) && node["marker"] == "id" }
    assert_equal "JHN", id["code"]
  end

  test "John 1 First Disciples is several paragraphs, not one heading blob" do
    nodes = Margin::Usj.chapter_nodes("JHN", 1)
    after = slice_after_heading(nodes, "The First Disciples")
    paras = after.take_while { |node| node["marker"] != "s1" }
    p_markers = paras.select { |node| node["marker"] == "p" }

    assert p_markers.size >= 4
    assert_equal [ 35, 36, 37 ], verse_numbers(p_markers[0])
    assert_equal [ 38 ], verse_numbers(p_markers[1])
    refute_equal [ 35, 36, 37, 38, 39, 40, 41, 42 ], verse_numbers(p_markers[0])
  end

  test "John 1:23 Isaiah quote is q1 then q2" do
    nodes = Margin::Usj.chapter_nodes("JHN", 1)
    idx = nodes.find_index { |node| verse_numbers(node).include?(23) }
    assert idx
    following = nodes[(idx + 1)..]
    markers = following.first(3).map { |node| node["marker"] }
    assert_includes markers, "b"
    assert_includes markers, "q1"
    assert_includes markers, "q2"
    q1 = following.find { |node| node["marker"] == "q1" }
    q2 = following.find { |node| node["marker"] == "q2" }
    assert_match(/voice of one calling/, Margin::Usj.plain_text(q1["content"]))
    assert_match(/Make straight the way for the Lord/, Margin::Usj.plain_text(q2["content"]))
  end

  test "publication module does not stuff verses under a heading" do
    refute_includes Rails.root.join("lib/margin/publication.rb").read, "def pericopes"
    assert_equal Margin::Usj.chapter_nodes("JHN", 1).size, Margin::Publication.chapter_nodes("JHN", 1).size
  end

  private

  def slice_after_heading(nodes, title)
    start = nodes.find_index { |node|
      node.is_a?(Hash) && node["marker"] == "s1" && Margin::Usj.plain_text(node["content"]) == title
    }
    nodes[(start + 1)..] || []
  end

  def verse_numbers(node)
    found = []
    Margin::Usj.walk(node) { |kind, value| found << value if kind == :verse }
    found
  end
end
