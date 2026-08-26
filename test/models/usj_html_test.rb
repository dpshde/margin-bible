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

    refs = Nokogiri::HTML.fragment(html).css(".pub-ref").map(&:text)
    assert_equal [ "Matthew 4:18–22", "Mark 1:16–20", "Luke 5:1–11" ], refs
    assert_includes html, "</span>; <span class=\"pub-ref\">Luke 5:1–11</span>)"
    refute_includes html, ">Luke<"
    refute_includes html, ">5:1–11)<"
  end

  test "a string-only r line still wraps only at the semicolon" do
    html = render_refs("(Matthew 4:18–22; Mark 1:16–20; Luke 5:1–11)")

    refs = Nokogiri::HTML.fragment(html).css(".pub-ref").map(&:text)
    assert_equal [ "Matthew 4:18–22", "Mark 1:16–20", "Luke 5:1–11" ], refs
    assert_includes html, "</span>; <span class=\"pub-ref\">Luke 5:1–11</span>)"
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
