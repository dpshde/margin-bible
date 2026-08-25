# frozen_string_literal: true

require "test_helper"

class PassageTest < ActiveSupport::TestCase
  test "parses OSIS verse slug" do
    p = Margin::Passage.parse("jhn.3.16")
    assert_equal "verse", p.kind
    assert_equal "jhn.3.16", p.slug
    assert_equal "jhn.3", p.chapter_slug
    assert_equal "John 3:16", p.label
  end

  test "parses human reference" do
    p = Margin::Passage.parse("John 3:16-18")
    assert_equal "range", p.kind
    assert_equal "jhn.3.16-18", p.slug
  end

  test "route.bible URL" do
    assert_equal "https://route.bible/jhn.3.16", Margin::RouteBible.url_for("John 3:16")
  end

  test "chapter walk" do
    p = Margin::Passage.parse("jhn.1")
    assert_equal "luk.24", p.prev_chapter.slug
    assert_equal "jhn.2", p.next_chapter.slug
  end
end
