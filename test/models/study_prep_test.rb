# frozen_string_literal: true

require "test_helper"

class StudyPrepTest < ActiveSupport::TestCase
  test "groups a chapter into three or four BSB chunks with a spoken opener" do
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: [])
    sizes = payload[:sections].map { |section| section[:end] - section[:start] }
    assert_operator payload[:sections].size, :>=, 3
    assert_operator payload[:sections].size, :<=, 4
    assert payload[:missing_observations]
    assert_includes payload[:markdown], "## Open with this"
    assert_includes payload[:markdown], "## Read and ask"
    assert_includes payload[:markdown], "In the beginning was the Word"
    refute_includes payload[:markdown], "?mode=launcher"
    refute_includes payload[:markdown], "## Scripture, notes, and questions"
    assert payload[:opener].to_s.include?("In the beginning was the Word")
    payload[:sections].each { |section| assert_empty section[:questions] }
    assert_includes payload[:markdown], "no leader notes in this span yet"
    assert sizes.all? { |size| size >= 0 }
    assert_equal "csb", payload[:lead_translation]
    assert_equal "bsb", payload[:hosted_translation]
    assert_includes payload[:markdown], "Family lead: CSB (until Humble Lamb BSB)"
    assert_includes payload[:markdown], "Hosted verses below are BSB"
    refute_includes payload[:markdown], "CSB wording of"
  end

  test "group lead translation defaults to csb and never invents CSB verse text" do
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: [])
    assert_equal "csb", payload[:lead_translation]
    assert_equal "bsb", payload[:hosted_translation]
    assert_includes payload[:markdown], "In the beginning was the Word"
    assert_includes payload[:markdown], "do not invent CSB wording"

    bsb_lead = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: [], translation: "bsb")
    assert_equal "bsb", bsb_lead[:lead_translation]
    assert_equal "bsb", bsb_lead[:hosted_translation]
    assert_includes bsb_lead[:markdown], "Lead and hosted text: BSB."
    refute_includes bsb_lead[:markdown], "Family lead: CSB"
    assert_includes bsb_lead[:markdown], "In the beginning was the Word"
  end

  test "group run-of-show asks from the text and keeps notes off the group's script" do
    library = Library.create!
    create_note!(library, "jhn.1", "The chapter is about the Word made flesh, not a slogan.")
    create_note!(library, "jhn.1.1", "Kind of wild to start here — why a warning before comfort?")
    create_note!(library, "jhn.1.14", "The Word became flesh. Jesus is FROM God.\nSECOND_LINE_MUST_NOT_APPEAR_IN_PACK")
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: library.notes)

    refute payload[:missing_observations]
    assert payload[:convictions].any? { |item| item[:text].include?("Word made flesh") }
    refute_includes payload[:markdown], "## Leader notes (consider these)"
    refute_match(/Jesus is the destination/i, payload[:brief])
    refute_match(/convictions are the destination/i, payload[:brief])
    assert_match(/leave a gap/i, payload[:brief])
    refute_match(/\b(warm-?up|google map|houston|achilles)\b/i, payload[:markdown])
    refute_match(/\b(warm-?up|google map|houston|achilles)\b/i, payload[:brief])
    assert_empty payload[:warmup]

    questions = payload[:sections].flat_map { |section| section[:questions] }
    assert questions.any?
    assert questions.all? { |question| question[:from] == "text" && question[:kind] == "ask" }
    refute questions.any? { |question| question[:text].include?("FROM God") }
    refute_includes payload[:markdown], "SECOND_LINE_MUST_NOT_APPEAR_IN_PACK"
    refute_match(/\t- Kind of wild to start here/, payload[:markdown])

    noted = questions.find { |question| Array(question[:paths]).any? { |path| path[:kind] == "note" } }
    assert noted, "expected a clipped your-note path on a noted span"
    note_path = noted[:paths].find { |path| path[:kind] == "note" }
    assert noted[:paths].first[:kind] == "text"
    assert_equal "note", noted[:paths].last[:kind]
    assert note_path[:text].length <= 90
    assert_includes payload[:markdown], "Paths: (private — do not read these to the group)"
    assert_includes payload[:markdown], "your note — one path, not the landing"
    payload[:sections].each do |section|
      assert_match(%r{\Ahttps://route\.bible/jhn\.1}, section[:launcher_url])
      if section[:observations].empty?
        assert_empty section[:questions]
      else
        assert_operator section[:questions].size, :>=, 1
        assert_operator section[:questions].size, :<=, 2
        section[:questions].each do |question|
          text_paths = Array(question[:paths]).select { |path| path[:kind] == "text" }
          assert text_paths.any?, "expected text paths before any note"
        end
      end
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
    assert_includes payload[:markdown], "no leader notes in this span yet"
    assert_includes payload[:markdown], "In the beginning was the Word"
    refute_match(/\t- The Word\./, payload[:markdown])
  end

  test "flags cloudy library notes so the leader cannot dodge them" do
    library = Library.create!
    create_note!(library, "heb.12.26", "What does it mean He will shake heaven?")
    create_note!(library, "heb.12.11", "The peaceful fruit of righteousness (CSB)")
    create_note!(library, "heb.12.7", "Suffering is named as discipline for sons.")
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("heb.12"), notes: library.notes)

    cloudy_verses = payload[:cloudy].map { |flag| flag[:verse] }
    assert_includes cloudy_verses, 26
    assert_includes cloudy_verses, 11
    refute_includes cloudy_verses, 7
    assert_includes payload[:markdown], "## Do not skip"
    assert_includes payload[:markdown], "v. 26"
    assert_includes payload[:markdown], "still unfinished in your notes"
    refute_match(/^\d+\. Suffering is named/, payload[:markdown])
    note_paths = payload[:sections].flat_map { |section|
      section[:questions].flat_map { |question| Array(question[:paths]) }
    }.select { |path| path[:kind] == "note" }
    assert note_paths.any? { |path| path[:text].include?("Suffering is named") }
    assert note_paths.all? { |path|
      payload[:sections].any? { |section|
        section[:questions].any? { |question|
          question[:paths]&.first&.fetch(:kind, nil) == "text" && question[:paths]&.last == path
        }
      }
    }
  end

  test "hebrews 12 pack is a holdable run-of-show with private paths" do
    library = Library.create!
    create_note!(library, "heb.12.1", "Who are the witnesses?")
    create_note!(library, "heb.12.2", "He endured the cross with joy.\nPRIVATE_LANDING_MUST_NOT_DUMP")
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("heb.12"), notes: library.notes)
    markdown = payload[:markdown]

    assert_includes markdown, "Hebrews 12 — what you hold"
    assert_includes markdown, "Say this out loud:"
    assert_includes markdown, "great cloud of witnesses"
    assert_includes markdown, "A Call to Endurance"
    assert_includes markdown, "God Disciplines His Sons"
    assert_includes markdown, "An Unshakable Kingdom"
    assert_includes markdown, "Paths: (private — do not read these to the group)"
    assert_includes markdown, "your note — one path, not the landing"
    refute_includes markdown, "PRIVATE_LANDING_MUST_NOT_DUMP"
    refute_match(/\b(warm-?up|google map|houston|achilles)\b/i, markdown)
    noted, empty = payload[:sections].partition { |section| section[:observations].any? }
    assert noted.any?
    assert empty.any?
    noted.each do |section|
      assert_operator section[:questions].size, :>=, 1
      assert_operator section[:questions].size, :<=, 2
      section[:questions].each do |question|
        assert_match(/\bverse \d+\b/i, question[:text])
        assert Array(question[:paths]).any? { |path| path[:kind] == "text" }
      end
    end
    empty.each { |section| assert_empty section[:questions] }
  end

  test "personal study presses the reader's notes and skips group facilitation" do
    library = Library.create!
    create_note!(library, "jhn.1.14", "The Word became flesh. Jesus is FROM God.")
    payload = Margin::StudyPrep.build(passage: Margin::Passage.parse("jhn.1"), notes: library.notes, kind: :personal)

    assert_equal "personal", payload[:kind]
    assert_equal "bsb", payload[:lead_translation]
    assert_equal "bsb", payload[:hosted_translation]
    refute_includes payload[:markdown], "Family lead: CSB"
    assert_empty payload[:warmup]
    refute_includes payload[:markdown], "Warm-up"
    refute_includes payload[:markdown], "Google map"
    refute_includes payload[:markdown], "Paths:"
    assert_includes payload[:markdown], "personal study"
    kinds = payload[:sections].flat_map { |section| section[:questions].map { |question| question[:kind] } }
    assert (kinds & %w[open trace check press]).any?
    refute (kinds & %w[warmup google_map houston achilles ask]).any?
  end
end
