class CreateLibraries < ActiveRecord::Migration[8.1]
  def change
    create_table :libraries do |t|
      t.string :claim_token, null: false
      t.string :last_read_slug

      t.timestamps
    end
    add_index :libraries, :claim_token, unique: true
  end
end
