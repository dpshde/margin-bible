# frozen_string_literal: true

module Margin
  # OSIS-addressed passage. Canonical slugs match grab-bcv / route.bible.
  class Passage
    SLUG = /\A([1-3]?[a-z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?\z/i

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
