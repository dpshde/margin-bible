# frozen_string_literal: true

module Margin
  # One-click JSON backup of a cookie-scoped library.
  # Does not include claim tokens, user emails, or other libraries.
  module LibrarySnapshot
    FORMAT = "margin.library-snapshot"
    VERSION = 1

    module_function

    def build(library)
      {
        format: FORMAT,
        version: VERSION,
        exported_at: Time.current.iso8601,
        library: {
          last_read_slug: library.last_read_slug,
          read_trail: Array(library.read_trail)
        },
        notes: library.notes.order(:book, :chapter, :verse_start, :id).map(&:as_snapshot)
      }
    end

    def filename(now = Time.current)
      "margin-notes-#{now.utc.strftime("%Y%m%d")}.json"
    end
  end
end
