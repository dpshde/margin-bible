class MagicLinkMailer < ApplicationMailer
  def sign_in(link)
    @url = magic_login_url(link.token)
    mail to: link.user.email, subject: "Sign in to Margin"
  end
end
