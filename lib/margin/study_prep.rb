# frozen_string_literal: true

module Margin
  # Groups a chapter into 3–4 sections from BSB headings.
  # kind: :personal (learn for yourself) or :group (leader run-of-show).
  class StudyPrep
    TARGET_MIN = 3
    TARGET_MAX = 4
    OBVIOUS = /\b(jesus is (god|the son|lord|divine)|god is love|jesus (died|rose) for (us|our)|the gospel is)\b/i
    TENSION = /\b(warning|must|never|if |but |danger|false|afraid|hard|confus|misread|seem(s)? to mean)\b/i
    CLOUDY_MARK = /
      \b(
        what\ does\ it\ mean |
        seems?(?:\s+somewhat)? |
        out\ of\ place |
        not\ sure |
        unclear |
        unfinished |
        study\ q |
        todo |
        tbd |
        i\ don'?t\ (know|get|understand)
      )\b
    /ix
    COMMAND_MARK = /\b(let us|see to it|consider|endure|pursue|throw off|fix (our|your) eyes|strengthen|make straight|do not)\b/i
    KRUGER_LEAK = /\b(warm-?up|google map|houston|achilles(?: heel)?)\b/i

    GROUP_BRIEF = <<~TEXT.freeze
      Leader run-of-show. Say the opener out loud. Read each BSB chunk. Ask the
      questions under that chunk — they are answerable from the text in front of you.
      Paths under each question are private. Do not read them to the group. They are
      possible routes from the text, not a single landing. A clipped “your note” is
      one option when you have one — not the key. Do not read your margin notes
      aloud as the group's answers. If a verse is flagged, do not skip it. Do not
      invent observations. Leave a gap in the question; do not preach the landing.
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
      cloudy = grouped.flat_map { |section| section[:cloudy] }
      opener = group? && grouped.any? ? spoken_opener(grouped) : nil
      {
        kind: @kind.to_s,
        passage: passage_meta,
        missing_observations: missing,
        brief: (group? ? GROUP_BRIEF : PERSONAL_BRIEF).strip,
        convictions: through_line,
        opener: opener,
        cloudy: cloudy,
        warmup: [],
        sections: grouped,
        markdown: markdown(grouped, through_line, opener, cloudy)
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
      verses = group[:verses].map { |row|
        {
          n: row["v"].to_i,
          text: row["text"],
          observations: observations.select { |obs| obs[:verse] == row["v"].to_i }.map { |obs| obs[:text] }
        }
      }
      cloudy = cloudy_flags(observations)
      {
        label: start_v == end_v ? "v. #{start_v}" : "vv. #{start_v}-#{end_v}",
        start: start_v,
        end: end_v,
        heading: group[:heading],
        launcher_url: "#{RouteBible.url_for(range)}?mode=launcher",
        verses: verses,
        observations: observations,
        cloudy: cloudy,
        questions: draft_questions(observations, verses, start_v, end_v, cloudy)
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

    def cloudy_flags(observations)
      observations.filter_map { |obs|
        text = squeeze(obs[:text])
        next unless cloudy_observation?(text)

        {
          verse: obs[:verse],
          slug: obs[:slug],
          hint: clip_text(text, 90)
        }
      }.uniq { |flag| [ flag[:verse], flag[:hint] ] }
    end

    def cloudy_observation?(text)
      return false if text.blank?
      return true if text.match?(CLOUDY_MARK)
      return true if text.match?(/\?\s*\z/) && text.length <= 140
      return true if text.length < 50 && text.match?(/\((CSB|NIV|ESV|KJV|BSB|NASB|NKJV)\)/i)
      false
    end

    def spoken_opener(grouped)
      verses = grouped.first[:verses]
      return "" if verses.empty?

      first = squeeze(verses.first[:text])
      second = verses[1] && squeeze(verses[1][:text])
      if second && first.length < 180
        "#{first.sub(/\.\z/, "")}. #{second}"
      else
        first
      end
    end

    def draft_questions(observations, verses, start_v, end_v, cloudy)
      if group?
        return text_questions(verses, cloudy)
      end

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

      drafts << open_question(map_seed, label) if map_seed
      drafts << trace_question(map_seed, label) if map_seed
      drafts << check_question(tension_seed || map_seed, label) if tension_seed || map_seed
      drafts << press_question(hard_seed, label) if hard_seed

      drafts.uniq { |question| question[:text] }.first(4)
    end

    def text_questions(verses, cloudy)
      picks = pick_question_verses(verses, cloudy)
      picks.map { |verse|
        {
          kind: "ask",
          from_note: nil,
          text: question_from_bsb(verse),
          source_verse: verse[:n],
          from: "text",
          paths: paths_for(verse, verses)
        }
      }.uniq { |question| question[:text] }
    end

    def paths_for(verse, verses)
      paths = text_paths_for(verse, verses).map { |text| { kind: "text", text: text } }
      if (note = note_path_for(verse, verses))
        paths << note
      end
      paths
    end

    def text_paths_for(verse, siblings)
      text = squeeze(verse[:text])
      paths = []

      if (since = text[/\b(?:since|because)\s+([^,;]+)/i, 1])
        paths << clip_text(squeeze(since), 80)
      end

      text.split(/,?\s*and let us\s+/i).each do |part|
        next unless part.match?(/\blet us\b/i) || text.match?(/and let us/i)
        clause = squeeze(part.sub(/\A.*?let us\s+/im, "")).sub(/\Alet us\s+/i, "").sub(/\.\z/, "")
        paths << clip_text(clause, 90) if clause.length >= 8
      end

      text.scan(/\bsee to it that\s+([^.;]+)/i).each do |match|
        paths << clip_text(squeeze(match[0]), 90)
      end

      text.scan(/\bdo not\s+([^.;]+)/i).each do |match|
        paths << clip_text("do not #{squeeze(match[0])}", 90)
      end

      if paths.size < 2
        squeeze(text).split(/[.;]/).each do |clause|
          bit = strip_lead_in(clause)
          next if bit.length < 12
          next if paths.any? { |path| path.include?(bit[0, 24]) || bit.include?(path[0, 24]) }

          paths << clip_text(bit, 90)
        end
      end

      if paths.size < 2
        Array(siblings).sort_by { |other| (other[:n] - verse[:n]).abs }.each do |other|
          next if other[:n] == verse[:n]

          bit = first_clause(other[:text])
          next if bit.length < 12

          paths << "v. #{other[:n]} — #{clip_text(bit, 70)}"
          break if paths.size >= 3
        end
      end

      paths.map { |path| squeeze(path) }.reject(&:blank?).uniq.first(4)
    end

    def note_path_for(verse, verses)
      on_verse = Array(verses.find { |row| row[:n] == verse[:n] }&.fetch(:observations, nil))
      pick = on_verse.find { |text| !cloudy_observation?(squeeze(text)) } || on_verse.first
      return nil if pick.blank?

      { kind: "note", text: clip_text(pick, 90) }
    end

    def pick_question_verses(verses, cloudy)
      return [] if verses.empty?

      cloudy_ns = Array(cloudy).map { |flag| flag[:verse] }
      noted_ns = verses.select { |verse| Array(verse[:observations]).any? }.map { |verse| verse[:n] }
      ordered = verses.sort_by { |verse| -verse_weight(verse, cloudy_ns, noted_ns) }
      limit = verses.size == 1 ? 1 : 2
      ordered.first(limit)
    end

    def verse_weight(verse, cloudy_ns, noted_ns)
      text = squeeze(verse[:text])
      score = 0
      score += 100 if cloudy_ns.include?(verse[:n])
      score += 40 if noted_ns.include?(verse[:n])
      score += 20 if text.match?(/\blet us\b/i)
      score += 20 if text.match?(/\bsee to it\b/i)
      score += 12 if text.match?(COMMAND_MARK)
      score += 8 if text.match?(/\b(jesus|lord|god|father|son|cross|faith|discipline|kingdom|witnesses)\b/i)
      score -= 12 if text.length < 50
      score -= 18 if text.match?(/\A(“|Then who|And this was)/)
      score
    end

    def question_from_bsb(verse)
      n = verse[:n]
      text = squeeze(verse[:text])
      if text.match?(/\blet us\b/i)
        "What does verse #{n} tell us to do?"
      elsif text.match?(/\bsee to it\b/i)
        "What does verse #{n} tell us to see to?"
      elsif text.match?(/\bdo not\b/i)
        "What does verse #{n} tell us not to do?"
      elsif text.match?(COMMAND_MARK)
        "What does verse #{n} tell us to do, or not do?"
      elsif text.length < 60
        "What does verse #{n} say?"
      elsif text.match?(/\b(instead|but now|however|yet)\b/i)
        "What contrast does verse #{n} draw?"
      elsif text.match?(/\b(for|because|so that|therefore)\b/i)
        "What reason or result does verse #{n} give?"
      else
        clip = clip_text(first_clause(text), 70)
        if clip.length < 20
          "What does verse #{n} say?"
        else
          "According to verse #{n}, what is said about “#{clip}”?"
        end
      end
    end

    def first_clause(text)
      strip_lead_in(text.split(/[,;:]/, 2).first.to_s).sub(/\.\z/, "")
    end

    def strip_lead_in(text)
      squeeze(text).sub(/\A(therefore|furthermore|then|now|and|but|for),?\s+/i, "")
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

    def clip_text(text, limit = 110)
      clip = squeeze(text)
      clip.length > limit ? "#{clip[0, limit - 3]}…" : clip
    end

    def squeeze(text)
      text.to_s.gsub(/\s+/, " ").strip.sub(/\A[-*]\s*/, "")
    end

    KIND_LABEL = {
      "open" => "Open",
      "trace" => "Trace",
      "check" => "Check",
      "press" => "Press",
      "lifted" => "From your notes"
    }.freeze

    def markdown(grouped, through_line, opener, cloudy)
      return personal_markdown(grouped, through_line) unless group?

      group_markdown(grouped, opener, cloudy)
    end

    def group_markdown(grouped, opener, cloudy)
      lines = [ "# #{@passage.label} — what you hold", "", GROUP_BRIEF.strip, "" ]
      if opener.present?
        lines << "## Open with this"
        lines << ""
        lines << "Say this out loud:"
        lines << ""
        lines << opener
        lines << ""
      end
      unless cloudy.empty?
        lines << "## Do not skip"
        lines << ""
        lines << "Your library still has unfinished notes on these verses. Open them in the reader. Do not read those notes as the group's answers."
        lines << ""
        cloudy.each do |flag|
          verse = flag[:verse] ? "v. #{flag[:verse]}" : "chapter"
          lines << "- #{verse} — still unfinished in your notes: “#{flag[:hint]}”"
        end
        lines << ""
      end
      lines << "## Read and ask"
      lines << ""
      grouped.each do |section|
        heading = "### #{section[:label]}"
        heading += " — #{section[:heading]}" if section[:heading].present?
        lines << heading
        lines << ""
        section[:verses].each do |verse|
          lines << "#{verse[:n]}. #{verse[:text]}"
        end
        lines << ""
        if section[:questions].empty?
          lines << "- _(no verses in this span)_"
        else
          lines << "Ask:"
          lines << ""
          section[:questions].each_with_index do |question, index|
            lines << "#{index + 1}. #{question[:text]}"
            lines << ""
            lines.concat(paths_markdown(question[:paths]))
            lines << ""
          end
        end
        lines << ""
      end
      text = lines.join("\n").rstrip + "\n"
      raise "Kruger jargon leaked into the held pack" if text.match?(KRUGER_LEAK)

      text
    end

    def paths_markdown(paths)
      lines = [ "   Paths: (private — do not read these to the group)" ]
      Array(paths).each do |path|
        if path[:kind].to_s == "note"
          lines << "   - your note — one path, not the landing: “#{path[:text]}”"
        else
          lines << "   - #{path[:text]}"
        end
      end
      lines
    end

    def personal_markdown(grouped, through_line)
      title = "#{@passage.label} personal study"
      lines = [ "# #{title}", "", PERSONAL_BRIEF.strip, "" ]
      if grouped.all? { |section| section[:observations].empty? } && through_line.empty? && @extra_notes.blank?
        lines << "_No notes yet. Have you write observations first. Do not invent them._"
        lines << ""
      end
      unless through_line.empty?
        lines << "## Your notes on the chapter"
        lines << ""
        through_line.each { |obs| lines << "- #{squeeze(obs[:text])}" }
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
          lines << "- _(no notes in this span yet)_"
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
