# frozen_string_literal: true

require "test_helper"

class FeaturesTest < ActiveSupport::TestCase
  setup do
    @prior_sign_in_email_first = ENV["SIGN_IN_EMAIL_FIRST"]
    ENV.delete("SIGN_IN_EMAIL_FIRST")
  end

  teardown do
    restore_sign_in_email_first
  end

  test "email_first_sign_in is off by default" do
    refute Margin::Features.email_first_sign_in?
    refute Margin::Features.email_first_sign_in?(request_with(signin: "passkey"))
  end

  test "email_first_sign_in is on for query signin=email" do
    assert Margin::Features.email_first_sign_in?(request_with(signin: "email"))
  end

  test "email_first_sign_in is on when SIGN_IN_EMAIL_FIRST=1" do
    ENV["SIGN_IN_EMAIL_FIRST"] = "1"
    assert Margin::Features.email_first_sign_in?
    assert Margin::Features.email_first_sign_in?(request_with(signin: "passkey"))
  end

  test "email_first_sign_in ignores other SIGN_IN_EMAIL_FIRST values" do
    ENV["SIGN_IN_EMAIL_FIRST"] = "true"
    refute Margin::Features.email_first_sign_in?
  end

  private
    def request_with(params)
      Struct.new(:params).new(params.with_indifferent_access)
    end

    def restore_sign_in_email_first
      if @prior_sign_in_email_first.nil?
        ENV.delete("SIGN_IN_EMAIL_FIRST")
      else
        ENV["SIGN_IN_EMAIL_FIRST"] = @prior_sign_in_email_first
      end
    end
end
