# frozen_string_literal: true

module Margin
  module Mcp
    class PrepareGroupStudy < MCP::Tool
      tool_name "prepare_group_study"
      description "Small-group Bible study prep. Consider the leader's notes when drafting Kruger-shaped questions " \
                  "(warm-up, Google map, Houston, Achilles heel). Don't treat those notes as the answer the group must recite. " \
                  "Don't preach the landing in the question — leave a gap. " \
                  "Not for the leader's own private learning (use personal_study for that). " \
                  "If it is unclear whether they want personal study or group prep, ask before calling this tool. " \
                  "Serves BSB verse text next to the leader's outliner notes and Kruger-shaped questions. " \
                  "Never invent observations for verses they have not annotated. Empty question spans stay empty."
      input_schema(
        properties: {
          osis: { type: "string", description: "Chapter or range, e.g. jhn.4 or John 4 or 1jn.4.1-21" },
          notes: { type: "string", description: "Optional extra observations (the leader's words only). Library notes for the passage are included automatically." }
        },
        required: [ "osis" ]
      )
      annotations(read_only_hint: true, destructive_hint: false, idempotent_hint: true, open_world_hint: false)

      class << self
        def call(osis:, notes: nil, server_context:)
          call_study(osis:, notes:, server_context:, kind: :group)
        end

        def call_study(osis:, notes:, server_context:, kind:)
          library = Mcp.library_from(server_context)
          passage = Margin::Passage.parse(osis)
          unless passage
            return MCP::Tool::Response.new(
              [ { type: "text", text: "Couldn’t resolve #{osis.inspect} to a passage." } ],
              error: true
            )
          end

          library_notes = library.notes.where(book: passage.book, chapter: passage.chapter).order(:verse_start, :id)
          payload = StudyPrep.build(passage: passage, notes: library_notes, extra_notes: notes, kind: kind)
          MCP::Tool::Response.new(
            [ { type: "text", text: payload[:markdown] } ],
            structured_content: JSON.parse(payload.to_json)
          )
        end
      end
    end
  end
end
