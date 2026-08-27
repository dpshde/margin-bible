# frozen_string_literal: true

module Margin
  # Groups a chapter into 3–4 sections from the human's notes.
  # kind: :personal (learn for yourself) or :group (Kruger small-group prep).
  class StudyPrep
    TARGET_MIN = 3
    TARGET_MAX = 4
    OBVIOUS = /\b(jesus is (god|the son|lord|divine)|god is love|jesus (died|rose) for (us|our)|the gospel is)\b/i
    TENSION = /\b(warning|must|never|if |but |danger|false|afraid|hard|confus|misread|seem(s)? to mean)\b/i

    GROUP_BRIEF = <<~TEXT.freeze
      Small-group prep. Consider the leader's notes; do not treat them as the answer the group must recite.
      Do not invent verse-by-verse observations. Do not preach the landing in the question — leave a gap.
      Kruger's shapes (TGC, 2017):
      1. Warm-up — everyone can answer before the passage; it sets a theme the notes noticed in the text.
      2. Google map — many good routes; don't telegraph the one point.
      3. Houston — a likely misread the notes flagged; chew on it with the rest of Scripture.
      4. Achilles heel — the hard question about this span the notes make it unwise to dodge.
      If a span has no notes, still serve the Scripture; leave questions empty.
    TEXT

    PERSONAL_BRIEF = <<~TEXT.freeze
      Personal study. Help the reader go deeper in the text — learn, understand, sit with it.
      Consider their notes; don't make those notes the answer. Don't preach the landing in the question — leave a gap.
      Do not invent verse-by-verse observations. Do not write small-group facilitation questions.
      Press what is still cloudy, where the same thing shows up again, how they might be misreading.
      Not trick-obvious. Not slogans. Not mainly self-improvement. Empty question spans stay empty.
    TEXT

    def self.build(passage:, notes: [], extra_notes: nil, kind: :group)
      new(passage: passage, notes: Array(notes), extra_notes: extra_notes, kind: kind).to_h
    end

    def initialize(passage:, notes:, extra_notes: nil, kind: :group)
      @passage = passage
      @notes = notes
      @extra_notes = extra_notes.to_s.strip.presence
      @kind = kind.to_sym == :personal ? :personal : :group
    end

    def to_h
      grouped = sections
      through_line = chapter_convictions
      missing = grouped.all? { |section| section[:observations].empty? } && through_line.empty? && @extra_notes.blank?
      warmup = !missing && group? ? warmup_questions(grouped, through_line) : []
      {
        kind: @kind.to_s,
        passage: passage_meta,
        missing_observations: missing,
        brief: (group? ? GROUP_BRIEF : PERSONAL_BRIEF).strip,
        convictions: through_line,
        warmup: warmup,
        sections: grouped,
        markdown: markdown(grouped, warmup, through_line)
      }
    end

    private

    def passage_meta
      {
        label: @passage.label,
        slug: @passage.slug,
        book: @passage.book,
        chapter: @passage.chapter,
        title_url: "#{RouteBible.url_for(@passage)}?utm_source=obsidian&utm_medium=note"
      }
    end

    def sections
      rows = verse_rows
      groups = group_by_heading(rows)
      groups = rebalance(groups)
      groups.each_with_index.map { |group, index| decorate(group, first: index.zero?) }
    end

    def verse_rows
      rows = Usj.verse_rows(Usj.chapter_nodes(@passage.book, @passage.chapter))
      return rows unless @passage.verse_start

      lo = @passage.verse_start
      hi = @passage.span_end
      rows.select { |row| row["v"].to_i >= lo && row["v"].to_i <= hi }
    end

    def group_by_heading(rows)
      groups = []
      rows.each do |row|
        if row["heading"].present? || groups.empty?
          groups << { heading: row["heading"].presence, verses: [] }
        end
        groups.last[:verses] << row
      end
      groups
    end

    def rebalance(groups)
      groups = groups.reject { |group| group[:verses].empty? }
      return groups if groups.empty?

      while groups.size > TARGET_MAX
        i = (0...(groups.size - 1)).min_by { |idx| groups[idx][:verses].size + groups[idx + 1][:verses].size }
        groups[i][:verses].concat(groups[i + 1][:verses])
        groups[i][:heading] ||= groups[i + 1][:heading]
        groups.delete_at(i + 1)
      end

      while groups.size < TARGET_MIN
        i = (0...groups.size).max_by { |idx| groups[idx][:verses].size }
        verses = groups[i][:verses]
        break if verses.size < 4

        mid = verses.size / 2
        groups[i, 1] = [
          { heading: groups[i][:heading], verses: verses[0...mid] },
          { heading: nil, verses: verses[mid..] }
        ]
      end

      groups
    end

    def decorate(group, first: false)
      start_v = group[:verses].first["v"].to_i
      end_v = group[:verses].last["v"].to_i
      range = Passage.new(book: @passage.book, chapter: @passage.chapter, verse_start: start_v, verse_end: end_v)
      observations = observations_for(start_v, end_v)
      if first && @extra_notes.present?
        split_observations(@extra_notes).each do |text|
          observations << { verse: start_v, slug: nil, text: text }
        end
      end
      {
        label: start_v == end_v ? "v. #{start_v}" : "vv. #{start_v}-#{end_v}",
        start: start_v,
        end: end_v,
        heading: group[:heading],
        launcher_url: "#{RouteBible.url_for(range)}?mode=launcher",
        verses: group[:verses].map { |row|
          {
            n: row["v"].to_i,
            text: row["text"],
            observations: observations.select { |obs| obs[:verse] == row["v"].to_i }.map { |obs| obs[:text] }
          }
        },
        observations: observations,
        questions: draft_questions(observations, start_v, end_v)
      }
    end

    def chapter_convictions
      items = []
      @notes.each do |note|
        next unless note.kind == "chapter"
        body = note.body_text.to_s.strip
        next if body.blank?

        split_observations(body).each do |text|
          items << { verse: nil, slug: note.slug, text: text }
        end
      end
      items
    end

    def observations_for(start_v, end_v)
      items = []
      @notes.each do |note|
        next if note.kind == "chapter"
        next unless note.verse_start
        last = note.verse_end.presence || note.verse_start
        next if last < start_v || note.verse_start > end_v

        body = note.body_text.to_s.strip
        next if body.blank?

        split_observations(body).each do |text|
          items << { verse: note.verse_start, slug: note.slug, text: text }
        end
      end
      items
    end

    def group?
      @kind == :group
    end

    def split_observations(body)
      body.split(/\n+/).map { |line| line.sub(/\A[-*]\s*/, "").strip }.reject(&:blank?)
    end

    def warmup_questions(grouped, through_line)
      seed = through_line.find { |obs| squeeze(obs[:text]).length >= 12 } ||
        grouped.flat_map { |section| section[:observations] }.find { |obs| squeeze(obs[:text]).length >= 12 }
      return [] unless seed

      clip = clip_text(seed[:text]).sub(/\?\z/, "")
      [{
        kind: "warmup",
        from_note: squeeze(seed[:text]),
        text: "The notes flag this in the passage: “#{clip}”. Before we open the text, where have you met something like that in ordinary life — not to moralize, but so we can hear what the text is actually doing?",
        source_verse: seed[:verse],
        from: seed[:verse] ? "observation" : "chapter"
      }]
    end

    def draft_questions(observations, start_v, end_v)
      label = start_v == end_v ? "v. #{start_v}" : "vv. #{start_v}–#{end_v}"
      meaty = observations.select { |obs| squeeze(obs[:text]).length >= 12 }
      return [] if meaty.empty?

      drafts = []
      lifted = meaty.select { |obs| obs[:text].include?("?") }
      lifted.each do |obs|
        drafts << {
          kind: "lifted",
          from_note: squeeze(obs[:text]),
          text: squeeze(obs[:text]),
          source_verse: obs[:verse],
          from: "lifted"
        }
      end

      map_seed = meaty.find { |obs| !obs[:text].include?("?") } || meaty.first
      tension_seed = meaty.find { |obs| squeeze(obs[:text]).match?(TENSION) || squeeze(obs[:text]).match?(OBVIOUS) }
      hard_seed = lifted.last || meaty.max_by { |obs| squeeze(obs[:text]).length }

      if group?
        drafts << google_map_question(map_seed, label) if map_seed
        drafts << houston_question(tension_seed, label) if tension_seed
        drafts << achilles_question(hard_seed, label) if hard_seed
      else
        drafts << open_question(map_seed, label) if map_seed
        drafts << trace_question(map_seed, label) if map_seed
        drafts << check_question(tension_seed || map_seed, label) if tension_seed || map_seed
        drafts << press_question(hard_seed, label) if hard_seed
      end

      drafts.uniq { |question| question[:text] }.first(4)
    end

    def google_map_question(obs, label)
      clip = clip_text(obs[:text])
      {
        kind: "google_map",
        from_note: squeeze(obs[:text]),
        text: "The notes on v.#{obs[:verse]} notice “#{clip}”. What other moments in #{label} or the rest of Scripture show the same thing — more than one route is good?",
        source_verse: obs[:verse],
        from: obs[:slug] ? "observation" : "extra"
      }
    end

    def houston_question(obs, label)
      clip = clip_text(obs[:text])
      {
        kind: "houston",
        from_note: squeeze(obs[:text]),
        text: "The notes on v.#{obs[:verse]} flag “#{clip}”. If someone left #{label} having inverted what the text is doing there, which other verses would you want in the room?",
        source_verse: obs[:verse],
        from: obs[:slug] ? "observation" : "extra"
      }
    end

    def achilles_question(obs, label)
      clip = clip_text(obs[:text])
      text = if obs[:text].include?("?")
        "The notes already ask the hard one on v.#{obs[:verse]}: #{squeeze(obs[:text])} What makes that uncomfortable to sit with in #{label}?"
      else
        "Given the notes on v.#{obs[:verse]} (“#{clip}”), what’s the question in #{label} a leader might hope nobody asks?"
      end
      {
        kind: "achilles",
        from_note: squeeze(obs[:text]),
        text: text,
        source_verse: obs[:verse],
        from: obs[:slug] ? "observation" : "extra"
      }
    end

    def open_question(obs, label)
      clip = clip_text(obs[:text])
      {
        kind: "open",
        from_note: squeeze(obs[:text]),
        text: "You wrote on v.#{obs[:verse]}: “#{clip}”. What in #{label} made that stand out — and what part of it is still cloudy?",
        source_verse: obs[:verse],
        from: obs[:slug] ? "observation" : "extra"
      }
    end

    def trace_question(obs, _label)
      clip = clip_text(obs[:text])
      {
        kind: "trace",
        from_note: squeeze(obs[:text]),
        text: "Your note on v.#{obs[:verse]} (“#{clip}”) — where else in this chapter or Scripture does that same thing show up, so you can see it more than once?",
        source_verse: obs[:verse],
        from: obs[:slug] ? "observation" : "extra"
      }
    end

    def check_question(obs, label)
      clip = clip_text(obs[:text])
      {
        kind: "check",
        from_note: squeeze(obs[:text]),
        text: "If your read of v.#{obs[:verse]} (“#{clip}”) were slightly off, what in #{label} would correct you?",
        source_verse: obs[:verse],
        from: obs[:slug] ? "observation" : "extra"
      }
    end

    def press_question(obs, label)
      clip = clip_text(obs[:text])
      {
        kind: "press",
        from_note: squeeze(obs[:text]),
        text: "Sit with your note on v.#{obs[:verse]}: “#{clip}”. If that’s true, what in #{label} still doesn’t sit easy?",
        source_verse: obs[:verse],
        from: obs[:slug] ? "observation" : "extra"
      }
    end

    def clip_text(text)
      clip = squeeze(text)
      clip.length > 110 ? "#{clip[0, 107]}…" : clip
    end

    def squeeze(text)
      text.to_s.gsub(/\s+/, " ").strip.sub(/\A[-*]\s*/, "")
    end

    KIND_LABEL = {
      "warmup" => "Warm-up",
      "google_map" => "Google map",
      "houston" => "Houston",
      "achilles" => "Achilles heel",
      "lifted" => "From your notes",
      "open" => "Open",
      "trace" => "Trace",
      "check" => "Check",
      "press" => "Press"
    }.freeze

    def markdown(grouped, warmup, through_line)
      title = group? ? "#{@passage.label} group study prep" : "#{@passage.label} personal study"
      lines = [ "# #{title}", "", (group? ? GROUP_BRIEF : PERSONAL_BRIEF).strip, "" ]
      if grouped.all? { |section| section[:observations].empty? } && through_line.empty? && @extra_notes.blank?
        who = group? ? "leader" : "you"
        lines << "_No notes yet. Have #{who} write observations first. Do not invent them._"
        lines << ""
      end
      unless through_line.empty?
        lines << (group? ? "## Leader notes (consider these)" : "## Your notes on the chapter")
        lines << ""
        through_line.each { |obs| lines << "- #{squeeze(obs[:text])}" }
        lines << ""
      end
      unless warmup.empty?
        lines << "## Warm-up"
        lines << ""
        warmup.each { |question| lines << "- **#{KIND_LABEL[question[:kind]]}.** #{question[:text]}" }
        lines << ""
      end
      lines << "## Scripture, notes, and questions"
      lines << ""
      grouped.each do |section|
        heading = "### [#{section[:label]}](#{section[:launcher_url]})"
        heading += " — #{section[:heading]}" if section[:heading].present?
        lines << heading
        lines << ""
        section[:verses].each do |verse|
          lines << "#{verse[:n]}. #{verse[:text]}"
          Array(verse[:observations]).each do |obs|
            lines << "\t- #{squeeze(obs)}"
          end
        end
        lines << ""
        if section[:questions].empty?
          lines << (group? ? "- _(no leader notes in this span yet)_" : "- _(no notes in this span yet)_")
        else
          section[:questions].each do |question|
            label = KIND_LABEL[question[:kind]] || question[:kind]
            lines << "- **#{label}.** #{question[:text]}"
          end
        end
        lines << ""
      end
      lines.join("\n").rstrip + "\n"
    end
  end
end
