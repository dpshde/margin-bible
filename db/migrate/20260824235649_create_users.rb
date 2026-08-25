class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email, null: false

      t.timestamps
    end
    add_index :users, :email, unique: true
    add_reference :libraries, :user, foreign_key: true
  end
end
