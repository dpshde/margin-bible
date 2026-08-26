# frozen_string_literal: true

require "test_helper"

class HomeControllerTest < ActionDispatch::IntegrationTest
  setup do
    Verse.create!(
      translation: "BSB",
      book: "JHN",
      chapter: 1,
      verse: 1,
      text: "In the beginning was the Word."
    )
    Verse.create!(
      translation: "BSB",
      book: "JHN",
      chapter: 3,
      verse: 16,
      text: "For God so loved the world."
    )
  end

  test "root renders the notes inbox instead of redirecting" do
    get root_path
    assert_response :success
    assert_select "h1.topbar-title", "Notes"
    assert_select "[data-inbox-signed-in-value='false']"
    assert_select ".inbox-empty", /No notes yet/
    assert_select "main.inbox-main form.jump input#q"
    assert_no_match %r{\Ahttp://www\.example\.com/jhn\.1}, response.headers["Location"].to_s
  end

  test "empty inbox and continue last-read stay quiet" do
    get read_path("jhn.1")
    get root_path
    assert_select ".inbox-empty", /Open a passage and write under a verse/
    assert_select ".inbox-continue a[href='/jhn.1']", "Continue John 1"
    assert_select ".inbox-card", count: 0
  end

  test "inbox lists notes newest created_at first and keeps indent" do
    get root_path
    library = Library.last
    library.update_column(:last_read_slug, "jhn.1")
    library.notes.create!(
      slug: "jhn.3.16", osis: "JHN.3.16", kind: "verse", book: "JHN", chapter: 3,
      verse_start: 16,
      blocks: [
        { "id" => "p", "indent" => 0, "text" => "Parent thought" },
        { "id" => "c", "indent" => 1, "text" => "Child thought" }
      ],
      created_at: 2.days.ago
    )
    library.notes.create!(
      slug: "jhn.3.16-18", osis: "JHN.3.16-18", kind: "range", book: "JHN", chapter: 3,
      verse_start: 16, verse_end: 18,
      blocks: [ { "id" => "r", "indent" => 0, "text" => "Range thought" } ],
      created_at: 1.hour.ago
    )
    library.notes.create!(
      slug: "jhn.1", osis: "JHN.1", kind: "chapter", book: "JHN", chapter: 1,
      blocks: [ { "id" => "ch", "indent" => 0, "text" => "Chapter thought" } ],
      created_at: 30.minutes.ago
    )

    get root_path
    assert_select ".inbox-empty", count: 0
    titles = css_select(".inbox-card-title").map { |node| node.text.strip }
    assert_equal [ "John 1", "John 3:16–18", "John 3:16" ], titles
    assert_select ".inbox-card[href='/jhn.1?chapter_note=1']"
    assert_select ".inbox-card[href='/jhn.3.16-18']"
    assert_select ".inbox-card[href='/jhn.3.16']"
    assert_select ".inbox-preview .preview-line[style='--depth: 1']", "Child thought"
    assert_select ".inbox-day", /Today/
  end

  test "bookmarked notes sit in a Bookmarks section at the top" do
    get root_path
    library = Library.last
    library.notes.create!(
      slug: "jhn.3.16", osis: "JHN.3.16", kind: "verse", book: "JHN", chapter: 3,
      verse_start: 16, blocks: [ { "id" => "n", "indent" => 0, "text" => "Love." } ],
      created_at: 1.hour.ago
    )
    library.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ { "id" => "b", "indent" => 0, "text" => "Logos." } ],
      bookmarked: true,
      created_at: 2.days.ago
    )

    get root_path
    days = css_select(".inbox-day").map { |node| node.text.strip }
    assert_equal [ "Bookmarks", "Today" ], days
    titles = css_select(".inbox-card-title").map { |node| node.text.strip }
    assert_equal [ "John 1:1", "John 3:16" ], titles
    assert_select ".inbox-card.is-bookmarked[href='/jhn.1.1']"
    assert_select ".inbox-card.is-bookmarked", count: 1
  end

  test "inbound q from route.bible opens the passage" do
    get root_path, params: { q: "John 3:16" }
    assert_redirected_to read_path("jhn.3.16")
  end

  test "inbound osis from route.bible opens the passage" do
    get root_path, params: { osis: "JHN.3.16" }
    assert_redirected_to read_path("jhn.3.16")
  end

  test "inbound ref from route.bible opens a range" do
    get root_path, params: { ref: "John 3:16-18" }
    assert_redirected_to read_path("jhn.3.16-18")
  end

  test "unparseable inbound q stays on the inbox" do
    get root_path, params: { q: "not-a-passage" }
    assert_response :success
    assert_select "h1.topbar-title", "Notes"
  end

  test "clicking an inbox card opens the note slug" do
    get root_path
    Library.last.notes.create!(
      slug: "jhn.3.16", osis: "JHN.3.16", kind: "verse", book: "JHN", chapter: 3,
      verse_start: 16, blocks: [ { "id" => "n", "indent" => 0, "text" => "Love." } ]
    )
    get root_path
    get css_select(".inbox-card").first["href"]
    assert_response :success
    assert_select "h1.topbar-title", /John 3:16/
    assert_select ".outliner[data-slug='jhn.3.16'] .otext", "Love."
  end
end
