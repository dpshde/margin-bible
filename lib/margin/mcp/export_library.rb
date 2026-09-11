# frozen_string_literal: true

module Margin
  module Mcp
    class ExportLibrary < MCP::Tool
      tool_name "export_library"
      description "Return a read-only JSON snapshot of the authorized library " \
                  "(margin.library-snapshot v1). Same shape as GET /export: " \
                  "last-read slug, read trail, and every note. Does not write " \
                  "or invent credentials."
      annotations(read_only_hint: true, destructive_hint: false, idempotent_hint: true, open_world_hint: false)

      class << self
        def call(server_context:)
          library = Mcp.library_from(server_context)
          payload = Margin::LibrarySnapshot.build(library)
          MCP::Tool::Response.new(
            [ { type: "text", text: JSON.pretty_generate(payload) } ],
            structured_content: payload
          )
        end
      end
    end
  end
end
