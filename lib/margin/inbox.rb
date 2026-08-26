# frozen_string_literal: true

module Margin
  module Inbox
    module_function

    def day_label(date, today: Date.current)
      return "Today" if date == today
      return "Yesterday" if date == today - 1

      weekday = date.strftime("%A")
      rest = "#{date.strftime("%b")} #{date.day}"
      return "#{weekday} · #{rest}, #{date.year}" if date.year != today.year

      "#{weekday} · #{rest}"
    end

    def sections(notes, today: Date.current, time_zone: Time.zone)
      list = Array(notes)
      bookmarked, rest = list.partition { |note| note.respond_to?(:bookmarked?) ? note.bookmarked? : note[:bookmarked] }
      sections = []
      if bookmarked.any?
        ordered = bookmarked.sort_by { |note| note_time(note, :updated_at) || note_time(note, :created_at) }.reverse
        sections << { date: nil, label: "Bookmarks", notes: ordered, kind: :bookmarks }
      end

      grouped = {}
      rest.sort_by { |note| note_time(note, :created_at) }.reverse_each do |note|
        day = note_time(note, :created_at).in_time_zone(time_zone).to_date
        grouped[day] ||= []
        grouped[day] << note
      end
      sections.concat(grouped.map { |date, day_notes|
        { date: date, label: day_label(date, today: today), notes: day_notes, kind: :day }
      })
    end

    def note_time(note, field)
      if note.respond_to?(field)
        note.public_send(field)
      else
        note[field]
      end
    end

    def href_options(note)
      return { chapter_note: 1 } if note.kind == "chapter"

      {}
    end
  end
end
