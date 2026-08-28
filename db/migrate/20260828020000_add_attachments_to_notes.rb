# frozen_string_literal: true

class AddAttachmentsToNotes < ActiveRecord::Migration[8.1]
  def change
    add_column :notes, :attachments, :json, null: false, default: []
  end
end
