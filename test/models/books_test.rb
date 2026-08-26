# frozen_string_literal: true

require "test_helper"

class BooksTest < ActiveSupport::TestCase
  test "chapter_count is the book length used by the title grid" do
    assert_equal 21, Margin::Books.chapter_count("JHN")
    assert_equal 21, Margin::Books.chapter_count("jhn")
    assert_equal 150, Margin::Books.chapter_count("PSA")
    assert_equal 1, Margin::Books.chapter_count("OBA")
  end
end
