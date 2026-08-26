# frozen_string_literal: true

require "test_helper"
require "erb"
require "yaml"

class ContainerDeployTest < ActiveSupport::TestCase
  test "production sqlite paths sit under writable storage/" do
    yaml = YAML.safe_load(
      ERB.new(Rails.root.join("config/database.yml").read).result,
      aliases: true
    )

    assert_nil ENV["DATABASE_URL"]
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

  test "production does not SMTP to localhost without SMTP_ADDRESS" do
    production = Rails.root.join("config/environments/production.rb").read
    assert_match(/SMTP_ADDRESS/, production)
    assert_match(/delivery_method = :file/, production)
    refute_match(/host: "example.com"/, production)
  end

  test "Dockerfile matches ruby-version and seeds BSB at image build" do
    ruby_version = File.read(Rails.root.join(".ruby-version")).strip.delete_prefix("ruby-")
    dockerfile = Rails.root.join("Dockerfile").read

    assert_match(/ARG RUBY_VERSION=#{Regexp.escape(ruby_version)}/, dockerfile)
    assert_match(/FROM ruby:\$\{RUBY_VERSION\}/, dockerfile)
    assert_match(/bundle config set without ["']development test["']/, dockerfile)
    assert_match(/bundle install/, dockerfile)
    assert_no_match(/bundle install --without/, dockerfile)
    assert_match(/npm ci/, dockerfile)
    assert_match(/npm run build/, dockerfile)
    assert_match(/assets:precompile/, dockerfile)
    assert_match(/vendor\/scripture/, dockerfile)
    assert_match(/libpq5/, dockerfile)
    assert_match(/libpq-dev/, dockerfile)
    assert_match(/margin:seed_scripture/, dockerfile)
    refute_match(/bereanbible\.com/, dockerfile)
    refute_match(/Range:/, dockerfile)
    refute_match(/[Vv]ercel/, dockerfile)
    assert_match(/PORT=80/, dockerfile)
    assert_match(%r{CMD \["/rails/bin/docker-start"\]}, dockerfile)
  end

  test "railway.json builds the Dockerfile" do
    config = JSON.parse(Rails.root.join("railway.json").read)

    assert File.exist?(Rails.root.join("Dockerfile"))
    assert_equal "DOCKERFILE", config.dig("build", "builder")
    assert_equal "Dockerfile", config.dig("build", "dockerfilePath")
    assert_equal "/up", config.dig("deploy", "healthcheckPath")
    refute File.exist?(Rails.root.join("vercel.json"))
  end

  test "docker-start prepares db, seeds, and execs puma on PORT 80" do
    script = Rails.root.join("bin/docker-start").read

    assert_match(/PORT:-\{?80\}?/, script)
    assert_match(/db:prepare margin:seed_scripture/, script)
    assert_match(/puma -C config\/puma.rb/, script)
    refute_match(/[Vv]ercel/, script)
  end
end
