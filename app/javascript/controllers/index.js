import { application } from "./application"
import ChromeController from "./chrome_controller"
import DockMenuController from "./dock_menu_controller"
import InboxController from "./inbox_controller"
import OutlinerController from "./outliner_controller"
import ReaderController from "./reader_controller"
import SearchController from "./search_controller"
import SignInController from "./sign_in_controller"
import ThemeController from "./theme_controller"
import FaceController from "./face_controller"

application.register("chrome", ChromeController)
application.register("dock-menu", DockMenuController)
application.register("inbox", InboxController)
application.register("outliner", OutlinerController)
application.register("reader", ReaderController)
application.register("search", SearchController)
application.register("sign-in", SignInController)
application.register("theme", ThemeController)
application.register("face", FaceController)
