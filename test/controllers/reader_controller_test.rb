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
