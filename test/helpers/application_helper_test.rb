# frozen_string_literal: true

require "test_helper"

class ApplicationHelperTest < ActionView::TestCase
  test "wiki_note_html leaves raw markers out of storage and renders inline markdown" do
    html = wiki_note_html("See **John** and *grace* and `logos` plus [[jhn.1.6|next]]")
    assert_includes html, "<strong>John</strong>"
    assert_includes html, "<em>grace</em>"
    assert_includes html, "<code>logos</code>"
    assert_includes html, 'href="/jhn.1.6"'
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
end
