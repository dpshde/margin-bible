# frozen_string_literal: true

module Margin
  module Mcp
    class PersonalStudy < MCP::Tool
      tool_name "personal_study"
      description "Personal Bible study: help the reader go deeper in their own notes — learn and understand. " \
                  "Not for writing small-group discussion questions (use prepare_group_study for that). " \
                  "If it is unclear whether they want personal study or group prep, ask before calling this tool. " \
                  "Serves BSB verse text next to their outliner notes, grouped into 3–4 sections. " \
                  "1:1 press: one plain question in the reader's words. If they don't know, two options from the verse. " \
                  "No “the thing”, no stacked either/ors, no riddles. " \
                  "Never invent observations for verses they have not annotated."
      input_schema(
        properties: {
          osis: { type: "string", description: "Chapter or range, e.g. jhn.4 or John 4" },
          notes: { type: "string", description: "Optional extra observations in the reader's own words. Library notes are included automatically." }
        },
        required: [ "osis" ]
      )
      annotations(read_only_hint: true, destructive_hint: false, idempotent_hint: true, open_world_hint: false)

      class << self
        def call(osis:, notes: nil, server_context:)
          PrepareGroupStudy.call_study(osis:, notes:, server_context:, kind: :personal)
        end
      end
    end
  end
end
