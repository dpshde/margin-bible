# frozen_string_literal: true

require "json"
require "net/http"
require "uri"
require "zlib"

module Margin
  # Chapter-keyed BSB pack. Arweave JSONL is the source of truth; the gzip
  # under vendor/scripture/bsb is a disposable cache (ADR 0007). Never Range-GET
  # the transaction and never scan JSONL on a reader request.
  module Bsb
    DEFAULT_URL = "https://arweave.net/B6yeNb3lk_VkiIp-fTWVh13TlM94LjLK6kC63BPXa8s"
    PACK_PATH = Rails.root.join("vendor/scripture/bsb/chapters.json.gz")
    TRANSLATION = "BSB"

    module_function

    def source_url
      ENV.fetch("MARGIN_BSB_URL", DEFAULT_URL)
    end

    def pack_path
      Pathname(ENV.fetch("MARGIN_BSB_PACK", PACK_PATH))
    end

    def pack_key(book, chapter)
      "#{book.to_s.downcase}.#{chapter.to_i}"
    end

    def book_code_for(name)
      Books.resolve_alias(name.to_s)
    end

    def reset_pack!
      @pack = nil
    end

    def pack
      @pack ||= load_pack(pack_path)
    end

    def load_pack(path)
      JSON.parse(Zlib::GzipReader.open(path, &:read))
    end

    def chapter_from_pack(book, chapter)
      pack[pack_key(book, chapter)]
    end

    def hydrate_chapter!(book, chapter)
      loaded = Verse.in_chapter(book, chapter)
      return loaded if loaded.exists?

      data = chapter_from_pack(book, chapter)
      return Verse.none unless data

      now = Time.current
      rows = Array(data["verses"]).filter_map { |vr|
        text = vr["text"].to_s
        next if text.blank?

        {
          translation: TRANSLATION,
          book: book.to_s.upcase,
          chapter: chapter.to_i,
          verse: vr["v"].to_i,
          text: text,
          heading: vr["heading"].presence,
          created_at: now,
          updated_at: now
        }
      }
      Verse.insert_all(rows) if rows.any?
      Verse.in_chapter(book, chapter)
    end

    def seed_all!
      now = Time.current
      rows = []
      pack.each_value do |chapter|
        book = chapter["book"].to_s.upcase
        ch = chapter["chapter"].to_i
        Array(chapter["verses"]).each do |vr|
          rows << {
            translation: TRANSLATION,
            book: book,
            chapter: ch,
            verse: vr["v"].to_i,
            text: vr["text"].to_s,
            heading: vr["heading"].presence,
            created_at: now,
            updated_at: now
          }
        end
      end
      Verse.where(translation: TRANSLATION).delete_all
      rows.each_slice(200) { |slice| Verse.insert_all(slice) }
      rows.size
    end

    def parse_jsonl_line(line)
      row = JSON.parse(line)
      book = book_code_for(row["book"])
      return nil unless book

      {
        book: book,
        chapter: row["chapter"].to_i,
        verse: row["verseNum"].to_i,
        text: row["text"].to_s
      }
    end

    def headings_from_pack(existing = pack)
      index = {}
      existing.each do |key, chapter|
        Array(chapter["verses"]).each do |vr|
          heading = vr["heading"].presence
          next unless heading

          index[key] ||= {}
          index[key][vr["v"].to_i] = heading
        end
      end
      index
    end

    def pack_from_jsonl(io, headings: {})
      chapters = {}
      io.each_line do |line|
        line = line.strip
        next if line.empty?

        parsed = parse_jsonl_line(line)
        next unless parsed

        key = pack_key(parsed[:book], parsed[:chapter])
        chapters[key] ||= {
          "translation" => TRANSLATION,
          "book" => parsed[:book],
          "chapter" => parsed[:chapter],
          "verses" => [],
          "source" => source_url,
          "license" => "public-domain"
        }
        verse = { "v" => parsed[:verse], "text" => parsed[:text] }
        heading = headings.dig(key, parsed[:verse])
        verse["heading"] = heading if heading
        chapters[key]["verses"] << verse
      end
      chapters.each_value { |chapter| chapter["verses"].sort_by! { |verse| verse["v"] } }
      chapters
    end

    def get_request(uri)
      request = Net::HTTP::Get.new(uri)
      request.delete("Range")
      raise "Range must not be used for BSB fetch" if request["Range"]

      request
    end

    def write_pack!(chapters, path = pack_path)
      payload = JSON.generate(chapters)
      File.open(path, "wb") do |file|
        gz = Zlib::GzipWriter.new(file, Zlib::BEST_COMPRESSION)
        gz.write(payload)
        gz.close
      end
      payload.bytesize
    end
  end
end
