# frozen_string_literal: true

module Margin
  # Sample notes for the public leader-sheet preview. Not a library record.
  # Compose, don't absorb: each row is its own OSIS address.
  module LeaderSheetDemo
    Note = Struct.new(:kind, :verse_start, :verse_end, :slug, :body_text, keyword_init: true)

    HEBREWS_12 = [
      [ "heb.12.1", "Who are the witnesses?" ],
      [ "heb.12.2", "He endured the cross with joy." ],
      [ "heb.12.7", "Suffering is named as discipline for sons." ],
      [ "heb.12.11", "The peaceful fruit of righteousness (CSB)" ],
      [ "heb.12.26", "What does it mean He will shake heaven?" ]
    ].freeze

    module_function

    def notes_for(passage)
      rows = sample_rows(passage)
      rows.filter_map { |slug, body|
        parsed = Passage.parse(slug)
        next unless parsed
        next unless parsed.book == passage.book && parsed.chapter == passage.chapter

        Note.new(
          kind: parsed.kind,
          verse_start: parsed.verse_start,
          verse_end: parsed.verse_end,
          slug: parsed.slug,
          body_text: body
        )
      }
    end

    def sample_rows(passage)
      return HEBREWS_12 if passage.book == "HEB" && passage.chapter == 12

      []
    end

    def using_samples?(passage)
      sample_rows(passage).any?
    end
  end
end
