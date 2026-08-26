# frozen_string_literal: true

module Margin
  module ShareText
    LINK_BASE = "https://route.bible"
    WIKI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/

    module_function

    def wiki_to_plain(text)
      text.to_s.gsub(WIKI) { |match|
        label = Regexp.last_match(2)
        target = Regexp.last_match(1)
        label.presence || Passage.parse(target)&.label || target
      }
    end

    def note_lines(blocks, base_indent: 0, bullets: false)
      Array(blocks).filter_map { |block|
        text = wiki_to_plain(block.is_a?(Hash) ? block["text"] : block[:text]).rstrip
        next if text.blank?

        indent = base_indent + (block.is_a?(Hash) ? block["indent"] : block[:indent]).to_i
        prefix = "  " * indent
        bullets ? "#{prefix}- #{text}" : "#{prefix}#{text}"
      }
    end

    def format_verse(label:, text:, notes: [], url: nil)
      lines = [ label, wiki_to_plain(text).strip ]
      Array(notes).each do |note|
        body = note_lines(note_blocks(note), base_indent: 1)
        next if body.empty?

        lines << ""
        lines.concat(body)
      end
      lines << "" << url if url.present?
      "#{lines.join("\n").strip}\n"
    end

    def format_chapter(label:, verses:, chapter_note: nil, url: nil, bullets: false)
      lines = [ label ]
      chapter_body = note_lines(note_blocks(chapter_note), base_indent: 0, bullets:)
      if chapter_body.any?
        lines << ""
        lines.concat(chapter_body)
      end
      Array(verses).each do |verse|
        heading = verse[:heading] || verse["heading"]
        lines << "" << heading if heading.present?
        n = verse[:n] || verse["n"]
        text = verse[:text] || verse["text"]
        lines << "" << "#{n}. #{wiki_to_plain(text).strip}"
        Array(verse[:notes] || verse["notes"]).each do |note|
          body = note_lines(note_blocks(note), base_indent: 1, bullets:)
          lines.concat(body) if body.any?
        end
      end
      lines << "" << url if url.present?
      "#{lines.join("\n").strip}\n"
    end

    def format_book(label:, chapters:, url: nil, bullets: false)
      parts = [ label ]
      Array(chapters).each do |chapter|
        parts << ""
        parts << format_chapter(
          label: chapter[:label] || chapter["label"],
          verses: chapter[:verses] || chapter["verses"],
          chapter_note: chapter[:chapter_note] || chapter["chapterNote"],
          bullets:
        ).strip
      end
      parts << "" << url if url.present?
      "#{parts.join("\n").strip}\n"
    end

    def document(scope:, book:, chapter: nil, verse_start: nil, verse_end: nil, notes: {}, include_notes: true, include_url: false)
      notes = normalize_notes(notes)
      notes = {} unless include_notes
      case scope.to_s
      when "verse", "range"
        verse_document(book:, chapter:, verse_start:, verse_end:, notes:, include_url:)
      when "chapter"
        chapter_document(book:, chapter:, notes:, include_url:)
      when "book"
        book_document(book:, notes:, include_url:)
      when "bible"
        bible_document(notes:, include_url:)
      else
        nil
      end
    end

    def filename(scope:, book: nil, include_notes: true)
      suffix = include_notes ? "-notes" : ""
      case scope.to_s
      when "bible" then "bible#{suffix}.md"
      when "book"
        slug = (Books.name_for(book) || book).to_s.parameterize
        "#{slug}#{suffix}.md"
      else
        "passage#{suffix}.md"
      end
    end

    def verse_document(book:, chapter:, verse_start:, verse_end:, notes:, include_url:)
      passage = Passage.new(book:, chapter:, verse_start:, verse_end:)
      data = Bsb.chapter_from_pack(book, chapter)
      return unless data

      verses = pack_verses(data, notes, passage.chapter_slug, from: passage.verse_start, to: passage.span_end)
      url = include_url ? "#{LINK_BASE}/#{passage.slug}" : nil
      if passage.kind == "verse"
        row = verses.first
        return unless row

        format_verse(label: passage.label, text: row[:text], notes: row[:notes], url:)
      else
        format_chapter(label: passage.label, verses:, url:)
      end
    end

    def chapter_document(book:, chapter:, notes:, include_url:)
      passage = Passage.new(book:, chapter:)
      data = Bsb.chapter_from_pack(book, chapter)
      return unless data

      format_chapter(
        label: passage.label,
        chapter_note: notes[passage.slug],
        verses: pack_verses(data, notes, passage.slug),
        url: include_url ? "#{LINK_BASE}/#{passage.slug}" : nil
      )
    end

    def book_document(book:, notes:, include_url:)
      code = book.to_s.upcase
      name = Books.name_for(code) || code
      chapters = 1.upto(Books.chapter_count(code)).filter_map { |ch|
        data = Bsb.chapter_from_pack(code, ch)
        next unless data

        slug = "#{code.downcase}.#{ch}"
        {
          label: Passage.new(book: code, chapter: ch).label,
          chapter_note: notes[slug],
          verses: pack_verses(data, notes, slug)
        }
      }
      format_book(
        label: name,
        chapters:,
        url: include_url ? "#{LINK_BASE}/#{code.downcase}.1" : nil,
        bullets: true
      )
    end

    def bible_document(notes:, include_url:)
      parts = [ "Holy Bible" ]
      Books::CODES.each do |code|
        parts << ""
        parts << book_document(book: code, notes:, include_url: false).strip
      end
      parts << "" << LINK_BASE if include_url
      "#{parts.join("\n").strip}\n"
    end

    def pack_verses(data, notes, chapter_slug, from: nil, to: nil)
      Array(data["verses"]).filter_map { |vr|
        n = vr["v"].to_i
        next if from && n < from
        next if to && n > to

        {
          n:,
          heading: vr["heading"].presence,
          text: vr["text"].to_s,
          notes: notes_for_verse(notes, chapter_slug, n)
        }
      }
    end

    def notes_for_verse(notes, chapter_slug, n)
      exact = "#{chapter_slug}.#{n}"
      list = []
      list << notes[exact] if notes[exact]
      notes.each do |slug, blocks|
        next if slug == exact

        parsed = Passage.parse(slug)
        next unless parsed&.range? && parsed.span_end == n && parsed.chapter_slug == chapter_slug

        list << blocks
      end
      list.map { |blocks| { blocks: note_blocks(blocks) } }
    end

    def normalize_notes(notes)
      case notes
      when Hash
        notes.each_with_object({}) { |(slug, value), acc|
          key = slug.to_s
          acc[key] = value.is_a?(Hash) ? (value["blocks"] || value[:blocks] || value) : value
        }
      when Array
        notes.each_with_object({}) { |note, acc|
          slug = note.respond_to?(:slug) ? note.slug : note[:slug] || note["slug"]
          next if slug.blank?

          acc[slug.to_s] = note_blocks(note)
        }
      else
        {}
      end
    end

    def note_blocks(note)
      return [] if note.blank?
      return note if note.is_a?(Array)
      return note["blocks"] || note[:blocks] || [] if note.is_a?(Hash)
      return note.blocks if note.respond_to?(:blocks)

      []
    end
  end
end
