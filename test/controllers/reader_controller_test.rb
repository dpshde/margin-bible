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

  test "browser header is inbox, title, and one menu" do
    get read_path("jhn.1")
    assert_select "header.topbar" do
      assert_select ".topbar-side a.inbox-link[href='/'][aria-label='Notes inbox']"
      assert_select "h1.topbar-title", "John 1"
      assert_select ".topbar-actions details.topbar-menu", 1
      assert_select ".menu-item[data-action='click->reader#share']", "Share"
      assert_select ".menu-item[data-action='click->reader#toggleChapter']", "Chapter note"
      assert_select ".menu-item[data-action='click->reader#toggleExpand']", "Expand notes"
      assert_select "a.menu-item", "Sign in"
      assert_select "a", text: "Margin", count: 0
    end
    assert_select "header.topbar form.jump", count: 0
    assert_select "main.reader form.jump" do
      assert_select "input#q[type=search][placeholder='John 3:16']"
      assert_select "ul.suggest"
      assert_select "button", text: /Search/, count: 0
    end
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

  test "reader exposes prev and next chapter urls for swipe" do
    get read_path("jhn.1")
    assert_select "[data-reader-prev-url-value='/luk.24']"
    assert_select "[data-reader-next-url-value='/jhn.2']"
  end

  test "verse slug still opens the chapter" do
    get read_path("jhn.1.1")
    assert_response :success
    assert_select "h1", /John 1/
  end

  test "note tray puts the route.bible icon on the label row" do
    get read_path("jhn.1")
    assert_select ".chapter-tray .tray-head" do
      assert_select ".tray-label", /Chapter note · John 1/
      assert_select "a.tray-external[href='https://route.bible/jhn.1'][target=_blank][rel=noreferrer]"
      assert_select "a[aria-label='Open on route.bible']"
      assert_select "a svg"
    end
    assert_select ".tray-meta", count: 0
    assert_select ".tray-head", text: /Autosaves/, count: 0
    assert_select ".tray-head a", text: /route\.bible/, count: 0
    assert_select "textarea.note-input", count: 0
    assert_select ".outliner[data-slug='jhn.1'] .otext"
  end

  test "autosaves a verse note" do
    get read_path("jhn.1")
    patch notes_path, params: { slug: "jhn.1.1", text: "The Logos." }
    assert_response :success
    assert Library.last.notes.find_by(slug: "jhn.1.1")
  end

  test "verse row shows exact and overlapping range notes as separate records" do
    get read_path("jhn.1")
    library = Library.last
    library.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ { "id" => "a", "indent" => 0, "text" => "Exact verse." } ]
    )
    library.notes.create!(
      slug: "jhn.1.1-6", osis: "JHN.1.1-6", kind: "range", book: "JHN", chapter: 1,
      verse_start: 1, verse_end: 6, blocks: [ { "id" => "b", "indent" => 0, "text" => "Range span." } ]
    )
    library.notes.create!(
      slug: "jhn.1", osis: "JHN.1", kind: "chapter", book: "JHN", chapter: 1,
      blocks: [ { "id" => "c", "indent" => 0, "text" => "Chapter only." } ]
    )

    get read_path("jhn.1")
    assert_select "#v1 .outliner[data-slug='jhn.1.1'] .otext", "Exact verse."
    assert_select "#v1 .outliner[data-slug='jhn.1.1-6'] .otext", "Range span."
    assert_select "#v1 .preview-body", "Exact verse."
    assert_select "#v1 .preview-body", "Range span."
    assert_select "#v1 .outliner[data-slug='jhn.1']", count: 0
    assert_select "#v6 .outliner[data-slug='jhn.1.1-6'] .otext", "Range span."
    assert_select "#v6 .outliner[data-slug='jhn.1.6'] .otext"
    assert_select ".chapter-tray .outliner[data-slug='jhn.1'] .otext", "Chapter only."
  end

  test "range slug marks the span and opens one range tray" do
    [ 2, 3 ].each do |n|
      Verse.create!(
        translation: "BSB", book: "JHN", chapter: 1, verse: n,
        text: "Verse #{n}."
      )
    end

    get read_path("jhn.1.1-3")
    assert_response :success
    assert_select "#v1.is-span"
    assert_select "#v2.is-span"
    assert_select "#v3.is-span"
    assert_select "#v3.is-open"
    assert_select "#v1.is-open", count: 0
    assert_select "#v3 .outliner[data-slug='jhn.1.1-3']"
    assert_select "#v1 .outliner[data-slug='jhn.1.1-3']", count: 0
    assert_select "#v2 .outliner[data-slug='jhn.1.1-3']", count: 0
    assert_select "h1.topbar-title", "John 1:1–3"
  end

  test "verse notes on 1 and 2 still render separately on a range deep link" do
    [ 2, 3 ].each do |n|
      Verse.create!(
        translation: "BSB", book: "JHN", chapter: 1, verse: n,
        text: "Verse #{n}."
      )
    end
    get read_path("jhn.1")
    library = Library.last
    library.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ { "id" => "n1", "indent" => 0, "text" => "Note on 1." } ]
    )
    library.notes.create!(
      slug: "jhn.1.2", osis: "JHN.1.2", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 2, blocks: [ { "id" => "n2", "indent" => 0, "text" => "Note on 2." } ]
    )

    get read_path("jhn.1.1-3")
    assert_select "#v1.is-span"
    assert_select "#v2.is-span"
    assert_select "#v3.is-span"
    assert_select "#v1 .outliner[data-slug='jhn.1.1']", "Note on 1."
    assert_select "#v2 .outliner[data-slug='jhn.1.2']", "Note on 2."
    assert_select "#v3 .outliner[data-slug='jhn.1.1-3']"
    assert_select "#v1 .outliner[data-slug='jhn.1.1-3']", count: 0
    assert_select "#v3 .outliner[data-slug='jhn.1.1']", count: 0
  end

  test "expand preview renders wiki and inline markdown without absorbing markers" do
    get read_path("jhn.1")
    Library.last.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ {
        "id" => "b_md01",
        "indent" => 0,
        "text" => "See **Word** and *life* and `logos` and [[jhn.1.6|John]]"
      } ]
    )

    get read_path("jhn.1")
    assert_select "#v1 .outliner[data-slug='jhn.1.1'] .otext", "See **Word** and *life* and `logos` and [[jhn.1.6|John]]"
    assert_select "#v1 .preview-body strong", "Word"
    assert_select "#v1 .preview-body em", "life"
    assert_select "#v1 .preview-body code", "logos"
    assert_select "#v1 .preview-body a.wiki[href='/jhn.1.6']", "John"
  end
end
