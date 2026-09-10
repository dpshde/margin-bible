# frozen_string_literal: true

require "test_helper"

class ExportsControllerTest < ActionDispatch::IntegrationTest
  test "GET downloads a JSON snapshot of the current library only" do
    travel_to Time.utc(2026, 9, 10, 12, 0, 0) do
      get root_path
      mine = Library.last
      mine.notes.create!(
        slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
        verse_start: 1, blocks: [ { "id" => "b_mine", "indent" => 0, "text" => "My logos note." } ]
      )
      other = Library.create!
      other.notes.create!(
        slug: "jhn.3.16", osis: "JHN.3.16", kind: "verse", book: "JHN", chapter: 3,
        verse_start: 16, blocks: [ { "id" => "b_other", "indent" => 0, "text" => "Stranger note." } ]
      )

      get export_path
      assert_response :success
      assert_equal "application/json", response.media_type
      assert_match(/filename="margin-notes-20260910.json"/, response.headers["Content-Disposition"])
      assert_match(/attachment/, response.headers["Content-Disposition"])
      payload = JSON.parse(response.body)
      assert_equal "margin.library-snapshot", payload["format"]
      assert_equal 1, payload["version"]
      assert_equal [ "jhn.1.1" ], payload["notes"].map { |row| row["slug"] }
      assert_equal "My logos note.", payload["notes"][0]["blocks"][0]["text"]
      refute_includes response.body, "Stranger note."
      refute_includes response.body, mine.claim_token
      refute_includes payload.keys, "claim_token"
    end
  end

  test "signed-in export stays on the claimed library" do
    user = User.create!(email: "reader@example.com")
    claim_as(user)
    Library.last.notes.create!(
      slug: "heb.11.1", osis: "HEB.11.1", kind: "verse", book: "HEB", chapter: 11,
      verse_start: 1, blocks: [ { "id" => "b_faith", "indent" => 0, "text" => "Faith is the assurance." } ]
    )
    stranger = Library.create!
    stranger.notes.create!(
      slug: "rom.8.28", osis: "ROM.8.28", kind: "verse", book: "ROM", chapter: 8,
      verse_start: 28, blocks: [ { "id" => "b_other", "indent" => 0, "text" => "Not your note." } ]
    )

    get export_path
    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal [ "heb.11.1" ], payload["notes"].map { |row| row["slug"] }
    refute_includes response.body, "Not your note."
  end

  test "exports a book without notes" do
    post export_path, params: { scope: "book", book: "JHN", notes: "0" }
    assert_response :success
    assert_match(/filename="john.md"/, response.headers["Content-Disposition"])
    assert_match(/\AJohn\n/, response.body)
    assert_match(/^1\. In the beginning was the Word/, response.body)
  end

  test "exports a book with library notes" do
    get root_path
    Library.last.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ { "id" => "n1", "indent" => 0, "text" => "Library note." } ]
    )
    post export_path, params: { scope: "book", book: "JHN", notes: "1" }
    assert_response :success
    assert_match(/filename="john-notes.md"/, response.headers["Content-Disposition"])
    assert_match(/^  - Library note\.$/, response.body)
  end

  test "guest pack notes can be posted for export" do
    post export_path, params: {
      scope: "book",
      book: "JHN",
      notes: "1",
      pack: { "jhn.1.1" => { "blocks" => [ { "indent" => 0, "text" => "Guest note." } ] } }.to_json
    }
    assert_response :success
    assert_match(/^  - Guest note\.$/, response.body)
  end
end
