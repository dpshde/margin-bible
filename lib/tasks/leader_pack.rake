# frozen_string_literal: true

namespace :margin do
  desc "Print the leader run-of-show for OSIS=heb.12 (optional LIBRARY_ID)"
  task leader_pack: :environment do
    osis = ENV.fetch("OSIS", "heb.12")
    passage = Margin::Passage.parse(osis)
    raise "Could not parse #{osis.inspect}" unless passage

    notes = if ENV["LIBRARY_ID"].present?
      Library.find(ENV["LIBRARY_ID"]).notes.where(book: passage.book, chapter: passage.chapter).order(:verse_start, :id)
    else
      []
    end
    payload = Margin::StudyPrep.build(passage: passage, notes: notes, kind: :group)
    puts payload[:markdown]
  end
end
