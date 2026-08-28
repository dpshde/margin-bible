# frozen_string_literal: true

module Margin
  # Structured chips on a note: a passage xref or an http(s) weblink.
  # Inline wiki xrefs stay in block text; these live on the note itself.
  module Attachment
    KINDS = %w[xref url].freeze
    ID = /\Aatt_[A-Za-z0-9]{4,16}\z/

    module_function

    def normalize_list(raw)
      rows = parse_json(raw)
      seen = {}
      Array(rows).filter_map { |row| normalize_row(row, seen) }
    end

    def parse_input(raw)
      text = raw.to_s.strip
      return if text.blank?

      from_passage(text) || from_url(text)
    end

    def xrefs_from_text(text)
      source = text.to_s
      rows = []
      seen = {}
      source.scan(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/) do
        passage = Passage.parse(Regexp.last_match(1))
        next unless passage
        key = "xref:#{passage.slug}"
        next if seen[key]

        seen[key] = true
        rows << { "kind" => "xref", "slug" => passage.slug, "title" => passage.label }
      end
      Passage.scan(source).each do |hit|
        key = "xref:#{hit[:passage].slug}"
        next if seen[key]

        seen[key] = true
        rows << { "kind" => "xref", "slug" => hit[:passage].slug, "title" => hit[:passage].label }
      end
      rows
    end

    def merge_xrefs_from_blocks(attachments, blocks)
      current = normalize_list(attachments)
      parsed = Array(blocks).flat_map { |block|
        xrefs_from_text(block.is_a?(Hash) ? block["text"] || block[:text] : nil)
      }
      parsed_slugs = parsed.map { |row| row["slug"] }.uniq
      kept = current.select { |row| keep_attachment?(row, parsed_slugs) }.map { |row|
        next row unless row["kind"] == "xref" && parsed_slugs.include?(row["slug"])

        match = parsed.find { |item| item["slug"] == row["slug"] }
        source = row["source"] == "manual" ? "manual" : "scan"
        title = match && match["title"].present? ? match["title"] : row["title"]
        next row if title == row["title"] && row["source"] == source

        row.merge("title" => title, "source" => source)
      }
      present = kept.filter_map { |row| row["slug"] if row["kind"] == "xref" }
      extra = parsed.filter_map { |row|
        next if present.include?(row["slug"])

        present << row["slug"]
        row.merge("source" => "scan")
      }
      normalize_list(kept + extra)
    end

    def keep_attachment?(row, parsed_slugs)
      return true unless row["kind"] == "xref"
      return true if row["source"] == "manual"

      parsed_slugs.include?(row["slug"])
    end

    def normalize_row(row, seen = {})
      hash = stringify(row)
      kind = hash["kind"].to_s
      id = sanitize_id(hash["id"]) || "att_#{SecureRandom.hex(4)}"
      record =
        case kind
        when "xref"
          passage = Passage.parse(hash["slug"].presence || hash["target"] || hash["title"])
          return unless passage

          with_source({ "id" => id, "kind" => "xref", "slug" => passage.slug, "title" => hash["title"].presence || passage.label }, hash["source"])
        when "url"
          url = absolute_http_url(hash["url"].presence || hash["href"])
          return unless url

          with_source({ "id" => id, "kind" => "url", "url" => url, "title" => hash["title"].presence || url_title(url) }, "manual")
        else
          parse_input(hash["url"].presence || hash["slug"].presence || hash["title"].presence || hash["target"])
        end
      return unless record

      key = record["kind"] == "xref" ? "xref:#{record["slug"]}" : "url:#{record["url"]}"
      return if seen[key]

      seen[key] = true
      record["id"] = id if ID.match?(id)
      record
    end

    def from_passage(text)
      passage = Passage.parse(text)
      if passage && looks_like_ref?(text)
        return { "kind" => "xref", "slug" => passage.slug, "title" => passage.label }
      end

      url = absolute_http_url(text)
      return unless url

      path = URI.parse(url).path.to_s.delete_prefix("/")
      passage = Passage.parse(path)
      return unless passage

      { "kind" => "xref", "slug" => passage.slug, "title" => passage.label }
    rescue URI::InvalidURIError
      nil
    end

    def from_url(text)
      url = absolute_http_url(text)
      return unless url

      { "kind" => "url", "url" => url, "title" => url_title(url) }
    end

    def looks_like_ref?(text)
      value = text.to_s.strip
      return false if value.blank?
      return true if value.match?(/\Ahttps?:\/\//i)
      return true if Passage::SLUG.match?(value)

      value.match?(/\d/)
    end

    def absolute_http_url(text)
      candidate = text.to_s.strip
      candidate = "https://#{candidate}" if candidate.match?(/\Awww\./i)
      uri = URI.parse(candidate)
      return unless uri.is_a?(URI::HTTP) && uri.host.present?

      uri.to_s
    rescue URI::InvalidURIError
      nil
    end

    def url_title(url)
      host = URI.parse(url).host.to_s.sub(/\Awww\./, "")
      host.presence || url
    rescue URI::InvalidURIError
      url
    end

    def with_source(row, source)
      return row.merge("source" => "manual") if row["kind"] == "url"
      return row.merge("source" => source) if source == "manual" || source == "scan"

      row
    end

    def sanitize_id(id)
      value = id.to_s
      ID.match?(value) ? value : nil
    end

    def stringify(row)
      hash = row.respond_to?(:to_unsafe_h) ? row.to_unsafe_h : row.to_h
      hash.stringify_keys
    rescue TypeError, NoMethodError
      {}
    end

    def parse_json(raw)
      return raw unless raw.is_a?(String)
      return [] if raw.blank?

      JSON.parse(raw)
    rescue JSON::ParserError
      []
    end
  end
end
