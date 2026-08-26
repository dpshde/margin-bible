# frozen_string_literal: true

class Current < ActiveSupport::CurrentAttributes
  attribute :library, :user, :webauthn_origin, :webauthn_rp_id
end
