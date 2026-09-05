# frozen_string_literal: true

namespace :margin do
  desc "Print the default leader sheet for OSIS=heb.12 (optional LIBRARY_ID)"
  task leader_pack: :environment do
    osis = ENV.fetch("OSIS", "heb.12")
    passage = Margin::Passage.parse(osis)
    raise "Could not parse #{osis.inspect}" unless passage

    notes = if ENV["LIBRARY_ID"].present?
      Library.find(ENV["LIBRARY_ID"]).notes.where(book: passage.book, chapter: passage.chapter).order(:verse_start, :id)
    elsif ENV["DEMO"].to_s != "0"
      Margin::LeaderSheetDemo.notes_for(passage)
    else
      []
    end
    payload = Margin::StudyPrep.build(passage: passage, notes: notes, kind: :group)
    puts payload[:markdown]
  end
end
