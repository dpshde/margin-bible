# frozen_string_literal: true

class AllowNullEmailOnUsers < ActiveRecord::Migration[8.1]
  def change
    change_column_null :users, :email, true
  end
end
