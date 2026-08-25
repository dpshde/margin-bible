import { application } from "./application"
import OutlinerController from "./outliner_controller"
import ReaderController from "./reader_controller"
import SearchController from "./search_controller"

application.register("outliner", OutlinerController)
application.register("reader", ReaderController)
application.register("search", SearchController)
