# frozen_string_literal: true

require "test_helper"

class InboxTest < ActiveSupport::TestCase
  setup do
    @today = Date.new(2026, 8, 25)
  end

  test "day labels match Keyverse rails" do
    assert_equal "Today", Margin::Inbox.day_label(@today, today: @today)
    assert_equal "Yesterday", Margin::Inbox.day_label(@today - 1, today: @today)
    assert_equal "Tuesday · Aug 4", Margin::Inbox.day_label(Date.new(2026, 8, 4), today: @today)
    assert_equal "Monday · Aug 4, 2025", Margin::Inbox.day_label(Date.new(2025, 8, 4), today: @today)
  end

  test "sections group by created_at day newest first and skip empty days" do
    library = Library.create!
    older = library.notes.create!(
      slug: "jhn.3.16", osis: "JHN.3.16", kind: "verse", book: "JHN", chapter: 3,
      verse_start: 16, blocks: [ { "id" => "a", "indent" => 0, "text" => "Old" } ],
      created_at: Time.zone.local(2026, 8, 4, 9, 0, 0)
    )
    newer_same_day = library.notes.create!(
      slug: "jhn.3.16-18", osis: "JHN.3.16-18", kind: "range", book: "JHN", chapter: 3,
      verse_start: 16, verse_end: 18, blocks: [ { "id" => "b", "indent" => 0, "text" => "Range" } ],
      created_at: Time.zone.local(2026, 8, 25, 15, 0, 0)
    )
    newer = library.notes.create!(
      slug: "jhn.3", osis: "JHN.3", kind: "chapter", book: "JHN", chapter: 3,
      blocks: [ { "id" => "c", "indent" => 0, "text" => "Chapter" } ],
      created_at: Time.zone.local(2026, 8, 25, 18, 0, 0)
    )
    library.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ { "id" => "d", "indent" => 0, "text" => "Updated later" } ],
      created_at: Time.zone.local(2026, 8, 4, 8, 0, 0),
      updated_at: Time.zone.local(2026, 8, 25, 20, 0, 0)
    )

    sections = Margin::Inbox.sections(library.notes.to_a, today: @today)
    assert_equal [ @today, Date.new(2026, 8, 4) ], sections.map { |section| section[:date] }
    assert_equal [ "Today", "Tuesday · Aug 4" ], sections.map { |section| section[:label] }
    assert_equal [ newer.slug, newer_same_day.slug ], sections.first[:notes].map(&:slug)
    assert_equal [ older.slug, "jhn.1.1" ], sections.last[:notes].map(&:slug)
    refute sections.any? { |section| section[:notes].empty? }
  end

  test "chapter notes keep a chapter_note query" do
    assert_equal({ chapter_note: 1 }, Margin::Inbox.href_options(Note.new(kind: "chapter")))
    assert_equal({}, Margin::Inbox.href_options(Note.new(kind: "verse")))
  end
end
