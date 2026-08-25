# frozen_string_literal: true

require "test_helper"
require "erb"
require "yaml"

class VercelPreviewTest < ActiveSupport::TestCase
  test "production sqlite paths sit under writable storage/" do
    yaml = YAML.safe_load(
      ERB.new(Rails.root.join("config/database.yml").read).result,
      aliases: true
    )

    assert_equal "storage/production.sqlite3", yaml.dig("production", "primary", "database")
    assert_equal "storage/production_cache.sqlite3", yaml.dig("production", "cache", "database")
    assert_equal "storage/production_queue.sqlite3", yaml.dig("production", "queue", "database")
    assert_equal "storage/production_cable.sqlite3", yaml.dig("production", "cable", "database")
  end

  test "puma binds PORT from the environment" do
    puma = Rails.root.join("config/puma.rb").read
    assert_match(/port ENV\.fetch\("PORT"/, puma)
  end

  test "production boots from SECRET_KEY_BASE without master.key" do
    production = Rails.root.join("config/environments/production.rb").read
    assert_match(/config\.require_master_key = false/, production)
    assert_not File.exist?(Rails.root.join("config/master.key"))
  end

  test "Dockerfile.vercel matches ruby-version and seeds BSB at image build" do
    ruby_version = File.read(Rails.root.join(".ruby-version")).strip.delete_prefix("ruby-")
    dockerfile = Rails.root.join("Dockerfile.vercel").read

    assert_match(/ARG RUBY_VERSION=#{Regexp.escape(ruby_version)}/, dockerfile)
    assert_match(/FROM ruby:\$\{RUBY_VERSION\}/, dockerfile)
    assert_match(/bundle install --without development test/, dockerfile)
    assert_match(/npm ci/, dockerfile)
    assert_match(/npm run build/, dockerfile)
    assert_match(/assets:precompile/, dockerfile)
    assert_match(/vendor\/scripture/, dockerfile)
    assert_match(/margin:seed_scripture/, dockerfile)
    assert_match(/PORT=80/, dockerfile)
    assert_match(%r{CMD \["/rails/bin/vercel-start"\]}, dockerfile)
  end

  test "vercel-start prepares db, seeds, and execs puma on PORT 80" do
    script = Rails.root.join("bin/vercel-start").read

    assert_match(/PORT:-\{?80\}?/, script)
    assert_match(/db:prepare margin:seed_scripture/, script)
    assert_match(/puma -C config\/puma.rb/, script)
  end
end
