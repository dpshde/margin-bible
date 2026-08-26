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

  test "hydrates John 1 from the pack without a full Bible in sqlite" do
    Verse.delete_all
    assert_equal 0, Verse.count

    get read_path("jhn.1")
    assert_response :success
    assert_select ".vtext", /In the beginning was the Word/
    assert_select "h2.section-head", "The Beginning"
    assert_select %(link[rel="prefetch"][href="/luk.24"])
    assert_select %(link[rel="prefetch"][href="/jhn.2"])
    assert_select %(a[data-turbo-prefetch="true"][href="/luk.24"])
    assert_select %(a[data-turbo-prefetch="true"][href="/jhn.2"])
    assert_equal Verse.where(book: "JHN", chapter: 1).count, Verse.count
    assert Verse.count.positive?
    assert_equal 0, Verse.where.not(book: "JHN", chapter: 1).count
  end

  test "a verse slug hydrates the whole chapter page" do
    Verse.delete_all
    get read_path("jhn.1.16")
    assert_response :success
    assert_select ".vtext", /In the beginning was the Word/
    assert_select "#v16"
    assert_select "[data-reader-focus-value='16']"
    assert Verse.where(book: "JHN", chapter: 1).count > 1
  end

  test "a verse URL expands that verse tray" do
    Verse.delete_all
    get read_path("jhn.1.16")
    assert_response :success
    assert_select "#v16.is-open"
    assert_select "#v16.is-span"
    assert_select "#v16 .note-tray:not([hidden]) .outliner[data-slug='jhn.1.16']"
    assert_select "#v1.is-open", count: 0
    assert_select "h1.topbar-title", "John 1:16"
  end

  test "a claimed library cookie stays signed in when opening a verse URL" do
    user = User.create!(email: "reader@example.com")
    get root_path
    Library.last.update!(user: user)

    get read_path("jhn.1.1")
    assert_response :success
    assert_select "[data-reader-signed-in-value='true']"
    assert_select "#v1.is-open"
    assert_select "#v1 .note-tray:not([hidden]) .outliner[data-slug='jhn.1.1']"
    assert_select "header.topbar details.topbar-menu a.menu-item", text: "Passkeys", count: 0
  end

  test "a missing chapter still 404s" do
    get read_path("jhn.99")
    assert_response :not_found
    assert_select "h1", /No BSB text/
    assert_equal 0, Verse.where(book: "JHN", chapter: 99).count
  end

  test "reads a chapter with pericope headings" do
    get read_path("jhn.1")
    assert_response :success
    assert_select "[data-reader-signed-in-value='false']"
    assert_select %(meta[name="viewport"][content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"])
    assert_select "h2.section-head", "The Beginning"
    assert_select "h2.section-head", "The Witness of John"
    assert_select ".vtext", /beginning was the Word/
  end

  test "browser header is inbox, title, copy, and a desktop overflow" do
    get read_path("jhn.1")
    assert_select "header.topbar[data-controller='chrome'][data-chrome-edge-value='top'][data-action='chrome:reveal->chrome#show']" do
      assert_select ".topbar-side a.inbox-link[href='/'][aria-label='Notes inbox'][data-action='click->reader#flushPending']"
      assert_select "h1.topbar-title", "John 1"
      assert_select "button.topbar-title-btn[data-action='click->reader#toggleChapterGrid'][aria-haspopup='dialog'][aria-controls='chapter-grid']", "John 1"
      assert_select "button.header-quiet-button[data-action='click->reader#toggleQuiet'][aria-label='Focus']"
      assert_select "button.header-copy-button[data-action='click->reader#copyPassage'][aria-label='Copy chapter text and notes']"
      assert_select ".header-copy-button svg.copy-idle"
      assert_select ".header-copy-button .copy-done"
      assert_select ".topbar-actions details.reader-actions-menu summary[aria-label='Reader actions']"
      assert_select "a", text: "Sign in", count: 0
      assert_select "a", text: "Passkeys", count: 0
      assert_select "a", text: "Margin", count: 0
    end
    assert_select ".reader-dock-btn[aria-label='Reader actions'] svg"
    assert_select ".dock-item svg"
    assert_select ".dock-item", text: "Share", count: 0
    assert_select ".dock-item", text: "Export", count: 0
    assert_select "[data-action='click->reader#sharePassage']", count: 0
    assert_select "[data-action='click->reader#exportDocument']", count: 0
    assert_select ".dock-item[data-action='click->reader#toggleQuiet']", "Focus"
    assert_select ".dock-item[data-action='click->reader#toggleChapter']", "Chapter note"
    assert_select ".dock-item[data-action='click->reader#toggleExpand'][aria-pressed='false']", "Expand notes"
    assert_select ".dock-item[data-action='click->reader#toggleNums'][data-reader-target='numsToggle'][aria-pressed='false']", "Hide verse numbers"
    assert_select ".dock-theme .theme-seg button[data-theme-pref='light']", "Light"
    assert_select ".dock-theme .theme-seg button[data-theme-pref='system']", "System"
    assert_select ".dock-theme .theme-seg button[data-theme-pref='dark']", "Dark"
    assert_select "header.topbar form.jump", count: 0
    assert_select "main.reader .reader-chrome[data-controller='chrome']"
    assert_select ".reader-veil[aria-hidden='true']"
    assert_select "main.reader .reader-chrome .chrome-bar form.jump"
    assert_select "main.reader .reader-chrome .chrome-bar .reader-dock"
    assert_select "main.reader .reader-chrome form.jump" do
      assert_select "input#q[type=search][placeholder='John 3:16']"
      assert_select "ul.suggest"
      assert_select "button", text: /Search/, count: 0
    end
    assert_select "main.reader > form.jump", count: 0
    assert_select ".fn", count: 0
    assert_select "sup", text: "†", count: 0
  end

  test "First Disciples is several USJ paragraphs with a poetry pair at 1:23" do
    Verse.delete_all
    get read_path("jhn.1")
    assert_select "h2.section-head[data-usfm='s1']", "The Beginning"
    assert_select "h2.section-head[data-usfm='s1']", "The Witness of John"
    assert_select "h2.section-head[data-usfm='s1']", "The Word Became Flesh"
    assert_select "h2.section-head[data-usfm='s1']", "The First Disciples"
    first = css_select("h2.section-head").find { |node| node.text == "The First Disciples" }
    assert first
    assert_equal "r", first.next_element["data-usfm"]
    xref = first.next_element
    assert_equal "pub-r", xref["class"]
    refs = xref.css("a.pub-ref")
    assert_equal [ "Matthew 4:18–22", "Mark 1:16–20", "Luke 5:1–11" ], refs.map(&:text)
    assert_equal [ "/mat.4.18-22", "/mrk.1.16-20", "/luk.5.1-11" ], refs.map { |el| el["href"] }
    refute refs.any? { |el| el.text.strip == "Luke" }
    paras = []
    node = first.next_element
    while node && node.name != "h2"
      paras << node if node["data-usfm"] == "p"
      node = node.next_element
    end
    assert_operator paras.size, :>=, 4
    assert_equal [ 35, 36, 37 ], paras[0].css("[data-verse]").map { |el| el["data-verse"].to_i }.uniq
    assert_equal [ 38 ], paras[1].css("[data-verse]").map { |el| el["data-verse"].to_i }.uniq
    refute_equal (35..42).to_a, paras[0].css("[data-verse]").map { |el| el["data-verse"].to_i }.uniq
    mission = css_select("h2.section-head").find { |node| node.text == "The Mission of John the Baptist" }
    assert mission
    isa = mission.next_element
    assert_equal "r", isa["data-usfm"]
    assert_select "a.pub-ref[href='/isa.40.1-5']", "Isaiah 40:1–5"
    assert_select "a.pub-ref[href='/mat.3.1-12']", "Matthew 3:1–12"
    replies = []
    node = isa.next_element
    while node && node.name != "h2"
      if node["data-usfm"] == "p" && node.css(".vnum").empty? && node.text.match?(/I am not|Prophet|He answered/)
        replies << node
      end
      node = node.next_element
    end
    assert_equal 3, replies.size
    replies.each do |para|
      assert para.at_css(".verse-press > .vtext")
      assert_nil para.at_css(".vnum")
      assert para.at_css(".pub-line") || para["class"].to_s.include?("pub-line")
    end
    assert_select ".pub-q1[data-usfm='q1']", /voice of one calling/
    assert_select ".pub-q2[data-usfm='q2']", /Make straight the way for the Lord/
    assert_select ".vnum[data-usfm='v']", "35"
    assert_select ".wj", /What do you want/
  end

  test "chapter title opens this book's chapter grid" do
    get read_path("jhn.1")
    assert_select "button.topbar-title-btn[aria-haspopup='dialog'][aria-expanded='false'][aria-controls='chapter-grid']", "John 1"
    assert_select ".chapter-grid[hidden][role='dialog'][aria-labelledby='chapter-grid-heading']" do
      assert_select "button.chapter-grid-book#chapter-grid-heading[data-action='click->reader#toggleBookPicker']", "John"
      assert_select ".chapter-grid-books[hidden]"
      assert_select ".chapter-grid-books .chapter-grid-group", "Old Testament"
      assert_select ".chapter-grid-books .chapter-grid-group", "New Testament"
      assert_select ".chapter-grid-books button.chapter-grid-cell[data-book]", 66
      assert_select ".chapter-grid-books button.chapter-grid-cell[data-book='GEN']", "GEN"
      assert_select ".chapter-grid-books button.chapter-grid-cell[data-book='MAT']", "MAT"
      assert_select ".chapter-grid-books button.chapter-grid-cell[data-book='REV']", "REV"
      assert_select ".chapter-grid-books button.chapter-grid-cell.is-current[data-book='JHN']", "JHN"
      assert_select "[data-reader-target='chapterCells'] a.chapter-grid-cell", 21
      assert_select "a.chapter-grid-cell.is-current[href='/jhn.1'][aria-current='page']", "1"
      assert_select "a.chapter-grid-cell[href='/jhn.2']", "2"
      assert_select "a.chapter-grid-cell[href='/jhn.21']", "21"
      assert_select "a.chapter-grid-cell[href='/gen.1']", count: 0
    end
  end

  test "hides the web topbar for a Hotwire Native client" do
    get read_path("jhn.1"), headers: { "User-Agent" => "Margin iOS; Hotwire Native iOS; Turbo Native iOS;" }
    assert_response :success
    assert_select "html.hotwire-native"
    assert_select "header.topbar", count: 0
    assert_select ".reader-dock-btn[aria-label='Reader actions']"
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
    assert_select "header.topbar a", text: /‹/, count: 0
    assert_select "header.topbar a", text: /Luke 24/, count: 0
  end

  test "canon edges omit swipe urls" do
    Verse.create!(translation: "BSB", book: "GEN", chapter: 1, verse: 1, text: "In the beginning.")
    get read_path("gen.1")
    assert_select "[data-reader-prev-url-value='']"
    assert_select "[data-reader-next-url-value='/gen.2']"

    Verse.create!(translation: "BSB", book: "REV", chapter: 22, verse: 1, text: "Then the angel showed me.")
    get read_path("rev.22")
    assert_select "[data-reader-prev-url-value='/rev.21']"
    assert_select "[data-reader-next-url-value='']"
  end

  test "verse slug still opens the chapter" do
    get read_path("jhn.1.1")
    assert_response :success
    assert_select "h1", /John 1/
  end

  test "note tray puts the route.bible icon on the label row" do
    get read_path("jhn.1")
    assert_select ".chapter-tray" do
      assert_select ".outliner + .tray-head"
      assert_select ".tray-head" do
        assert_select "a.tray-label[href='https://route.bible/jhn.1'][target=_blank]", /Chapter note · John 1/
        assert_select "button.tray-copy[data-action='click->reader#copyNote'][aria-label='Copy this note']"
        assert_select "button.tray-bookmark[data-action='click->reader#toggleBookmark'][aria-pressed='false']"
        assert_select "a.tray-external[href='https://route.bible/jhn.1'][target=_blank][rel=noreferrer]"
        assert_select "button.tray-clear[data-action='click->reader#clearNote'][aria-label='Clear note']"
        assert_select "a[aria-label='Open on route.bible']"
        assert_select "a svg"
        assert_select "button.tray-close[data-action='click->reader#closeChapter'][aria-label='Hide chapter note']"
        assert_select ".tray-copy + .tray-bookmark"
        assert_select ".tray-bookmark + .tray-external"
        assert_select ".tray-external + .tray-clear"
        assert_select ".tray-clear + .tray-close"
      end
    end
    assert_select ".note-tray .tray-close", count: 0
    assert_select ".note-tray .tray-head .tray-copy + .tray-bookmark"
    assert_select ".note-tray .tray-head .tray-bookmark + .tray-external"
    assert_select ".note-tray .tray-head .tray-external + .tray-clear"
    assert_select ".tray-meta", count: 0
    assert_select ".oindent", count: 0
    assert_select ".oindent-btn", count: 0
    assert_select "[data-oindent]", count: 0
    assert_select ".tray-head", text: /Autosaves/, count: 0
    assert_select ".tray-head a", text: /route\.bible/, count: 0
    assert_select "textarea.note-input", count: 0
    assert_select ".outliner[data-slug='jhn.1'] .otext"
    assert_select ".outliner[data-slug='jhn.1'] .oblock[data-bullet='1']"
    assert_select ".outliner[data-slug='jhn.1'] .oblock.is-bullet"
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
    assert_select "#v1 .note-preview", count: 0
    assert_select "#v1 .outliner[data-slug='jhn.1']", count: 0
    assert_select "#v6 .outliner[data-slug='jhn.1.1-6'] .otext", "Range span."
    assert_select "#v6 .outliner[data-slug='jhn.1.6'] .otext"
    assert_select ".chapter-tray .outliner[data-slug='jhn.1'] .otext", "Chapter only."
  end

  test "a Genesis range keeps jump in chrome and paints span ends" do
    get read_path("gen.1.1-2")
    assert_response :success
    assert_select "#v1.is-span.is-span-start"
    assert_select "#v2.is-span.is-span-end"
    assert_select "#v2 .outliner[data-slug='gen.1.1-2']"
    assert_select "main.reader .reader-chrome .chrome-bar form.jump"
    assert_select "main.reader > form.jump", count: 0
    assert_select ".fn", count: 0
    refute_includes @response.body, "†"
  end

  test "a Matthew range marks poetry verses in the same span" do
    get read_path("mat.3.1-12")
    assert_response :success
    assert_select "#v1.is-span.is-span-start"
    assert_select "#v12.is-span.is-span-end"
    assert_select ".pub-q1 .verse.is-span", /voice of one calling/
    assert_select ".pub-q2 .verse.is-span", /straight/
    assert_select "main.reader .reader-chrome .chrome-bar form.jump"
    assert_select "main.reader > form.jump", count: 0
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
    assert_select "#v1.is-span.is-span-start"
    assert_select "#v2.is-span"
    assert_select "#v2.is-span-start", count: 0
    assert_select "#v3.is-span.is-span-end"
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

  test "reader shows the last two other places on the trail" do
    get read_path("jhn.1")
    get read_path("jhn.3.16")
    get read_path("jhn.2")
    assert_response :success
    assert_select ".reader-chrome nav.trail-inline a.trail-chip[href='/jhn.3.16']", "John 3:16"
    assert_select "nav.trail-inline a.trail-chip[href='/jhn.1']", "John 1"
    assert_select ".dock-recent a.dock-item[href='/jhn.3.16']", "John 3:16"
    assert_select ".dock-recent a.dock-item[href='/jhn.1']", "John 1"
    assert_select "nav.trail-inline a[href='/jhn.2']", count: 0
  end

  test "verse outliner renders wiki without absorbing markers" do
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
    assert_select "#v1 .outliner[data-slug='jhn.1.1'] a.wiki[href='/jhn.1.6'][data-wiki-raw='[[jhn.1.6|John]]']", "John"
    assert_select "#v1 .outliner[data-slug='jhn.1.1'] .otext", /See \*\*Word\*\* and \*life\* and `logos` and John/
    assert_select "#v1 .note-preview", count: 0
  end
end
