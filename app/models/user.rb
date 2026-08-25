# frozen_string_literal: true

class User < ApplicationRecord
  has_many :libraries, dependent: :nullify
  has_many :magic_links, dependent: :destroy

  normalizes :email, with: ->(e) { e.to_s.strip.downcase }

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
end
