# frozen_string_literal: true

require "test_helper"

class LeaderSheetsControllerTest < ActionDispatch::IntegrationTest
  test "heb.12 preview renders the default leader sheet with sample notes" do
    get leader_sheet_path("heb.12")
    assert_response :success
    assert_select "h1", text: /Hebrews 12/
    assert_select ".leader-sheet-q strong", minimum: 1
    assert_select ".leader-sheet-paths em", minimum: 1
    assert_select ".leader-sheet-paths", text: /Paths:/
    assert_match(/great cloud of witnesses/, response.body)
    assert_match(/A Call to Endurance/, response.body)
    refute_match(/Warm-up|Google map|Houston|Achilles/i, response.body)
    refute_match(/interrogat/i, response.body)
    assert_select ".leader-sheet-raw pre", text: /\*\*Paths:\*\*/
  end

  test "unknown osis is not found" do
    get leader_sheet_path("not-a-book.1")
    assert_response :not_found
  end
end
