# frozen_string_literal: true

# Write-signature columns for a later agent-write slice.
# Unused by the reader and by the read-only MCP tools in this PR.
class AddAgentSignatureToNotes < ActiveRecord::Migration[8.1]
  def change
    add_column :notes, :source, :string, null: false, default: "human"
    add_column :notes, :agent_name, :string
    add_column :notes, :agent_color, :string
  end
end
