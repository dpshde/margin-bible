# frozen_string_literal: true

require "test_helper"

class Margin::Mcp::ExportLibraryTest < ActiveSupport::TestCase
  test "call returns the library snapshot without touching another library" do
    travel_to Time.utc(2026, 9, 10, 15, 30, 0) do
      library = Library.create!(last_read_slug: "jhn.1", read_trail: [ "jhn.1" ])
      create_note!(library, "jhn.1.1", "Mine: logos.")
      other = Library.create!
      create_note!(other, "jhn.3.16", "Theirs: stay out.")

      response = Margin::Mcp::ExportLibrary.call(server_context: { library: library })
      payload = response.structured_content
      expected = Margin::LibrarySnapshot.build(library)

      assert_equal expected[:format], payload[:format]
      assert_equal expected[:version], payload[:version]
      assert_equal expected[:library], payload[:library]
      assert_equal expected[:notes], payload[:notes]
      refute payload[:notes].any? { |note| note[:blocks].to_s.include?("Theirs") }
      refute payload.key?(:claim_token)
      refute_includes JSON.pretty_generate(payload), library.claim_token
      assert_equal JSON.pretty_generate(payload), response.content.first[:text]
    end
  end
end
