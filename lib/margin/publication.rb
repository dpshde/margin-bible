# frozen_string_literal: true

module Margin
  # USFM 3.1 publication tree approximated from the flat BSB verse + heading
  # table. `\s1` is `verse.heading`; following verses are one `\p` with `\v`
  # milestones. No poetry (`\q`) until the pack carries those markers.
  module Publication
    Pericope = Struct.new(:heading, :verses, keyword_init: true)

    module_function

    def pericopes(verses)
      Array(verses).each_with_object([]) do |verse, groups|
        heading = verse.heading.to_s.presence
        if groups.empty? || heading
          groups << Pericope.new(heading: heading, verses: [ verse ])
        else
          groups.last.verses << verse
        end
      end
    end
  end
end
