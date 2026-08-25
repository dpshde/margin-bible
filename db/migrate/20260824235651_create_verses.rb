class CreateVerses < ActiveRecord::Migration[8.1]
  def change
    create_table :verses do |t|
      t.string :translation, null: false
      t.string :book, null: false
      t.integer :chapter, null: false
      t.integer :verse, null: false
      t.text :text, null: false
      t.string :heading

      t.timestamps
    end
    add_index :verses, [ :translation, :book, :chapter, :verse ], unique: true
    add_index :verses, [ :translation, :book, :chapter ]
  end
end
