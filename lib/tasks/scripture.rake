# frozen_string_literal: true

require "json"
require "zlib"

namespace :margin do
  desc "Load BSB (with pericope headings) into verses"
  task seed_scripture: :environment do
    if Verse.bsb.exists? && ENV["FORCE"].blank?
      puts "BSB already loaded (#{Verse.bsb.count} verses). FORCE=1 to reload."
      next
    end

    path = Rails.root.join("vendor/scripture/bsb/chapters.json.gz")
    raise "Missing #{path}" unless path.exist?

    data = JSON.parse(Zlib::GzipReader.open(path, &:read))
    now = Time.current
    rows = []
    data.each_value do |chapter|
      book = chapter["book"].to_s.upcase
      ch = chapter["chapter"].to_i
      Array(chapter["verses"]).each do |vr|
        rows << {
          translation: "BSB",
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

    Verse.where(translation: "BSB").delete_all
    rows.each_slice(200) { |slice| Verse.insert_all(slice) }
    puts "Loaded #{Verse.bsb.count} BSB verses"
  end
end
