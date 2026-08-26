# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_26_190000) do
  create_table "libraries", force: :cascade do |t|
    t.string "claim_token", null: false
    t.datetime "created_at", null: false
    t.string "last_read_slug"
    t.json "read_trail", default: []
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.index ["claim_token"], name: "index_libraries_on_claim_token", unique: true
    t.index ["user_id"], name: "index_libraries_on_user_id"
  end

  create_table "magic_links", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.integer "library_id", null: false
    t.string "token", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["library_id"], name: "index_magic_links_on_library_id"
    t.index ["token"], name: "index_magic_links_on_token", unique: true
    t.index ["user_id"], name: "index_magic_links_on_user_id"
  end

  create_table "notes", force: :cascade do |t|
    t.json "blocks", default: [], null: false
    t.string "book", null: false
    t.boolean "bookmarked", default: false, null: false
    t.integer "chapter", null: false
    t.datetime "created_at", null: false
    t.string "kind", null: false
    t.integer "library_id", null: false
    t.string "osis", null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.integer "verse_end"
    t.integer "verse_start"
    t.index ["library_id", "book", "chapter"], name: "index_notes_on_library_id_and_book_and_chapter"
    t.index ["library_id", "bookmarked"], name: "index_notes_on_library_id_and_bookmarked"
    t.index ["library_id", "slug"], name: "index_notes_on_library_id_and_slug", unique: true
    t.index ["library_id"], name: "index_notes_on_library_id"
  end

  create_table "passkeys", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "external_id", null: false
    t.string "name"
    t.string "public_key", null: false
    t.integer "sign_count", default: 0, null: false
    t.json "transports", default: []
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["external_id"], name: "index_passkeys_on_external_id", unique: true
    t.index ["user_id"], name: "index_passkeys_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email"
    t.datetime "updated_at", null: false
    t.string "webauthn_id"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["webauthn_id"], name: "index_users_on_webauthn_id", unique: true
  end

  create_table "verses", force: :cascade do |t|
    t.string "book", null: false
    t.integer "chapter", null: false
    t.datetime "created_at", null: false
    t.string "heading"
    t.text "text", null: false
    t.string "translation", null: false
    t.datetime "updated_at", null: false
    t.integer "verse", null: false
    t.index ["translation", "book", "chapter", "verse"], name: "index_verses_on_translation_and_book_and_chapter_and_verse", unique: true
    t.index ["translation", "book", "chapter"], name: "index_verses_on_translation_and_book_and_chapter"
  end

  add_foreign_key "libraries", "users"
  add_foreign_key "magic_links", "libraries"
  add_foreign_key "magic_links", "users"
  add_foreign_key "notes", "libraries"
  add_foreign_key "passkeys", "users"
end
