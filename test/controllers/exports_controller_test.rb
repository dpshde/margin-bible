# frozen_string_literal: true

require "test_helper"

class ExportsControllerTest < ActionDispatch::IntegrationTest
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
