# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

namespace :margin do
  desc "Fetch Arweave BSB JSONL once and write the chapter-keyed local pack"
  task build_bsb_pack: :environment do
    url = Margin::Bsb.source_url
    dest = Margin::Bsb.pack_path
    headings = begin
      Margin::Bsb.headings_from_pack
    rescue StandardError
      {}
    end

    uri = URI(url)
    request = Margin::Bsb.get_request(uri)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = 20
    http.read_timeout = 120

    response = http.request(request)
    unless response.is_a?(Net::HTTPSuccess)
      raise "BSB fetch failed: #{response.code} (Range is not used; full GET only)"
    end

    chapters = Margin::Bsb.pack_from_jsonl(StringIO.new(response.body), headings: headings)
    raise "too few chapters in BSB pack: #{chapters.size}" if chapters.size < 1000

    bytes = Margin::Bsb.write_pack!(chapters, dest)
    Margin::Bsb.reset_pack!
    verses = chapters.values.sum { |chapter| chapter["verses"].size }
    write_bsb_source!(url, response.body.bytesize, verses, chapters.size, bytes)
    puts "Wrote #{dest} chapters=#{chapters.size} verses=#{verses}"
  end

  desc "Load BSB (with pericope headings) into verses from the local pack"
  task seed_scripture: :environment do
    if Verse.bsb.exists? && ENV["FORCE"].blank?
      puts "BSB already loaded (#{Verse.bsb.count} verses). FORCE=1 to reload."
      next
    end

    unless Margin::Bsb.pack_path.exist?
      raise "Missing #{Margin::Bsb.pack_path}. Run bin/rails margin:build_bsb_pack or keep the committed fallback."
    end

    count = Margin::Bsb.seed_all!
    puts "Loaded #{count} BSB verses from #{Margin::Bsb.pack_path}"
  end
end

def write_bsb_source!(url, source_bytes, verses, chapters, pack_bytes)
  notice = Rails.root.join("vendor/scripture/bsb/NOTICE")
  source = Rails.root.join("vendor/scripture/bsb/SOURCE.txt")
  notice.write(
    "Berean Standard Bible (BSB)\n" \
    "Public domain as of 2023-04-30 (Berean Bible Translation Committee / Bible Hub).\n" \
    "Canonical file: #{url} (bsb.jsonl, Arweave TX).\n" \
    "HTTP Range is not supported on this transaction. The chapter pack is built with one full GET at image build, never on a reader request.\n" \
    "Local pack vendor/scripture/bsb/chapters.json.gz is a disposable cache (ADR 0007). Verse text is never merged into notes.\n"
  )
  source.write(
    "url=#{url}\n" \
    "filename=bsb.jsonl\n" \
    "source_bytes=#{source_bytes}\n" \
    "verses=#{verses}\n" \
    "chapters=#{chapters}\n" \
    "pack_gz=chapters.json.gz\n" \
    "pack_bytes=#{pack_bytes}\n" \
    "range_supported=false\n"
  )
end
