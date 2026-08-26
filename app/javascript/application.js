import "@hotwired/turbo-rails"
import "./controllers"
import "./lib/passkey"
import { installSignOutSnapshot } from "./lib/sign-out-snapshot"

installSignOutSnapshot()
