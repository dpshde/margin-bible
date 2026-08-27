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
    assert_equal "/mat.4.18-22?xref=1", refs[0]["href"]
    assert_equal "/mrk.1.16-20?xref=1", refs[1]["href"]
    assert_equal "/luk.5.1-11?xref=1", refs[2]["href"]
    refute_includes html, ">Luke<"
    refute_includes html, ">5:1–11)<"
    r = doc.at_css(".pub-r")
    refute_match(/\A\(/, r.text.strip)
    refute_match(/\)\z/, r.text.strip)
  end

  test "USJ loc becomes an in-app reader slug" do
    html = render_refs(
      { "type" => "ref", "loc" => "MAT 4:18-22", "content" => [ "Matthew 4:18–22" ] },
      "; ",
      { "type" => "ref", "loc" => "LUK 5:1-11", "content" => [ "Luke 5:1–11" ] }
    )

    doc = Nokogiri::HTML.fragment(html)
    assert_equal "/mat.4.18-22?xref=1", doc.at_css("a.pub-ref")["href"]
    assert_equal "/luk.5.1-11?xref=1", doc.css("a.pub-ref").last["href"]
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
    assert vtext.at_css(".vrun")
    assert vtext.at_css(".vrun .wj").text.include?("What is your name?")
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
    refute first.at_css(".note-tray")
    assert legion.at_css(".note-tray[data-verse-composer]:not([hidden])")
  end

  test "has-note marks the first fragment, not a continuation paragraph" do
    html = render_usj_chapter(
      Margin::Usj.chapter_nodes("GEN", 1),
      chapter: Margin::Passage.parse("gen.1"),
      notes_by_verse: {
        5 => [ Struct.new(:slug, :blocks, :passage, :bookmarked?).new("gen.1.5", [], Margin::Passage.parse("gen.1.5"), false) ]
      },
      span_start: nil,
      span_end: nil,
      range_slug: nil,
      range_selected: false,
      single_selected: false,
      passage_label: "Genesis 1"
    )
    doc = Nokogiri::HTML.fragment(html)
    first = doc.at_css("#v5")
    rest = doc.css(%(.verse[data-verse="5"])).find { |node| node["id"] != "v5" }
    assert first
    assert rest
    assert_includes first["class"].split, "has-note"
    refute_includes rest["class"].split, "has-note"
    assert_includes rest["class"].split, "is-continuation"
  end

  test "Genesis 1 unknown USFM paras still emit every verse" do
    html = render_usj_chapter(
      Margin::Usj.chapter_nodes("GEN", 1),
      chapter: Margin::Passage.parse("gen.1"),
      notes_by_verse: {},
      span_start: 1,
      span_end: 2,
      range_slug: "gen.1.1-2",
      range_selected: true,
      single_selected: false,
      passage_label: "Genesis 1:1–2"
    )
    doc = Nokogiri::HTML.fragment(html)
    nums = doc.css("[data-verse]").map { |node| node["data-verse"].to_i }.uniq.sort
    assert_equal (1..31).to_a, nums
    assert_includes doc.at_css("#v1")["class"], "is-span"
    refute_includes doc.at_css("#v3")["class"], "is-span"
    assert doc.at_css("#v1 .vrun")
  end

  test "xref selected verses highlight without opening trays" do
    html = render_usj_chapter(
      [
        {
          "type" => "para", "marker" => "p", "content" => [
            { "type" => "verse", "number" => "16", "sid" => "JHN 1:16" },
            "From His fullness we have all received."
          ]
        }
      ],
      chapter: Margin::Passage.parse("jhn.1"),
      notes_by_verse: {},
      span_start: 16,
      span_end: 16,
      range_slug: nil,
      range_selected: false,
      single_selected: false,
      xref_selected: true,
      passage_label: "John 1:16"
    )
    doc = Nokogiri::HTML.fragment(html)
    verse = doc.at_css("#v16")
    assert_includes verse["class"], "is-xref"
    refute_includes verse["class"], "is-open"
    refute_includes verse["class"], "is-span"
    assert verse.at_css(".vtext > .vrun")
  end

  test "a string-only r line still wraps only at the semicolon" do
    html = render_refs("(Matthew 4:18–22; Mark 1:16–20; Luke 5:1–11)")

    doc = Nokogiri::HTML.fragment(html)
    refs = doc.css("a.pub-ref")
    assert_equal [ "Matthew 4:18–22", "Mark 1:16–20", "Luke 5:1–11" ], refs.map(&:text)
    assert_equal "/luk.5.1-11?xref=1", refs.last["href"]
    refute_match(/\A\(/, doc.at_css(".pub-r").text.strip)
    refute_match(/\)\z/, doc.at_css(".pub-r").text.strip)
  end

  test "parallel ref groups follow section headings" do
    groups = Margin::Usj.parallel_ref_groups(Margin::Usj.chapter_nodes("GEN", 1))
    first = groups.first
    assert_equal "The Creation", first[:heading]
    texts = first[:refs].map { |ref| ref[:text] }
    assert texts.any? { |text| text.include?("John 1") }
    assert first[:refs].all? { |ref| ref[:passage] }
  end

  test "section outline lists every heading and anchors the HTML" do
    nodes = Margin::Usj.chapter_nodes("GEN", 1)
    outline = Margin::Usj.section_outline(nodes)
    assert_equal "The Creation", outline.first[:heading]
    assert_equal "s1", outline.first[:marker]
    assert outline.first[:refs].any? { |ref| ref[:text].include?("John 1") }
    first_day = outline.find { |section| section[:heading] == "The First Day" }
    assert first_day
    assert_equal "s2", first_day[:marker]
    assert_equal [], first_day[:refs]

    html = render_usj_chapter(
      nodes,
      chapter: Margin::Passage.parse("gen.1"),
      notes_by_verse: {},
      span_start: nil,
      span_end: nil,
      range_slug: nil,
      range_selected: false,
      single_selected: false,
      passage_label: "Genesis 1"
    )
    doc = Nokogiri::HTML.fragment(html)
    assert_equal outline.first[:id], doc.at_css("h2.section-head")["id"]
    assert_equal first_day[:id], doc.css("h3.section-sub").find { |node| node.text == "The First Day" }["id"]
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
