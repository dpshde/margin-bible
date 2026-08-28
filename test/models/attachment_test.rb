# frozen_string_literal: true

require "test_helper"

class AttachmentTest < ActiveSupport::TestCase
  test "parse_input turns a human ref into an xref chip" do
    att = Margin::Attachment.parse_input("John 3:16")
    assert_equal "xref", att["kind"]
    assert_equal "jhn.3.16", att["slug"]
    assert_equal "John 3:16", att["title"]
  end

  test "parse_input prefers an xref when a URL is a passage path" do
    att = Margin::Attachment.parse_input("https://route.bible/rom.8.28")
    assert_equal "xref", att["kind"]
    assert_equal "rom.8.28", att["slug"]
  end

  test "parse_input keeps a generic weblink" do
    att = Margin::Attachment.parse_input("https://example.com/essay")
    assert_equal "url", att["kind"]
    assert_equal "https://example.com/essay", att["url"]
    assert_equal "example.com", att["title"]
  end

  test "parse_input ignores a bare book name" do
    assert_nil Margin::Attachment.parse_input("John")
    assert_nil Margin::Attachment.parse_input("not a link")
  end

  test "normalize_list dedupes and stamps ids" do
    rows = Margin::Attachment.normalize_list([
      { "kind" => "xref", "slug" => "jhn.3.16" },
      { "kind" => "xref", "slug" => "John 3:16" },
      { "kind" => "url", "url" => "https://example.com" }
    ])
    assert_equal 2, rows.size
    assert rows.all? { |row| row["id"].match?(/\Aatt_/) }
    assert_equal [ "xref", "url" ], rows.map { |row| row["kind"] }
  end

  test "merge_xrefs_from_blocks lifts parsed and wiki refs onto the note" do
    rows = Margin::Attachment.merge_xrefs_from_blocks(
      [ { "kind" => "url", "url" => "https://example.com" } ],
      [ { "text" => "See John 3:16 and [[jhn.1.6|John]] and `Romans 8:28`" } ]
    )
    assert_equal [ "url", "xref", "xref" ], rows.map { |row| row["kind"] }
    assert_equal [ "jhn.1.6", "jhn.3.16" ], rows.filter_map { |row| row["slug"] }.sort
  end

  test "merge_xrefs_from_blocks replaces scan xrefs when the inline ref changes" do
    first = Margin::Attachment.merge_xrefs_from_blocks([], [ { "text" => "See John 3:16" } ])
    assert_equal [ "jhn.3.16" ], first.map { |row| row["slug"] }
    assert_equal "scan", first[0]["source"]

    renamed = Margin::Attachment.merge_xrefs_from_blocks(first, [ { "text" => "See John 3:17" } ])
    assert_equal [ "jhn.3.17" ], renamed.map { |row| row["slug"] }

    cleared = Margin::Attachment.merge_xrefs_from_blocks(renamed, [ { "text" => "No refs" } ])
    assert_equal [], cleared

    kept = Margin::Attachment.merge_xrefs_from_blocks(
      [
        { "kind" => "xref", "slug" => "rom.8.28", "source" => "manual" },
        { "kind" => "url", "url" => "https://example.com" }
      ],
      [ { "text" => "See John 3:16" } ]
    )
    assert_equal [ "url", "xref", "xref" ], kept.map { |row| row["kind"] }.sort
    assert_includes kept.map { |row| row["slug"] }, "rom.8.28"
    assert_includes kept.map { |row| row["slug"] }, "jhn.3.16"

    leftover = Margin::Attachment.merge_xrefs_from_blocks(
      [
        { "kind" => "xref", "slug" => "rom.5.3-6" },
        { "kind" => "xref", "slug" => "rom.5.3-5" }
      ],
      [ { "text" => "Romans 5:3-5" } ]
    )
    assert_equal [ "rom.5.3-5" ], leftover.map { |row| row["slug"] }
    assert_equal "scan", leftover[0]["source"]
  end
end
