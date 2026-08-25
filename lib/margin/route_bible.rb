# frozen_string_literal: true

module Margin
  module RouteBible
    BASE = "https://route.bible"

    module_function

    def url_for(passage)
      p = passage.is_a?(Passage) ? passage : Passage.parse(passage)
      return BASE unless p

      "#{BASE}/#{p.slug}"
    end
  end
end
