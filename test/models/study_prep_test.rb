# frozen_string_literal: true

require "test_helper"

class StudyPrepTest < ActiveSupport::TestCase
  test "groups a chapter into three or four sections from BSB headings" do
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: [])
    sizes = payload[:sections].map { |section| section[:end] - section[:start] }
    assert_operator payload[:sections].size, :>=, 3
    assert_operator payload[:sections].size, :<=, 4
    assert payload[:missing_observations]
    assert_includes payload[:markdown], "## Scripture, notes, and questions"
    assert_includes payload[:markdown], "In the beginning was the Word"
    assert_includes payload[:markdown], "?mode=launcher"
    assert sizes.all? { |size| size >= 0 }
  end

  test "lifts the human's own questions and quotes their observations" do
    library = Library.create!
    create_note!(library, "jhn.1", "The chapter is about the Word made flesh, not a slogan.")
    create_note!(library, "jhn.1.1", "Kind of wild to start here — why a warning before comfort?")
    create_note!(library, "jhn.1.14", "The Word became flesh. Jesus is FROM God.")
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: library.notes)

    refute payload[:missing_observations]
    assert payload[:convictions].any? { |item| item[:text].include?("Word made flesh") }
    assert_includes payload[:markdown], "## Leader notes (consider these)"
    refute_match(/Jesus is the destination/i, payload[:brief])
    refute_match(/convictions are the destination/i, payload[:brief])
    assert_match(/leave a gap/i, payload[:brief])
    questions = payload[:sections].flat_map { |section| section[:questions] }
    assert questions.any? { |question| question[:from] == "lifted" && question[:text].include?("why a warning") }
    quoted = questions.find { |question| question[:text].include?("Jesus is FROM God") }
    assert quoted
    assert quoted[:from_note].include?("FROM God")
    assert_includes %w[google_map houston achilles], quoted[:kind]
    refute_match(/about Jesus|Jesus is the destination/i, quoted[:text])
    assert payload[:warmup].any?
    assert_equal "warmup", payload[:warmup].first[:kind]
    assert_includes payload[:warmup].first[:text], "Word made flesh"
    assert_includes payload[:markdown], "## Warm-up"
    assert_includes payload[:markdown], "**Google map.**"
    assert_match(/\t- Kind of wild to start here/, payload[:markdown])
    payload[:sections].each do |section|
      assert_match(%r{\Ahttps://route\.bible/jhn\.1}, section[:launcher_url])
      assert_includes section[:launcher_url], "mode=launcher"
    end
  end

  test "does not invent observations when the span has none" do
    library = Library.create!
    create_note!(library, "jhn.1.1", "The Word.")
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: library.notes)
    empty = payload[:sections].select { |section| section[:observations].empty? }
    assert empty.any?
    empty.each do |section|
      assert_empty section[:questions]
      section[:verses].each do |verse|
        assert_includes payload[:markdown], "#{verse[:n]}. #{verse[:text]}"
        assert verse[:observations].empty?
      end
    end
    assert_includes payload[:markdown], "In the beginning was the Word"
    assert_match(/\t- The Word\./, payload[:markdown])
  end

  test "personal study presses the reader's notes and skips group facilitation" do
    library = Library.create!
    create_note!(library, "jhn.1.14", "The Word became flesh. Jesus is FROM God.")
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: library.notes, kind: :personal)

    assert_equal "personal", payload[:kind]
    assert_empty payload[:warmup]
    refute_includes payload[:markdown], "Warm-up"
    refute_includes payload[:markdown], "Google map"
    assert_includes payload[:markdown], "personal study"
    kinds = payload[:sections].flat_map { |section| section[:questions].map { |question| question[:kind] } }
    assert (kinds & %w[open trace check press]).any?
    refute (kinds & %w[warmup google_map houston achilles]).any?
  end
end
