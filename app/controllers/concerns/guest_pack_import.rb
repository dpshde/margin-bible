# frozen_string_literal: true

module GuestPackImport
  extend ActiveSupport::Concern

  private
    def guest_pack_payload
      raw = params[:pack]
      return {} if raw.blank?

      if raw.is_a?(String)
        JSON.parse(raw)
      elsif raw.respond_to?(:to_unsafe_h)
        raw.to_unsafe_h
      else
        raw.to_h
      end
    rescue JSON::ParserError, TypeError
      {}
    end

    def import_posted_guest_pack
      current_library.import_guest_pack!(guest_pack_payload)
    end
end
