# frozen_string_literal: true

module Margin
  module Mcp
    class PrepareGroupStudy < MCP::Tool
      tool_name "prepare_group_study"
      description "Small-group Bible study prep. Default output is a leader sheet in the Hebrews 12 shape: " \
                  "3–4 BSB chunks, bold text-answerable questions (1–2 per noted section), and private italic Paths " \
                  "(text-first; a clipped “your note” is one option, not the landing). " \
                  "Don't treat the leader's notes as the answer the group must recite. Don't preach the landing in the question — leave a gap. " \
                  "That leave-a-gap rule is for group questions only, not for 1:1 chat. " \
                  "This is the initial sheet when the user is leading. Do not start with labeled facilitation jargon or a long 1:1 dig. " \
                  "Flags verses whose library notes are still cloudy or unfinished so the leader does not dodge them. " \
                  "Not for the leader's own private learning (use personal_study for that). " \
                  "If it is unclear whether they want personal study or group prep, ask before calling this tool. " \
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
