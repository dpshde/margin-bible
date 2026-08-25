class CreateNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :notes do |t|
      t.references :library, null: false, foreign_key: true
      t.string :slug, null: false
      t.string :osis, null: false
      t.string :kind, null: false
      t.string :book, null: false
      t.integer :chapter, null: false
      t.integer :verse_start
      t.integer :verse_end
      t.json :blocks, null: false, default: []

      t.timestamps
    end
    add_index :notes, [ :library_id, :slug ], unique: true
    add_index :notes, [ :library_id, :book, :chapter ]
  end
end
