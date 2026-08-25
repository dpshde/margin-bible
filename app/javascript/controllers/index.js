import { application } from "./application"
import ReaderController from "./reader_controller"
import SearchController from "./search_controller"

application.register("reader", ReaderController)
application.register("search", SearchController)
