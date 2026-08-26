# frozen_string_literal: true

require "test_helper"

class UsjHtmlTest < ActionView::TestCase
  tests ReaderHelper

  test "each USJ ref is one unbreakable citation span" do
    html = render_refs(
      "(",
      { "type" => "ref", "content" => [ "Matthew 4:18–22" ] },
      "; ",
      { "type" => "ref", "content" => [ "Mark 1:16–20" ] },
      "; ",
      { "type" => "ref", "content" => [ "Luke 5:1–11" ] },
      ")"
    )

    doc = Nokogiri::HTML.fragment(html)
    refs = doc.css("a.pub-ref")
    assert_equal [ "Matthew 4:18–22", "Mark 1:16–20", "Luke 5:1–11" ], refs.map(&:text)
    assert_equal "/mat.4.18-22", refs[0]["href"]
    assert_equal "/mrk.1.16-20", refs[1]["href"]
    assert_equal "/luk.5.1-11", refs[2]["href"]
    refute_includes html, ">Luke<"
    refute_includes html, ">5:1–11)<"
  end

  test "USJ loc becomes an in-app reader slug" do
    html = render_refs(
      { "type" => "ref", "loc" => "MAT 4:18-22", "content" => [ "Matthew 4:18–22" ] },
      "; ",
      { "type" => "ref", "loc" => "LUK 5:1-11", "content" => [ "Luke 5:1–11" ] }
    )

    doc = Nokogiri::HTML.fragment(html)
    assert_equal "/mat.4.18-22", doc.at_css("a.pub-ref")["href"]
    assert_equal "/luk.5.1-11", doc.css("a.pub-ref").last["href"]
  end

  test "USJ footnotes are omitted from the reading flow" do
    html = render_usj_chapter(
      [
        {
          "type" => "para", "marker" => "p", "content" => [
            { "type" => "verse", "number" => "1", "sid" => "JHN 1:1" },
            "The Word became flesh among us.",
            {
              "type" => "note", "marker" => "f", "content" => [
                { "type" => "char", "marker" => "fr", "content" => [ "1:14 " ] },
                "Or tabernacled among us"
              ]
            },
            " We have seen His glory."
          ]
        }
      ],
      chapter: Margin::Passage.parse("jhn.1"),
      notes_by_verse: {},
      span_start: nil,
      span_end: nil,
      range_slug: nil,
      range_selected: false,
      single_selected: false,
      passage_label: "John 1"
    )

    refute_includes html, "†"
    refute_includes html, "class=\"fn\""
    refute_includes html, "tabernacled"
    assert_includes html, "The Word became flesh among us."
    assert_includes html, "We have seen His glory."
  end

  test "Mark 5:9 keeps wj and the attribution inside vtext, not the gutter" do
    html = render_usj_chapter(
      Margin::Usj.chapter_nodes("MRK", 5),
      chapter: Margin::Passage.parse("mrk.5"),
      notes_by_verse: {},
      span_start: 9,
      span_end: 9,
      range_slug: "mrk.5.9",
      range_selected: false,
      single_selected: true,
      passage_label: "Mark 5:9"
    )
    doc = Nokogiri::HTML.fragment(html)
    first = doc.at_css("#v9")
    assert first
    refute_includes first.parent["class"].to_s.split, "wj"
    vtext = first.at_css(".verse-press > .vtext")
    assert vtext
    assert vtext.at_css(".wj").text.include?("What is your name?")
    assert_includes vtext.text, "Jesus asked."
    refute_includes first.at_css(".verse-press").children.select { |n| n.text? }.map(&:text).join, "Jesus asked."

    quote_para = first.parent
    assert_equal "p", quote_para["data-usfm"]
    assert_empty quote_para.css("[data-verse='8']")

    legion = doc.css(%(.verse[data-verse="9"])).find { |node| node["id"] != "v9" }
    assert legion
    assert_includes legion["class"], "is-continuation"
    assert_nil legion.at_css(".vnum")
    assert_includes legion.at_css(".verse-press > .vtext").text, "My name is Legion"
    assert_equal quote_para.next_element, legion.parent
  end

  test "a string-only r line still wraps only at the semicolon" do
    html = render_refs("(Matthew 4:18–22; Mark 1:16–20; Luke 5:1–11)")

    refs = Nokogiri::HTML.fragment(html).css("a.pub-ref")
    assert_equal [ "Matthew 4:18–22", "Mark 1:16–20", "Luke 5:1–11" ], refs.map(&:text)
    assert_equal "/luk.5.1-11", refs.last["href"]
  end

  private

  def render_refs(*content)
    render_usj_chapter(
      [ { "type" => "para", "marker" => "r", "content" => content } ],
      chapter: Margin::Passage.parse("jhn.1"),
      notes_by_verse: {},
      span_start: nil,
      span_end: nil,
      range_slug: nil,
      range_selected: false,
      single_selected: false,
      passage_label: "John 1"
    )
  end
end
