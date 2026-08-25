# frozen_string_literal: true

require "test_helper"

class ReaderControllerTest < ActionDispatch::IntegrationTest
  setup do
    Verse.create!(
      translation: "BSB",
      book: "JHN",
      chapter: 1,
      verse: 1,
      text: "In the beginning was the Word.",
      heading: "The Beginning"
    )
    Verse.create!(
      translation: "BSB",
      book: "JHN",
      chapter: 1,
      verse: 6,
      text: "There came a man who was sent from God.",
      heading: "The Witness of John"
    )
  end

  test "reads a chapter with pericope headings" do
    get read_path("jhn.1")
    assert_response :success
    assert_select "h2.section-head", "The Beginning"
    assert_select "h2.section-head", "The Witness of John"
    assert_select ".vtext", /beginning was the Word/
  end

  test "browser header is previous chapter, title, and one menu" do
    get read_path("jhn.1")
    assert_select "header.topbar" do
      assert_select ".topbar-side"
      assert_select "h1.topbar-title", "John 1"
      assert_select ".topbar-actions details.topbar-menu", 1
      assert_select ".menu-item[data-action='click->reader#share']", "Share"
      assert_select ".menu-item[data-action='click->reader#toggleChapter']", "Chapter note"
      assert_select ".menu-item[data-action='click->reader#toggleExpand']", "Expand notes"
      assert_select "a.menu-item", "Sign in"
      assert_select "a", text: "Margin", count: 0
    end
    assert_select "header.topbar form.jump", count: 0
    assert_select "main.reader form.jump"
  end

  test "hides the web topbar for a Hotwire Native client" do
    get read_path("jhn.1"), headers: { "User-Agent" => "Margin iOS; Hotwire Native iOS; Turbo Native iOS;" }
    assert_response :success
    assert_select "header.topbar", count: 0
    assert_select "title", "John 1"
    assert_select "main.reader form.jump"
    assert_select ".vtext", /beginning was the Word/
  end

  test "hides the web topbar for a Turbo Native user agent" do
    get read_path("jhn.1"), headers: { "User-Agent" => "Turbo Native iOS" }
    assert_select "header.topbar", count: 0
  end

  test "verse slug still opens the chapter" do
    get read_path("jhn.1.1")
    assert_response :success
    assert_select "h1", /John 1/
  end

  test "autosaves a verse note" do
    get read_path("jhn.1")
    patch notes_path, params: { slug: "jhn.1.1", text: "The Logos." }
    assert_response :success
    assert Library.last.notes.find_by(slug: "jhn.1.1")
  end
end
