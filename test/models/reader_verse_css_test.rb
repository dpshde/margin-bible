# frozen_string_literal: true

require "test_helper"

class ReaderVerseCssTest < ActiveSupport::TestCase
  def css
    Rails.root.join("app/assets/stylesheets/application.css").read
  end

  test "open verse is a thin rail, not a filled rounded island" do
    refute_match(/\.verse\.is-open\s*\{[^}]*background:/m, css)
    refute_match(/\.verse\.is-span\s*\{[^}]*background:/m, css)
    refute_match(/\.verse\.is-span \.vtext\s*\{[^}]*background:/m, css)
    refute_match(/--mark-fill/, css)
    mark = css[/\.verse\.is-span \.vrun,\s*\n\.verse\.is-xref \.vrun,\s*\n\.is-quiet \.verse\.is-open \.vrun\s*\{[^}]+\}/]
    assert mark
    assert_match(/background:\s*color-mix\(in srgb, var\(--ink\) 4%, transparent\)/, mark)
    assert_match(/box-decoration-break:\s*clone/, mark)
    refute_match(/\.verse\.is-xref \.vtext\s*\{[^}]*background:/m, css)
    refute_match(/\.verse\.is-xref\s*\{[^}]*::before/, css)
    has_note = css[/\.verse\.has-note\s*\{[^}]+\}/]
    assert_match(/border-left:/, has_note)
    refute_match(/background:/, has_note)
    refute_match(/border-radius:/, has_note)
    assert_match(/\.verse\.is-continuation\.has-note,/, css)
    assert_match(/\.verse\.is-continuation \.rail\s*\{[^}]*display:\s*none/, css)
  end

  test "continuation verse-press keeps vtext out of the number gutter" do
    assert_match(/\.verse-press > \.vtext,\s*\n\.verse-press > :not\(\.vnum\)\s*\{[^}]*grid-column:\s*2/, css)
    assert_match(/\.is-nums-hidden \.verse-press > \.vtext,\s*\n\.is-nums-hidden \.verse-press > :not\(\.vnum\)\s*\{[^}]*grid-column:\s*1/, css)
    assert_match(/\.is-quiet \.verse-press\s*\{[^}]*display:\s*contents/, css)
    assert_match(/\.is-quiet \.verse-press\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, css)
    assert_match(/\.is-quiet \.verse-press > \.vtext,\s*\n\.is-quiet \.verse-press > :not\(\.vnum\)\s*\{[^}]*grid-column:\s*unset/, css)
    assert_match(/\.pub-line\s*\{[^}]*width:\s*100%/, css)
  end

  test "phone verse number column is narrow" do
    phone = css[/@media \(max-width: 390px\)\s*\{[\s\S]*?\n\}/]
    assert phone
    assert_match(/--verse-gutter:\s*1\.05rem/, phone)
    assert_match(/--verse-gutter-gap:\s*\.45rem/, phone)
    assert_match(/--verse-inset:\s*\.2rem/, phone)
    assert_match(/padding-left:\s*var\(--verse-inset\)/, phone)
  end

  test "header copy flashes a check when pressed" do
    assert_match(/\.header-copy-button\.is-copied\s*\{\s*color:\s*var\(--ink\)/, css)
    assert_match(/\.header-copy-button\.is-copied \.copy-idle/, css)
    assert_match(/\.header-copy-button\.is-copied \.copy-done\s*\{[^}]*display:\s*inline-flex/, css)
    assert_match(/@keyframes copy-confirm/, css)
  end

  test "quiet reading hides the note rail and selection chrome" do
    rail = css[/\.is-quiet \.rail,\s*\.is-quiet \.note-card:not\(:has\(\.note-tray:not\(\[hidden\]\)\)\),\s*\.is-quiet \.note-tray\[hidden\],\s*\.is-quiet \.tray-head\s*\{[^}]+\}/]
    assert rail
    assert_match(/display:\s*none/, rail)
    refute_includes rail, ".oindent"
    refute_match(/\.oindent/, css)
    refute_match(/\.is-quiet \.obullet\s*\{\s*display:\s*none/, css)
    assert_match(/\.is-quiet \.oblock\.is-bullet \.obullet\s*\{[^}]*display:\s*block/, css)
    assert_match(/\.is-quiet \.chapter-tray\s*\{\s*display:\s*none/, css)
    quiet = css[/\.is-quiet \.verse\.has-note,\s*\.is-quiet \.verse\.is-open,\s*\.is-quiet \.verse\.is-span\s*\{[^}]+\}/]
    assert quiet
    assert_match(/border(?:-left)?:\s*0/, quiet)
    refute_match(/border-left-color:/, quiet)
    assert_match(/\.is-quiet \.verse\.is-open \.vrun/, css)
  end

  test "parallel refs are chrome, hidden in quiet, and nowrap per citation" do
    xref = css[/\.pub-r\s*\{[^}]+\}/]
    assert xref
    assert_match(/font-family:\s*var\(--sans\)/, xref)
    assert_match(/font-size:\s*\.72rem/, xref)
    assert_match(/color:\s*var\(--muted\)/, xref)
    refute_match(/font-family:\s*var\(--read\)/, xref)
    unit = css[/\.pub-ref\s*\{[^}]+\}/]
    assert unit
    assert_match(/white-space:\s*nowrap/, unit)
    assert_match(/display:\s*inline-block/, unit)
    assert_match(/text-decoration:\s*none/, unit)
    quiet_r = css[/\.is-quiet \.pub-r\s*\{[^}]+\}/]
    assert quiet_r
    assert_match(/display:\s*none/, quiet_r)
    assert_match(/margin:\s*0/, quiet_r)
    assert_match(/@media \(max-width: 640px\)[\s\S]*\.pub-r\s*\{\s*display:\s*none/, css)
    assert_match(/html\.hotwire-native \.pub-r\s*\{\s*display:\s*none/, css)
    assert_match(/\.dock-outline\s*\{/, css)
    assert_match(/\.dock-head\s*\{/, css)
    assert_match(/\.dock-refs \.dock-item\s*\{[^}]*gap:\s*0/, css)
  end

  test "quiet reading is a USFM paragraph, not a verse card stack" do
    assert_match(/\.pub-p, \.pub-q1, \.pub-q2\s*\{[^}]*display:\s*block/m, css)
    assert_match(/\.pub-q1, \.pub-q2\s*\{[^}]*padding-left:\s*0/m, css)
    assert_match(/\.pub-q1 \.verse-press > \.vtext\s*\{[^}]*padding-left:\s*1\.05rem/, css)
    assert_match(/\.pub-q2 \.verse-press > \.vtext\s*\{[^}]*padding-left:\s*1\.5rem/, css)
    para = css[/\.is-quiet \.pub-p,\s*\.is-quiet \.pub-q1,\s*\.is-quiet \.pub-q2\s*\{[^}]+\}/]
    assert para
    assert_match(/display:\s*block/, para)
    assert_match(/margin:\s*0/, para)
    refute_match(/margin:\s*0 0 \.36em/, para)
    refute_match(/margin:\s*0 0 \.7em/, para)
    quiet_p = css[/\.is-quiet \.pub-p\s*\{[^}]+\}/]
    assert quiet_p
    assert_match(/text-indent:\s*1\.2em/, quiet_p)
    assert_match(/\.is-quiet \.section-head \+ \.pub-p,\s*\n\.is-quiet \.section-head \+ \.pub-r \+ \.pub-p\s*\{[^}]*text-indent:\s*1\.2em/m, css)
    assert_match(/\.is-quiet \.pub-q1\s*\{[^}]*padding-left:\s*\.85rem/m, css)
    assert_match(/\.is-quiet \.pub-q2\s*\{[^}]*padding-left:\s*1\.2rem/m, css)
    assert_match(/\.is-quiet \.pub-b\s*\{[^}]*height:\s*\.18em/, css)
    assert_match(/\.is-quiet \.section-head\.spaced\s*\{[^}]*margin-top:\s*2\.25em/, css)
    assert_match(/\.is-quiet \.oblock\s*\{[^}]*display:\s*flex/, css)
    assert_match(/\.is-quiet \.oblock\s*\{[^}]*padding:[^}]*var\(--depth/, css)
    quiet_block = css[/\.is-quiet \.oblock\s*\{[^}]+\}/]
    assert quiet_block
    assert_match(/gap:\s*\.3em/, quiet_block)
    refute_match(/gap:\s*\.12rem/, quiet_block)
    refute_match(/gap:\s*\.4rem/, quiet_block)
    assert_match(/text-indent:\s*0/, quiet_block)
    quiet_otext = css[/\.is-quiet \.otext\s*\{[^}]+\}/]
    assert quiet_otext
    assert_match(/text-indent:\s*0/, quiet_otext)
    assert_match(/padding:\s*0/, quiet_otext)
    refute_match(/padding-left:/, quiet_otext)
    assert_match(/\.is-quiet \.note-tray\s*\{[^}]*padding:\s*0/, css)
    assert_match(/\.verse-press\s*\{[^}]*padding:\s*0/, css)
    assert_match(/\.verse\s*\{[^}]*display:\s*block/, css)
    assert_match(/\.verse\s*\{[^}]*padding:\s*0 0 0 var\(--verse-inset\)/, css)
    verse = css[/\.is-quiet \.verse\s*\{[^}]+\}/]
    assert verse
    assert_match(/display:\s*contents/, verse)
    assert_match(/padding:\s*0/, verse)
    refute_match(/margin-bottom:\s*[1-9]/, verse)
    press = css[/\.is-quiet \.verse-press\s*\{[^}]+\}/]
    assert press
    assert_match(/display:\s*contents/, press)
    vtext = css[/\.is-quiet \.vtext\s*\{[^}]+\}/]
    assert vtext
    assert_match(/display:\s*inline/, vtext)
    assert_match(/font-size:\s*max\(16px/, vtext)
    head = css[/\.is-quiet \.section-head\s*\{[^}]+\}/]
    assert head
    assert_match(/display:\s*block/, head)
    vnum = css[/\.is-quiet \.vnum\s*\{[^}]+\}/]
    assert vnum
    assert_match(/vertical-align:\s*super/, vnum)
    assert_match(/display:\s*inline/, vnum)
    otext = css[/\.is-quiet \.otext\s*\{[^}]+\}/]
    assert otext
    assert_match(/background:\s*transparent/, otext)
    assert_match(/border:\s*0/, otext)
    assert_match(/\.is-quiet \.outliner\s*\{/, css)
  end

  test "quiet reading hides trail pointers" do
    assert_match(/\.is-quiet \.trail-inline/, css)
    assert_match(/\.is-quiet \.dock-recent/, css)
    assert_match(/\.is-quiet \.dock-recent \+ \.dock-sep/, css)
  end

  test "quiet reading keeps chapter text below the pill" do
    quiet_reader = css[/\.is-quiet \.reader\s*\{[^}]+\}/]
    assert quiet_reader
    assert_match(/padding-top:\s*calc\(4\.25rem \+ env\(safe-area-inset-top, 0px\)\)/, quiet_reader)
  end

  test "quiet header becomes a pill that can tuck" do
    pill = css[/\.is-quiet \.topbar\s*\{[^}]+\}/]
    assert pill
    assert_match(/position:\s*fixed/, pill)
    assert_match(/border-radius:\s*999px/, pill)
    assert_match(/overflow:\s*hidden/, pill)
    assert_match(/left:\s*\.7rem/, pill)
    assert_match(/right:\s*\.7rem/, pill)
    refute_match(/100vw/, pill)
    assert_match(/\.is-quiet \.topbar\.is-tucked/, css)
    assert_match(/\.is-quiet \.header-copy-button,/, css)
    btn = css[/\.is-quiet \.topbar \.icon-btn\s*\{[^}]+\}/]
    assert btn
    assert_match(/border-radius:\s*50%/, btn)
  end

  test "quiet reading drops the chrome shell around jump" do
    quiet_chrome = css[/\.is-quiet \.reader-chrome\s*\{[^}]+\}/]
    assert quiet_chrome
    assert_match(/background:\s*transparent/, quiet_chrome)
    assert_match(/border:\s*0/, quiet_chrome)
    assert_match(/padding:\s*0/, quiet_chrome)
    assert_match(/box-shadow:\s*none/, quiet_chrome)
    refute_match(/html:not\(\.hotwire-native\)\.is-quiet \.reader-chrome/, css)
    assert_match(/html:not\(\.hotwire-native\) \.is-quiet \.reader-chrome\s*\{[^}]*background:\s*transparent/, css)
    assert_match(/\.chapter-grid-cells\[hidden\]/, css)
    assert_match(/\.chapter-grid-book::after/, css)
    refute_match(/\.is-quiet \.reader-chrome\s*\{\s*display:\s*none/, css)
    refute_match(/\.is-quiet \.jump[^{]*\{[^}]*display:\s*none/, css)
    refute_match(/\.is-quiet \.jump input\[type="search"\]\s*\{[^}]*background:\s*transparent/, css)
    refute_match(/\.reader > \.jump\s*\{/, css)
    assert_match(/\.is-quiet \.chapter-tray\s*\{\s*display:\s*none/, css)
  end

  test "range span rail is one continuous left edge" do
    span = css[/\.verse\.is-open,\s*\.verse\.is-span\s*\{[^}]+\}/]
    assert span
    assert_match(/border-left:\s*0/, span)
    rail = css[/\.verse\.is-open::before,\s*\.verse\.is-span::before\s*\{[^}]+\}/]
    assert rail
    assert_match(/width:\s*2px/, rail)
    assert_match(/background:\s*var\(--sel-rail-open\)/, rail)
    assert_match(/top:\s*0/, rail)
    assert_match(/bottom:\s*0/, rail)
    assert_match(/left:\s*calc\(-1 \* var\(--rail-shift, 0px\)\)/, rail)
    assert_match(/\.pub-q1, \.pub-q2\s*\{[^}]*--rail-shift:\s*0px/, css)
    refute_match(/\.pub-q1\s*\{[^}]*--rail-shift:\s*1\.05rem/, css)
    refute_match(/\.pub-q2\s*\{[^}]*--rail-shift:\s*1\.5rem/, css)
    assert_match(/\.pub-line:has\(> \.verse\.is-span:last-child\)/, css)
    refute_match(/\.verse\.is-span:not\(\.is-span-start\)::before/, css)
    refute_match(/::before\s*\{[^}]*top:\s*-/, css)
    refute_match(/\.verse\.is-open, \.verse\.is-span \{[^}]*border-left:\s*2px/, css)
    refute_match(/\.fn\s*\{/, css)
  end

  test "hiding verse numbers drops the gutter and the digits" do
    assert_match(/\.is-nums-hidden \.vnum\s*\{\s*display:\s*none/, css)
    assert_match(/\.is-nums-hidden \.verse-press\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/, css)
    assert_match(/--verse-gutter:\s*0px/, css)
    assert_match(/\.is-nums-hidden \.verse\s*\{[^}]*padding-left:\s*var\(--verse-inset\)/, css)
  end

  test "quiet plus nums-hidden hides verse number milestones" do
    hidden = css[/\.is-quiet\.is-nums-hidden \.vnum\s*\{[^}]+\}/]
    assert hidden
    assert_match(/display:\s*none/, hidden)
    refute_match(/content:/, hidden)
  end

  test "regular reading follows USFM paragraphs without becoming Focus" do
    pub_p = css[/\n\.pub-p\s*\{[^}]+\}/]
    assert pub_p
    assert_match(/margin:\s*0/, pub_p)
    refute_match(/margin:\s*0 0 1em/, pub_p)
    assert_match(/hanging-punctuation:\s*first/, pub_p)
    q = css[/\n\.pub-q1, \.pub-q2\s*\{[^}]+\}/]
    assert q
    assert_match(/margin:\s*0 0 \.1em/, q)
    assert_match(/\.pub-b\s*\{[^}]*height:\s*\.7em/, css)
    assert_match(/\.section-head\.spaced\s*\{[^}]*margin-top:\s*2\.25em/, css)
    assert_match(/\.section-head \+ \.pub-p,\s*\n\.section-head \+ \.pub-r \+ \.pub-p\s*\{[^}]*margin-top:\s*0/, css)
    assert_match(/\.section-head \+ \.pub-p,\s*\n\.section-head \+ \.pub-r \+ \.pub-p\s*\{[^}]*text-indent:\s*0/, css)
    follow = css[/\n\.pub-p \+ \.pub-p\s*\{[^}]+\}/]
    assert follow
    assert_match(/text-indent:\s*0/, follow)
    assert_match(/margin-top:\s*\.65em/, follow)
    refute_match(/text-indent:\s*1\.2em/, follow)
    refute_match(/\.section-head \+ \.pub-p > \.verse:first-child \.verse-press > \.vtext/, css)
    regular_verse = css[/\n\.verse\s*\{[^}]+\}/]
    assert regular_verse
    assert_match(/display:\s*block/, regular_verse)
    refute_match(/display:\s*contents/, regular_verse)
    regular_press = css[/\n\.verse-press\s*\{[^}]+\}/]
    assert regular_press
    assert_match(/display:\s*grid/, regular_press)
    refute_match(/display:\s*contents/, regular_press)
    quiet_p = css[/\.is-quiet \.pub-p,\s*\.is-quiet \.pub-q1,\s*\.is-quiet \.pub-q2\s*\{[^}]+\}/]
    assert quiet_p
    assert_match(/margin:\s*0/, quiet_p)
    assert_match(/\.is-quiet \.pub-p\s*\{[^}]*text-indent:\s*1\.2em/, css)
    quiet_follow = css[/\.is-quiet \.pub-p \+ \.pub-p\s*\{[^}]+\}/]
    assert quiet_follow
    assert_match(/text-indent:\s*1\.2em/, quiet_follow)
    assert_match(/margin-top:\s*0/, quiet_follow)
    assert_match(/\.is-quiet \.verse\s*\{[^}]*display:\s*contents/, css)
    assert_match(/\.is-quiet \.verse-press\s*\{[^}]*display:\s*contents/, css)
    assert_match(/\.verse-press\s*\{[^}]*display:\s*grid/, css)
    assert_match(/\.verse-press > \.vnum\s*\{[^}]*grid-column:\s*1/, css)
    assert_match(/\.pub-q1, \.pub-q2\s*\{[^}]*padding-left:\s*0/, css)
    assert_match(/\.pub-q1 \.verse-press > \.vtext\s*\{[^}]*padding-left:\s*1\.05rem/, css)
    assert_match(/\.pub-q2 \.verse-press > \.vtext\s*\{[^}]*padding-left:\s*1\.5rem/, css)
  end

  test "note tray shares the verse text column" do
    assert_match(/--verse-gutter:\s*1\.4rem/, css)
    assert_match(/grid-template-columns:\s*var\(--verse-gutter\) 1fr/, css)
    assert_match(/\.note-card,\s*\.verse > \.note-tray\s*\{[^}]*margin-left:\s*calc\(var\(--verse-gutter\) \+ var\(--verse-gutter-gap\)\)/m, css)
    refute_match(/\.note-tray, \.chapter-tray \{ padding: \.2rem \.2rem/, css)
  end
end
