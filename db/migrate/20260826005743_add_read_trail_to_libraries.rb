# frozen_string_literal: true

class AddReadTrailToLibraries < ActiveRecord::Migration[8.1]
  def change
    add_column :libraries, :read_trail, :json, default: []
    reversible do |dir|
      dir.up do
        Library.reset_column_information
        Library.where.not(last_read_slug: [ nil, "" ]).find_each do |library|
          library.update_column(:read_trail, [ library.last_read_slug ])
        end
      end
    end
  end
end
