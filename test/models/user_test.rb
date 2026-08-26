# frozen_string_literal: true

require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "email is optional and unique when present" do
    first = User.create!
    second = User.create!(email: nil)

    assert first.persisted?
    assert_nil first.email
    assert second.persisted?
    assert_nil second.email

    mailed = User.create!(email: "Reader@Example.com")
    assert_equal "reader@example.com", mailed.email

    duplicate = User.new(email: "reader@example.com")
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:email], "has already been taken"

    invalid = User.new(email: "not-an-email")
    assert_not invalid.valid?
    assert_includes invalid.errors[:email], "is invalid"
  end

  test "blank email normalizes to nil instead of a fake address" do
    user = User.create!(email: "   ")
    assert_nil user.email
    assert_equal "margin", user.webauthn_name
  end

  test "webauthn_name uses email when present" do
    user = User.create!(email: "reader@example.com")
    assert_equal "reader@example.com", user.webauthn_name
  end
end
