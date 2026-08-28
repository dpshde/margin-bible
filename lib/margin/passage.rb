# frozen_string_literal: true

module Margin
  # OSIS-addressed passage. Canonical slugs match grab-bcv / route.bible.
  class Passage
    SLUG = /\A([1-3]?[a-z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?\z/i
    # Locate refs in running text. Parse remains the source of truth; this is
    # only a candidate finder (same idea as grab-bcv's in-text tokens).
    XREF_CANDIDATE = /
      [1-3]?[A-Za-z]{2,}\.\d+(?:\.\d+(?:-\d+)?)?
      |
      (?:[1-3]\s*)?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?\s+\d+(?::\d+(?:\s*[–—-]\s*\d+)?)?
    /ix

    attr_reader :book, :chapter, :verse_start, :verse_end, :kind

    def initialize(book:, chapter:, verse_start: nil, verse_end: nil)
      @book = book.to_s.upcase
      @chapter = chapter.to_i
      @verse_start = verse_start&.to_i
      @verse_end = verse_end&.to_i
      @kind = if @verse_start.nil?
        "chapter"
      elsif @verse_end && @verse_end != @verse_start
        "range"
      else
        "verse"
      end
    end

    def osis
      slug.upcase
    end

    def slug
      base = "#{book.downcase}.#{chapter}"
      return base if kind == "chapter"
      return "#{base}.#{verse_start}-#{verse_end}" if kind == "range"

      "#{base}.#{verse_start}"
    end

    def chapter_slug
      "#{book.downcase}.#{chapter}"
    end

    def verse_slug(n)
      "#{book.downcase}.#{chapter}.#{n}"
    end

    def label
      name = Books.name_for(book) || book
      case kind
      when "chapter" then "#{name} #{chapter}"
      when "range" then "#{name} #{chapter}:#{verse_start}–#{verse_end}"
      else "#{name} #{chapter}:#{verse_start}"
      end
    end

    def focus_verse
      verse_start
    end

    def range?
      kind == "range"
    end

    def span_end
      return nil unless verse_start

      verse_end.presence || verse_start
    end

    def covers_verse?(n)
      return false unless verse_start

      last = span_end
      n.to_i >= verse_start && n.to_i <= last
    end

    def prev_chapter
      if chapter > 1
        self.class.new(book: book, chapter: chapter - 1)
      elsif (prev = Books.prev_book(book))
        self.class.new(book: prev, chapter: Books.chapter_count(prev))
      end
    end

    def next_chapter
      max = Books.chapter_count(book)
      if chapter < max
        self.class.new(book: book, chapter: chapter + 1)
      elsif (nxt = Books.next_book(book))
        self.class.new(book: nxt, chapter: 1)
      end
    end

    def overlaps_chapter?(other_book, other_chapter)
      book == other_book.to_s.upcase && chapter == other_chapter.to_i
    end

    def self.parse(input)
      return input if input.is_a?(Passage)
      return nil if input.blank?

      raw = input.to_s.strip
      if (m = SLUG.match(raw))
        book = Books.resolve_alias(m[1]) || m[1].upcase
        return unless Books::CODES.include?(book)

        new(book: book, chapter: m[2].to_i, verse_start: m[3]&.to_i, verse_end: m[4]&.to_i)
      else
        parse_human(raw)
      end
    end

    def self.parse!(input)
      parse(input) or raise ArgumentError, "unresolvable passage: #{input.inspect}"
    end

    def self.scan(text)
      source = text.to_s
      protected_ranges = protected_markup_ranges(source)
      hits = []
      source.scan(XREF_CANDIDATE) do
        match = Regexp.last_match
        start_at = match.begin(0)
        stop_at = match.end(0)
        next if protected_ranges.any? { |from, to| start_at >= from && stop_at <= to }

        passage = parse(match[0])
        next unless passage

        hits << { index: start_at, length: match[0].length, text: match[0], passage: }
      end
      hits
    end

    def self.protected_markup_ranges(source)
      ranges = []
      source.to_s.scan(/`[^`]*`|\[\[[^\[\]]+\]\]/) do
        match = Regexp.last_match
        ranges << [ match.begin(0), match.end(0) ]
      end
      ranges
    end
    private_class_method :protected_markup_ranges

    # Official BSB USJ ref@loc, e.g. "MAT 4:18-22" / "ISA 40:3" / "JHN 1".
    def self.parse_usj_loc(loc)
      raw = loc.to_s.strip.tr("–—", "-")
      return if raw.blank?

      if (m = raw.match(/\A([1-3]?[A-Za-z]{2,3})\s+(\d+)(?::(\d+)(?:-(\d+))?)?\z/))
        book = Books.resolve_alias(m[1]) || m[1].upcase
        return unless Books::CODES.include?(book)

        new(book:, chapter: m[2].to_i, verse_start: m[3]&.to_i, verse_end: m[4]&.to_i)
      else
        parse(raw)
      end
    end

    def self.parse_human(raw)
      s = raw.downcase.tr("–—", "-").gsub(/\s+/, " ").strip
      # "john 3:16-18" / "1 john 1" / "jn 3"
      if (m = s.match(/\A(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?\z/))
        book = Books.resolve_alias(m[1])
        return unless book

        vs = m[3]&.to_i
        ve = m[4]&.to_i
        new(book: book, chapter: m[2].to_i, verse_start: vs, verse_end: ve)
      else
        book = Books.resolve_alias(s)
        new(book: book, chapter: 1) if book
      end
    end
  end
end
