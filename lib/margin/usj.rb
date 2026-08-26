# frozen_string_literal: true

require "json"
require "zlib"

module Margin
  # Official BSB USJ 3.1 book files. Publication stream, not verses[ch][v]=string.
  # Runtime reads precompiled USJ. Do not parse USFM on a request.
  module Usj
    ROOT = Rails.root.join("vendor/scripture/bsb/usj")
    VERSION = "3.1"

    module_function

    def path_for(book)
      ROOT.join("#{book.to_s.upcase}.usj.gz")
    end

    def available?(book)
      path_for(book).file?
    end

    def reset!
      @books = nil
    end

    def load_book(book)
      code = book.to_s.upcase
      @books ||= {}
      @books[code] ||= begin
        path = path_for(code)
        raise "Missing BSB USJ for #{code} (#{path})" unless path.file?

        data = JSON.parse(Zlib::GzipReader.open(path, &:read))
        unless data.is_a?(Hash) && data["type"] == "USJ"
          raise "Invalid USJ root for #{code}"
        end

        data
      end
    end

    def chapter_nodes(book, chapter)
      n = chapter.to_i
      nodes = Array(load_book(book)["content"])
      start = nodes.find_index { |node| chapter_milestone?(node, n) }
      return [] unless start

      rest = nodes[(start + 1)..] || []
      stop = rest.find_index { |node| chapter_milestone?(node) }
      stop ? rest[0...stop] : rest
    end

    def chapter_milestone?(node, number = nil)
      return false unless node.is_a?(Hash) && node["type"] == "chapter"

      number.nil? || node["number"].to_i == number.to_i
    end

    def pack_chapter(book, chapter)
      nodes = chapter_nodes(book, chapter)
      return nil if nodes.empty?

      {
        "translation" => "BSB",
        "book" => book.to_s.upcase,
        "chapter" => chapter.to_i,
        "verses" => verse_rows(nodes),
        "source" => "vendor/scripture/bsb/usj",
        "license" => "public-domain"
      }
    end

    def verse_rows(nodes)
      heading = nil
      current = nil
      rows = []
      walk(nodes) do |kind, value|
        case kind
        when :s1
          heading = value
        when :verse
          current = { "v" => value.to_i, "text" => +"", "heading" => heading }
          heading = nil
          rows << current
        when :text
          current["text"] << value if current
        end
      end
      rows.each { |row| row["text"] = row["text"].gsub(/\s+/, " ").strip }
      rows.reject! { |row| row["v"] < 1 || row["text"].blank? }
      rows.each { |row| row.delete("heading") if row["heading"].blank? }
      rows
    end

    def walk(nodes, &block)
      list = nodes.is_a?(Array) ? nodes : [ nodes ]
      list.each { |node| walk_node(node, &block) }
    end

    def walk_node(node, &block)
      case node
      when String
        yield :text, node
      when Hash
        type = node["type"]
        marker = node["marker"].to_s
        if type == "verse"
          yield :verse, node["number"].to_i
        elsif type == "para" && marker == "s1"
          yield :s1, plain_text(node["content"])
        elsif type == "note" || (type == "para" && %w[r b h mt1 mt2 toc1 toc2 toc3].include?(marker))
          nil
        else
          walk(node["content"], &block)
        end
      end
    end

    def plain_text(nodes)
      parts = []
      walk(nodes) do |kind, value|
        parts << value if kind == :text
      end
      parts.join.gsub(/\s+/, " ").strip
    end
  end
end
