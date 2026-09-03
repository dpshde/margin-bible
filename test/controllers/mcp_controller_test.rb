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
    assert_includes names, "personal_study"
    assert_includes names, "prepare_group_study"
    refute_includes names, "prepare_bible_study"
    group = mcp_result.dig("result", "tools").find { |tool| tool["name"] == "prepare_group_study" }
    desc = group["description"]
    refute_match(/\b(kruger|warm-?up|google map|houston|achilles)\b/i, desc)
    assert_match(/run-of-show/i, desc)
    assert_match(/empty question spans stay empty/i, desc)
    assert_match(/personal_study/, desc)
    assert_match(/leave a gap/i, desc)
    assert_match(/group questions only/i, desc)
    assert_match(/not for one-shotting a family-study sheet/i, desc)
    personal = mcp_result.dig("result", "tools").find { |tool| tool["name"] == "personal_study" }
    personal_desc = personal["description"]
    refute_match(/leave a gap; don't name the point/i, personal_desc)
    refute_match(/leave a gap/i, personal_desc)
    assert_match(/one plain question in the reader's words/i, personal_desc)
    assert_match(/two options from the verse/i, personal_desc)
    assert_match(/prepare_group_study/, personal_desc)
    assert_match(/never invent observations/i, personal_desc)
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

  test "prepare_group_study sections library notes and stays on this library" do
    create_note!(@library, "jhn.1.1", "Why start with the Word instead of a scene?")
    create_note!(@other, "jhn.1.1", "Theirs: do not use this.")

    mcp_json({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "prepare_group_study", arguments: { osis: "John 1" } }
    }, token: @token)
    assert_response :success
    content = mcp_result.dig("result", "structuredContent")
    assert_equal "group", content["kind"]
    assert_equal "jhn.1", content.dig("passage", "slug")
    assert_operator content["sections"].size, :>=, 3
    assert_operator content["sections"].size, :<=, 4
    text = mcp_result.dig("result", "content", 0, "text")
    assert_includes text, "In the beginning was the Word"
    assert_includes text, "Open with this"
    assert_includes text, "Paths: (private — do not read these to the group)"
    assert_includes text, "your note — one path, not the landing"
    assert_includes text, "Why start with the Word"
    refute_includes text, "Theirs: do not use this."
    refute_includes text, "?mode=launcher"
    refute_match(/\b(warm-?up|google map|houston|achilles)\b/i, text)
    questions = content["sections"].flat_map { |section| section["questions"] }
    assert questions.any? { |question| question["from"] == "text" }
    assert questions.any? { |question|
      Array(question["paths"]).any? { |path| path["kind"] == "note" }
    }
  end

  test "personal_study is for the reader's own learning not group facilitation" do
    create_note!(@library, "jhn.1.14", "The Word became flesh. Jesus is FROM God.")

    mcp_json({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "personal_study", arguments: { osis: "John 1" } }
    }, token: @token)
    assert_response :success
    content = mcp_result.dig("result", "structuredContent")
    assert_equal "personal", content["kind"]
    text = mcp_result.dig("result", "content", 0, "text")
    assert_includes text, "personal study"
    assert_includes text, "The Word became flesh"
    refute_includes text, "Warm-up"
    assert_match(/Open|Trace|Check|Press/, text)
  end

  test "server instructions require asking when study kind is unclear" do
    instructions = Margin::Mcp.server(library: @library).instructions
    assert_match(/personal_study/, instructions)
    assert_match(/prepare_group_study/, instructions)
    assert_match(/ask before calling a tool/i, instructions)
    assert_match(/group questions should leave a gap/i, instructions)
    assert_match(/that rule is not for 1:1/i, instructions)
    assert_match(/one plain question in the reader's words/i, instructions)
    assert_match(/order lives in the agent skill/i, instructions)
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
