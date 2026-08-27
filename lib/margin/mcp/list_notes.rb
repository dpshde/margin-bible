# frozen_string_literal: true

module Margin
  module Mcp
    class ListNotes < MCP::Tool
      tool_name "list_notes"
      description "List notes in the authorized library. Filter by book, chapter, exact OSIS/slug, or a text query. " \
                  "Overlapping notes stay separate."
      input_schema(
        properties: {
          book: { type: "string", description: "Book name or OSIS code, e.g. John or JHN" },
          chapter: { type: "integer", description: "Chapter number" },
          osis: { type: "string", description: "Exact note address, e.g. jhn.3.16 or JHN.3.16-18" },
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
