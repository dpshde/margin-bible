# frozen_string_literal: true

require "test_helper"

class ApplicationHelperTest < ActionView::TestCase
  test "wiki_note_html leaves raw markers out of storage and renders inline markdown" do
    html = wiki_note_html("See **John** and *grace* and _mercy_ and `logos` plus [[jhn.1.6|next]]")
    assert_includes html, "<strong>John</strong>"
    assert_includes html, "<em>grace</em>"
    assert_includes html, "<em>mercy</em>"
    assert_includes html, "<code>logos</code>"
    assert_includes html, 'href="/jhn.1.6?xref=1"'
    assert_includes html, 'class="wiki"'
    assert_includes html, ">next</a>"
    refute_includes html, "**John**"
    refute_includes html, "`logos`"
  end

  test "wiki_note_html does not parse markdown inside code" do
    html = wiki_note_html("use `**bold**` and `[[jhn.1]]`")
    assert_includes html, "<code>**bold**</code>"
    assert_includes html, "<code>[[jhn.1]]</code>"
    refute_includes html, "<strong>"
    refute_includes html, 'class="wiki"'
  end

  test "wiki_note_html can render wiki labels without nested links" do
    html = wiki_note_html("See [[jhn.1.6|John]]", links: false)
    assert_includes html, "John"
    refute_includes html, "<a"
  end

  test "wiki_note_html escapes html and keeps unknown wiki raw" do
    html = wiki_note_html("<em>x</em> and [[not-a-passage]]")
    assert_includes html, "&lt;em&gt;x&lt;/em&gt;"
    assert_includes html, "[[not-a-passage]]"
    refute_includes html, "<em>x</em>"
  end

  test "wiki_outliner_html turns scripture wiki into a non-editable link" do
    html = wiki_outliner_html("See [[jhn.1.6|the Baptist]] and [[John 1]]")
    assert_includes html, 'href="/jhn.1.6?xref=1"'
    assert_includes html, 'data-wiki-raw="[[jhn.1.6|the Baptist]]"'
    assert_includes html, "contenteditable=\"false\""
    assert_includes html, ">the Baptist</a>"
    assert_includes html, 'href="/jhn.1"'
    assert_includes html, ">John 1</a>"
    html = wiki_outliner_html("[[not-a-passage]]")
    assert_includes html, "[[not-a-passage]]"
    refute_includes html, "class=\"wiki\""
  end

  test "wiki_outliner_html renders display-only bold and italics" do
    html = wiki_outliner_html("See **Word** and *life* and _light_")
    assert_includes html, "<strong>Word</strong>"
    assert_includes html, "<em>life</em>"
    assert_includes html, "<em>light</em>"
    refute_includes html, "**Word**"
    refute_includes html, "*life*"
    refute_includes html, "_light_"
  end
end
