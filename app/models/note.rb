# frozen_string_literal: true

class Note < ApplicationRecord
  SOURCES = %w[human agent].freeze

  belongs_to :library

  validates :slug, :osis, :kind, :book, :chapter, presence: true
  validates :slug, uniqueness: { scope: :library_id }
  validates :source, inclusion: { in: SOURCES }

  # source / agent_name / agent_color are write-signature columns for a later
  # agent-write slice. Read-only MCP tools never set them; the reader does not
  # render agent color yet.

  def self.search_in(library, book: nil, chapter: nil, osis: nil, query: nil)
    rel = library.notes
    if osis.present?
      passage = Margin::Passage.parse(osis)
      if passage.nil?
        rel = rel.none
      elsif passage.verse_start.present?
        rel = rel.where(slug: passage.slug)
      else
        # Chapter address (heb.12 / Hebrews 12): every note in that chapter,
        # not only the chapter-note record. Verse and range osis stay exact.
        rel = rel.where(book: passage.book, chapter: passage.chapter)
      end
    end

    book_token = book.to_s.strip.presence
    chapter_n = chapter.present? ? chapter.to_i : nil
    chapter_n = nil unless chapter_n&.positive?

    if book_token
      parsed = parse_book_filter(book_token)
      if parsed
        rel = rel.where(book: parsed[:book])
        chapter_n ||= parsed[:chapter]
      else
        rel = rel.none
      end
    end
    rel = rel.where(chapter: chapter_n) if chapter_n
    notes = rel.order(:book, :chapter, :verse_start, :id)
    return notes if query.blank?

    needle = query.to_s.downcase
    notes.select { |note| note.body_text.downcase.include?(needle) }
  end

  # John / JHN / Heb / Hebrews / "Hebrews 12" / heb.12 — do not fall through to raw upcase (DEUT ≠ DEU).
  def self.parse_book_filter(token)
    raw = token.to_s.strip
    if raw.match?(/\d/)
      passage = Margin::Passage.parse(raw) || Margin::Passage.parse(raw.sub(/(\d+)\z/, " \\1"))
      return { book: passage.book, chapter: passage.chapter } if passage
    end
    code = Margin::Books.resolve_book_code(raw)
    { book: code, chapter: nil } if code
  end
  private_class_method :parse_book_filter

  def self.covering_verse(library, input)
    passage = Margin::Passage.parse(input)
    return none unless passage&.verse_start

    verse = passage.verse_start
    library.notes
      .where(book: passage.book, chapter: passage.chapter)
      .where.not(kind: "chapter")
      .where.not(verse_start: nil)
      .where("verse_start <= ?", verse)
      .where("verse_end IS NULL OR verse_end >= ?", verse)
      .order(:verse_start, :id)
  end

  def as_mcp
    {
      slug: slug,
      osis: osis,
      kind: kind,
      body: body_text,
      created_at: created_at&.iso8601,
      updated_at: updated_at&.iso8601
    }
  end


  def passage
    Margin::Passage.parse(slug)
  end

  # Exact verse and overlapping range notes cover a verse. Chapter notes never do.
  def covers_verse?(n)
    return false if kind == "chapter" || verse_start.blank?

    last = verse_end.presence || verse_start
    n.to_i >= verse_start && n.to_i <= last
  end

  def body_text
    Array(blocks).map { |b|
      ("  " * b["indent"].to_i) + b["text"].to_s
    }.join("\n")
  end

  def empty_content?
    !bookmarked? && Array(blocks).none? { |b| b["text"].to_s.strip.present? } && Array(attachments).none?
  end

  def apply_attachments!(raw)
    self.attachments = Margin::Attachment.normalize_list(raw)
    self
  end

  def self.blocks_from_text(text, previous: [])
    lines = text.to_s.empty? ? [ "" ] : text.to_s.split("\n", -1)
    parsed = lines.map do |line|
      indent = (line[/\A */]&.size.to_i / 2)
      { "indent" => indent, "text" => line.sub(/\A {0,}/, "") }
    end
    hydrate_blocks(parsed, previous: Array(previous))
  end

  def self.hydrate_blocks(rows, previous: [])
    incoming = Array(rows).map { |row| normalize_row(row) }
    incoming = [ { "indent" => 0, "text" => "" } ] if incoming.empty?
    ids = incoming.map { |row| row["id"] }
    assigned =
      if ids.all? && ids.uniq.size == ids.size
        incoming
      else
        assign_ids_by_lcs(incoming, Array(previous))
      end
    clamp_indents(assigned)
  end

  def apply_text!(text)
    self.blocks = self.class.blocks_from_text(text, previous: Array(blocks))
    self
  end

  def apply_blocks!(raw)
    self.blocks = self.class.hydrate_blocks(raw, previous: Array(blocks))
    self
  end

  def self.normalize_row(row)
    hash = row.respond_to?(:to_unsafe_h) ? row.to_unsafe_h : row.to_h
    hash = hash.stringify_keys
    {
      "id" => sanitize_block_id(hash["id"]),
      "indent" => hash["indent"].to_i.clamp(0, 32),
      "text" => hash["text"].to_s,
      "bullet" => row_bullet(hash)
    }
  end

  def self.row_bullet(hash)
    return true unless hash.key?("bullet")

    ActiveModel::Type::Boolean.new.cast(hash["bullet"])
  end

  def self.sanitize_block_id(id)
    value = id.to_s
    value.match?(/\Ab[_-][A-Za-z0-9_-]{1,40}\z/) ? value : nil
  end

  def self.assign_ids_by_lcs(rows, previous)
    prev = Array(previous)
    pairs = lcs_index_pairs(prev.map { |block| block["text"].to_s }, rows.map { |row| row["text"].to_s })
    matched_prev = pairs.map(&:first).to_set
    matched_new = pairs.map(&:last).to_set
    id_by_new = {}
    pairs.each { |prev_i, new_i| id_by_new[new_i] = prev[prev_i]["id"] }

    leftover_prev = prev.each_index.reject { |i| matched_prev.include?(i) }
    leftover_new = rows.each_index.reject { |i| matched_new.include?(i) }
    leftover_new.zip(leftover_prev).each do |new_i, prev_i|
      break unless prev_i

      id_by_new[new_i] = prev[prev_i]["id"]
    end

    used = []
    rows.map.with_index do |row, i|
      id = sanitize_block_id(row["id"]) || sanitize_block_id(id_by_new[i])
      id = nil if id && used.include?(id)
      id ||= "b_#{SecureRandom.hex(4)}"
      used << id
      { "id" => id, "indent" => row["indent"].to_i, "text" => row["text"].to_s, "bullet" => row_bullet(row) }
    end
  end

  def self.lcs_index_pairs(left, right)
    n = left.length
    m = right.length
    table = Array.new(n + 1) { Array.new(m + 1, 0) }
    n.times do |i|
      m.times do |j|
        table[i + 1][j + 1] =
          if left[i] == right[j]
            table[i][j] + 1
          else
            [ table[i + 1][j], table[i][j + 1] ].max
          end
      end
    end

    pairs = []
    i = n
    j = m
    while i.positive? && j.positive?
      if left[i - 1] == right[j - 1] && table[i][j] == table[i - 1][j - 1] + 1
        pairs << [ i - 1, j - 1 ]
        i -= 1
        j -= 1
      elsif table[i - 1][j] >= table[i][j - 1]
        i -= 1
      else
        j -= 1
      end
    end
    pairs.reverse
  end

  def self.clamp_indents(blocks)
    blocks.each_with_index do |block, i|
      block["indent"] = block["indent"].to_i.clamp(0, 32)
      block["indent"] = 0 if i.zero?
      block["indent"] = [ block["indent"], blocks[i - 1]["indent"] + 1 ].min if i.positive?
    end
    blocks
  end
end
