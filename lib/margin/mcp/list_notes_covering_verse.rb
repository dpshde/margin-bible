# frozen_string_literal: true

module Margin
  module Mcp
    class ListNotesCoveringVerse < MCP::Tool
      tool_name "list_notes_covering_verse"
      description "List every note whose span covers a verse (exact verse notes and overlapping range notes). " \
                  "Chapter notes never cover a verse. Records stay separate — compose, don't absorb."
      input_schema(
        properties: {
          osis: { type: "string", description: "A verse address, e.g. jhn.3.16 or John 3:16" }
        },
        required: [ "osis" ]
      )
      annotations(read_only_hint: true, destructive_hint: false, idempotent_hint: true, open_world_hint: false)

      class << self
        def call(osis:, server_context:)
          library = Mcp.library_from(server_context)
          notes = Note.covering_verse(library, osis)
          payload = notes.map(&:as_mcp)
          MCP::Tool::Response.new(
            [ { type: "text", text: JSON.pretty_generate(payload) } ],
            structured_content: { notes: payload }
          )
        end
      end
    end
  end
end
