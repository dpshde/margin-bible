# frozen_string_literal: true

class AddBookmarkedToNotes < ActiveRecord::Migration[8.1]
  def change
    add_column :notes, :bookmarked, :boolean, default: false, null: false
    add_index :notes, [ :library_id, :bookmarked ]
  end
end
