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
      grouped = {}
      Array(notes).sort_by { |note| note.created_at }.reverse_each do |note|
        day = note.created_at.in_time_zone(time_zone).to_date
        grouped[day] ||= []
        grouped[day] << note
      end
      grouped.map { |date, day_notes|
        { date: date, label: day_label(date, today: today), notes: day_notes }
      }
    end

    def href_options(note)
      return { chapter_note: 1 } if note.kind == "chapter"

      {}
    end
  end
end
