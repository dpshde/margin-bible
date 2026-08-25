# frozen_string_literal: true

class MagicLink < ApplicationRecord
  belongs_to :user
  belongs_to :library

  before_validation :assign_token, on: :create

  validates :token, presence: true, uniqueness: true
  validates :expires_at, presence: true

  scope :live, -> { where("expires_at > ?", Time.current) }

  def self.issue!(user:, library:, ttl: 2.hours)
    create!(user: user, library: library, expires_at: ttl.from_now)
  end

  def expired?
    expires_at <= Time.current
  end

  private
    def assign_token
      self.token ||= SecureRandom.urlsafe_base64(32)
    end
end
