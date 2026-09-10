# frozen_string_literal: true

require "test_helper"

class LibrarySnapshotTest < ActiveSupport::TestCase
  test "builds a restoreable snapshot without claim tokens or other libraries" do
    library = Library.create!(last_read_slug: "jhn.1", read_trail: [ "jhn.1", "heb.11" ])
    note = library.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, bookmarked: true,
      blocks: [ { "id" => "b_word", "indent" => 0, "text" => "Logos." } ],
      attachments: [ { "id" => "att_abcd", "kind" => "xref", "slug" => "jhn.1.6", "title" => "John 1:6" } ]
    )
    other = Library.create!
    other.notes.create!(
      slug: "jhn.3.16", osis: "JHN.3.16", kind: "verse", book: "JHN", chapter: 3,
      verse_start: 16, blocks: [ { "id" => "b_secret", "indent" => 0, "text" => "Other library only." } ]
    )

    travel_to Time.utc(2026, 9, 10, 15, 4, 5) do
      snapshot = Margin::LibrarySnapshot.build(library)
      assert_equal "margin.library-snapshot", snapshot[:format]
      assert_equal 1, snapshot[:version]
      assert_equal Time.utc(2026, 9, 10, 15, 4, 5).iso8601, snapshot[:exported_at]
      assert_equal "jhn.1", snapshot[:library][:last_read_slug]
      assert_equal [ "jhn.1", "heb.11" ], snapshot[:library][:read_trail]
      assert_equal 1, snapshot[:notes].size
      row = snapshot[:notes].first
      assert_equal note.slug, row[:slug]
      assert_equal "JHN.1.1", row[:osis]
      assert_equal "verse", row[:kind]
      assert_equal "JHN", row[:book]
      assert_equal 1, row[:chapter]
      assert_equal 1, row[:verse_start]
      assert row[:bookmarked]
      assert_equal "Logos.", row[:blocks][0]["text"]
      assert_equal "jhn.1.6", row[:attachments][0]["slug"]
      refute_includes snapshot.to_s, library.claim_token
      refute_includes snapshot.to_s, "Other library only."
      assert_equal "margin-notes-20260910.json", Margin::LibrarySnapshot.filename
    end
  end
end
