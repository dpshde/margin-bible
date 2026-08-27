# frozen_string_literal: true

require "test_helper"

class McpControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "reader@example.com")
    @library = Library.create!(user: @user)
    @other = Library.create!(user: User.create!(email: "other@example.com"))
    create_note!(@library, "jhn.3.16", "Mine: the Logos.")
    create_note!(@library, "jhn.3.16-18", "Mine: the range.")
    create_note!(@library, "jhn.3", "Mine: the chapter.")
    create_note!(@other, "jhn.3.16", "Theirs: stay out.")
    @token = issue_library_token(@library, user: @user)
    @other_token = issue_library_token(@other, user: @other.user)
  end

  test "GET and POST without a token are denied with OAuth metadata" do
    get mcp_path
    assert_response :unauthorized
    assert_match(/resource_metadata=/, response.headers["WWW-Authenticate"])
    assert_includes JSON.parse(response.body)["error"], "invalid_token"

    mcp_json({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    assert_response :unauthorized
    assert_match(/oauth-protected-resource/, response.headers["WWW-Authenticate"])
  end

  test "a garbage token is denied" do
    mcp_json({ jsonrpc: "2.0", id: 1, method: "tools/list" }, token: "mb_nope")
    assert_response :unauthorized
  end

  test "server/discover advertises the 2026-07-28 protocol" do
    assert_equal "2026-07-28", Margin::Mcp::PROTOCOL_VERSION
    assert_equal MCP::Configuration::LATEST_STABLE_PROTOCOL_VERSION, Margin::Mcp::PROTOCOL_VERSION

    mcp_json({ jsonrpc: "2.0", id: 1, method: "server/discover" }, token: @token)
    assert_response :success
    result = mcp_result.fetch("result")
    assert_equal [ "2026-07-28" ], result["supportedVersions"]
    assert_equal "complete", result["resultType"]
    assert result.dig("capabilities", "tools")
  end

  test "legacy initialize negotiates the latest handshake version" do
    mcp_json({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2026-07-28",
        capabilities: {},
        clientInfo: { name: "legacy-agent", version: "1.0" }
      }
    }, token: @token, protocol: :legacy)
    assert_response :success
    assert_equal Margin::Mcp::HANDSHAKE_VERSION, mcp_result.dig("result", "protocolVersion")
    assert_equal "2025-11-25", mcp_result.dig("result", "protocolVersion")
  end

  test "write tools are absent from tools/list" do
    mcp_json({ jsonrpc: "2.0", id: 1, method: "tools/list" }, token: @token)
    assert_response :success
    assert_equal "complete", mcp_result.dig("result", "resultType")
    names = mcp_result.dig("result", "tools").map { |tool| tool["name"] }
    assert_includes names, "list_notes"
    assert_includes names, "get_note"
    assert_includes names, "list_notes_covering_verse"
    Margin::Mcp::WRITE_TOOL_NAMES.each do |name|
      refute_includes names, name
    end
    names.each do |name|
      refute_match(/write|create|update|delete|upsert/i, name)
    end
  end

  test "read tools return only the authorizing library" do
    mcp_json({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_notes", arguments: { book: "John" } }
    }, token: @token)
    assert_response :success
    notes = structured_notes
    slugs = notes.map { |note| note["slug"] }
    assert_includes slugs, "jhn.3.16"
    assert_includes slugs, "jhn.3.16-18"
    assert_includes slugs, "jhn.3"
    refute slugs.any? { |slug| notes.find { |note| note["slug"] == slug }["body"].include?("Theirs") }
    assert notes.all? { |note| note["body"].start_with?("Mine:") }
    assert notes.all? { |note| note.key?("osis") && note.key?("kind") && note.key?("created_at") && note.key?("updated_at") }
  end

  test "get_note does not leak another library's note at the same slug" do
    mcp_json({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_note", arguments: { osis: "jhn.3.16" } }
    }, token: @token)
    assert_response :success
    note = mcp_result.dig("result", "structuredContent")
    assert_equal "jhn.3.16", note["slug"]
    assert_equal "Mine: the Logos.", note["body"]

    mcp_json({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_note", arguments: { osis: "jhn.3.16" } }
    }, token: @other_token)
    other = mcp_result.dig("result", "structuredContent")
    assert_equal "Theirs: stay out.", other["body"]
  end

  test "list_notes_covering_verse returns verse and range notes without absorbing the chapter" do
    mcp_json({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "list_notes_covering_verse", arguments: { osis: "John 3:16" } }
    }, token: @token)
    assert_response :success
    slugs = structured_notes.map { |note| note["slug"] }
    assert_equal [ "jhn.3.16", "jhn.3.16-18" ].sort, slugs.sort
  end

  test "list_notes query and exact osis stay on the authorizing library" do
    mcp_json({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "list_notes", arguments: { query: "Theirs" } }
    }, token: @token)
    assert_equal [], structured_notes

    mcp_json({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "list_notes", arguments: { osis: "jhn.3.16-18" } }
    }, token: @token)
    notes = structured_notes
    assert_equal [ "jhn.3.16-18" ], notes.map { |note| note["slug"] }
    assert_equal "range", notes.first["kind"]
  end

  test "calling a write tool name fails because it is not registered" do
    mcp_json({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "create_note", arguments: { osis: "jhn.3.16", body: "nope" } }
    }, token: @token)
    assert_includes [ 200, 400 ], response.status
    refute mcp_result["result"]
    assert mcp_result["error"]
    assert_match(/create_note/, mcp_result.dig("error", "data").to_s)
  end

  private
    def structured_notes
      payload = mcp_result.dig("result", "structuredContent") || {}
      payload["notes"] || []
    end
end
