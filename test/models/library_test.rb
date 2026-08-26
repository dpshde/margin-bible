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
end
