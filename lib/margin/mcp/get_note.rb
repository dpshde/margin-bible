# frozen_string_literal: true

module Margin
  module Mcp
    class GetNote < MCP::Tool
      tool_name "get_note"
      description "Get one note from the authorized library by OSIS or slug. " \
                  "Does not merge overlapping notes."
      input_schema(
        properties: {
          osis: { type: "string", description: "Note address, e.g. jhn.3.16 or John 3:16" }
        },
        required: [ "osis" ]
      )
      annotations(read_only_hint: true, destructive_hint: false, idempotent_hint: true, open_world_hint: false)

      class << self
        def call(osis:, server_context:)
          library = Mcp.library_from(server_context)
          passage = Margin::Passage.parse(osis)
          note = passage && library.notes.find_by(slug: passage.slug)
          if note
            MCP::Tool::Response.new(
              [ { type: "text", text: JSON.pretty_generate(note.as_mcp) } ],
              structured_content: note.as_mcp
            )
          else
            MCP::Tool::Response.new(
              [ { type: "text", text: "No note at #{osis} in this library." } ],
              error: true
            )
          end
        end
      end
    end
  end
end
