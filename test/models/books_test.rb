# frozen_string_literal: true

require "test_helper"

class BooksTest < ActiveSupport::TestCase
  test "chapter_count is the book length used by the title grid" do
    assert_equal 21, Margin::Books.chapter_count("JHN")
    assert_equal 21, Margin::Books.chapter_count("jhn")
    assert_equal 150, Margin::Books.chapter_count("PSA")
    assert_equal 1, Margin::Books.chapter_count("OBA")
  end

  test "canon splits OT and NT at Matthew" do
    assert_equal 66, Margin::Books::CODES.length
    assert_equal 39, Margin::Books.ot_codes.length
    assert_equal 27, Margin::Books.nt_codes.length
    assert_equal "GEN", Margin::Books.ot_codes.first
    assert_equal "MAL", Margin::Books.ot_codes.last
    assert_equal "MAT", Margin::Books.nt_codes.first
    assert_equal "REV", Margin::Books.nt_codes.last
    assert_empty Margin::Books.ot_codes & Margin::Books.nt_codes
  end
end
