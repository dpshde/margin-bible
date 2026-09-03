# frozen_string_literal: true

module Margin
  module Mcp
    class ListNotes < MCP::Tool
      tool_name "list_notes"
      description "List notes in the authorized library. Filter by book, chapter, OSIS/slug, or a text query. " \
                  "book accepts a name or OSIS code (Hebrews, Heb, HEB; Deuteronomy, Deut, DEU) and is case-insensitive. " \
                  "book+chapter lists every note in that chapter — use this; do not retry with a different spelling. " \
                  "A chapter-only osis (heb.12, Hebrews 12) lists every note in that chapter. " \
                  "A verse or range osis is an exact slug. Overlapping notes stay separate."
      input_schema(
        properties: {
          book: { type: "string", description: "Book name or OSIS code, e.g. John, JHN, Hebrews, HEB, Deut, DEU" },
          chapter: {
            description: "Chapter number. Integer or digit string (12 or \"12\").",
            anyOf: [ { type: "integer" }, { type: "string" } ]
          },
          osis: { type: "string", description: "Chapter (heb.12 / Hebrews 12) lists the chapter; verse/range is exact, e.g. jhn.3.16" },
          query: { type: "string", description: "Case-insensitive substring match on note body" }
        }
      )
      annotations(read_only_hint: true, destructive_hint: false, idempotent_hint: true, open_world_hint: false)

      class << self
        def call(book: nil, chapter: nil, osis: nil, query: nil, server_context:)
          library = Mcp.library_from(server_context)
          notes = Note.search_in(library, book: book, chapter: chapter, osis: osis, query: query)
          payload = Array(notes).map(&:as_mcp)
          MCP::Tool::Response.new(
            [ { type: "text", text: JSON.pretty_generate(payload) } ],
            structured_content: { notes: payload }
          )
        end
      end
    end
  end
end
