# frozen_string_literal: true

class Note < ApplicationRecord
  belongs_to :library

  validates :slug, :osis, :kind, :book, :chapter, presence: true
  validates :slug, uniqueness: { scope: :library_id }

  def passage
    Margin::Passage.parse(slug)
  end

  def body_text
    Array(blocks).map { |b|
      ("  " * b["indent"].to_i) + b["text"].to_s
    }.join("\n")
  end

  def empty_content?
    Array(blocks).none? { |b| b["text"].to_s.strip.present? }
  end

  def self.blocks_from_text(text, previous: [])
    lines = text.to_s.split("\n")
    lines = [ "" ] if text.to_s.empty?
    prev = Array(previous)
    lines.map.with_index do |line, i|
      indent = (line[/\A */]&.size.to_i / 2)
      body = line.sub(/\A {0,}/, "")
      id = prev.dig(i, "id").presence || "b_#{SecureRandom.hex(4)}"
      { "id" => id, "indent" => indent, "text" => body }
    end
  end

  def apply_text!(text)
    self.blocks = self.class.blocks_from_text(text, previous: Array(blocks))
    self
  end
end
