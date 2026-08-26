# frozen_string_literal: true

require "test_helper"

class GuestPacksControllerTest < ActionDispatch::IntegrationTest
  test "imports guest pack notes into the current library" do
    get root_path
    library = Library.last

    post guest_pack_path, params: {
      pack: {
        notes: {
          "jhn.3.16" => { "slug" => "jhn.3.16", "blocks" => [ { "id" => "b_g1", "indent" => 0, "text" => "Love." } ] },
          "jhn.3.16-18" => { "slug" => "jhn.3.16-18", "blocks" => [ { "id" => "b_g2", "indent" => 0, "text" => "Range." } ] }
        }
      }
    }, as: :json

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal true, body["ok"]
    assert_equal 2, body["imported"]
    assert library.notes.find_by(slug: "jhn.3.16")
    assert_equal "range", library.notes.find_by!(slug: "jhn.3.16-18").kind
  end

  test "does not overwrite a richer server note with an empty or competing guest note" do
    get root_path
    library = Library.last
    library.notes.create!(
      slug: "jhn.1.1", osis: "JHN.1.1", kind: "verse", book: "JHN", chapter: 1,
      verse_start: 1, blocks: [ { "id" => "b_srv", "indent" => 0, "text" => "The Logos." } ]
    )

    post guest_pack_path, params: {
      pack: {
        notes: {
          "jhn.1.1" => { "blocks" => [ { "indent" => 0, "text" => "" } ] },
          "jhn.1.2" => { "blocks" => [ { "indent" => 0, "text" => "Guest verse." } ] }
        }
      }
    }, as: :json

    assert_response :success
    assert_equal 1, JSON.parse(response.body)["imported"]
    assert_equal "The Logos.", library.notes.find_by!(slug: "jhn.1.1").blocks[0]["text"]
    assert_equal "Guest verse.", library.notes.find_by!(slug: "jhn.1.2").blocks[0]["text"]
  end

  test "empty guest pack is a no-op" do
    get root_path
    post guest_pack_path, params: { pack: { notes: {} } }, as: :json
    assert_response :success
    assert_equal 0, JSON.parse(response.body)["imported"]
    assert_equal 0, Library.last.notes.count
  end
end
