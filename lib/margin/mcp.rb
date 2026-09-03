# frozen_string_literal: true

module Margin
  # Read-only MCP server for a single authorized library.
  module Mcp
    SERVER_NAME = "margin.bible"
    SERVER_VERSION = "1.0.0"
    # Latest MCP spec the official ruby-sdk serves (SEP-2575 stateless lifecycle).
    PROTOCOL_VERSION = MCP::Configuration::LATEST_STABLE_PROTOCOL_VERSION
    # initialize can only negotiate pre-2026-07-28 handshake versions.
    HANDSHAKE_VERSION = MCP::Configuration::LATEST_HANDSHAKE_PROTOCOL_VERSION
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
                      "There are two study tools. personal_study is when the reader wants to dive deeper themselves " \
                      "(learn, understand). prepare_group_study is when they are writing questions for a small group. " \
                      "If they say 'study this' without saying which, ask before calling a tool. " \
                      "Do not fire prepare_group_study first to one-shot a family-study sheet before 1:1 interrogation is done — that order lives in the agent skill. " \
                      "prepare_group_study group questions should leave a gap rather than name the point; that rule is not for 1:1. " \
                      "personal_study presses with one plain question in the reader's words. Leader notes are considered, not recited. " \
                      "prepare_group_study is a leader run-of-show (spoken opener, BSB chunks, text-answerable questions, private Paths). " \
                      "Do not read Paths or notes as the group's answers. Never invent observations or write tools. " \
                      "Empty question spans stay empty.",
        tools: [ ListNotes, GetNote, ListNotesCoveringVerse, PersonalStudy, PrepareGroupStudy ],
        server_context: { library: library },
        configuration: MCP::Configuration.new(protocol_version: HANDSHAKE_VERSION)
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
