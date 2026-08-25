# frozen_string_literal: true

module Margin
  # Canonical book tables from grab-bcv (vendor/data/books.json).
  module Books
    DATA = JSON.parse(File.read(Rails.root.join("vendor/data/books.json"))).freeze
    CODES = DATA["codes"].freeze
    NAMES = DATA["names"].freeze
    CHAPTER_COUNTS = DATA["chapterCounts"].freeze
    VERSE_COUNTS = DATA["verseCounts"].freeze
    ALIASES = DATA["aliases"].transform_keys { |k| k.to_s.downcase.gsub(/[^a-z0-9]/, "") }.freeze

    module_function

    def name_for(code)
      NAMES[code.to_s.upcase]
    end

    def chapter_count(code)
      CHAPTER_COUNTS[code.to_s.upcase].to_i
    end

    def verse_count(code, chapter)
      (VERSE_COUNTS[code.to_s.upcase] || {})[chapter.to_s].to_i
    end

    def resolve_alias(token)
      key = token.to_s.downcase.gsub(/[^a-z0-9]/, "")
      ALIASES[key] || (CODES.include?(token.to_s.upcase) ? token.to_s.upcase : nil)
    end

    def next_book(code)
      i = CODES.index(code.to_s.upcase)
      CODES[i + 1] if i
    end

    def prev_book(code)
      i = CODES.index(code.to_s.upcase)
      CODES[i - 1] if i && i.positive?
    end
  end
end
