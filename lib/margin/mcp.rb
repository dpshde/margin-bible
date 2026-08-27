# frozen_string_literal: true

module Margin
  # Read-only MCP server for a single authorized library.
  module Mcp
    SERVER_NAME = "margin.bible"
    SERVER_VERSION = "1.0.0"
    WRITE_TOOL_NAMES = %w[
      create_note update_note delete_note write_note upsert_note
      create_notes update_notes delete_notes
    ].freeze

    module_function

    def server(library:)
      MCP::Server.new(
        name: SERVER_NAME,
        title: "margin.bible notes",
        version: SERVER_VERSION,
        instructions: "Read notes from the library the user authorized. " \
                      "Overlapping notes stay separate — a verse note and a range note that covers it are two records. " \
                      "Do not invent write tools.",
        tools: [ ListNotes, GetNote, ListNotesCoveringVerse ],
        server_context: { library: library }
      )
    end

    def transport(library:, request:)
      MCP::Server::Transports::StreamableHTTPTransport.new(
        server(library: library),
        stateless: true,
        enable_json_response: true,
        allowed_hosts: allowed_hosts(request)
      )
    end

    def allowed_hosts(request)
      hosts = [ request.host, "localhost", "127.0.0.1" ]
      if (app_host = ENV["APP_HOST"].presence)
        hosts << URI.parse(app_host.start_with?("http") ? app_host : "https://#{app_host}").host
      end
      hosts.compact.uniq
    end

    def library_from(server_context)
      if server_context.respond_to?(:[])
        server_context[:library]
      elsif server_context.respond_to?(:library)
        server_context.library
      end
    end
  end
end
