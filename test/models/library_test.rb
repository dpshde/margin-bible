# frozen_string_literal: true

require "test_helper"

class LibraryTest < ActiveSupport::TestCase
  test "remember_read keeps three unique slugs most-recent first" do
    library = Library.create!
    library.remember_read!("jhn.1")
    library.remember_read!("jhn.3.16")
    library.remember_read!("jhn.2")
    library.remember_read!("jhn.3.16")
    library.reload
    assert_equal [ "jhn.3.16", "jhn.2", "jhn.1" ], library.read_trail
    assert_equal "jhn.3.16", library.last_read_slug
    assert_equal "John 3:16", library.continue_passage.label
  end

  test "import_guest_pack composes slugs and skips empty or weaker guest notes" do
    library = Library.create!
    library.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ { "id" => "b_srv", "indent" => 0, "text" => "Server stays." } ]
    )

    imported = library.import_guest_pack!(
      "notes" => {
        "jhn.1.1" => { "blocks" => [ { "id" => "b_g1", "indent" => 0, "text" => "Guest should not win." } ] },
        "jhn.1.1-3" => { "blocks" => [ { "id" => "b_g2", "indent" => 0, "text" => "Range thought." } ] },
        "jhn.3.16" => { "blocks" => [ { "id" => "b_g3", "indent" => 0, "text" => "   " } ] }
      }
    )

    assert_equal 1, imported
    assert_equal "Server stays.", library.notes.find_by!(slug: "jhn.1.1").blocks[0]["text"]
    range = library.notes.find_by!(slug: "jhn.1.1-3")
    assert_equal "range", range.kind
    assert_equal "Range thought.", range.blocks[0]["text"]
    assert_nil library.notes.find_by(slug: "jhn.3.16")
  end

  test "empty guest pack is a no-op" do
    library = Library.create!
    assert_equal 0, library.import_guest_pack!("notes" => {})
    assert_equal 0, library.notes.count
  end
end
