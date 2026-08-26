import HotwireNative
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let local = Bundle.main.url(forResource: "path-configuration", withExtension: "json")!
        let remote = Site.baseURL.appendingPathComponent("configurations/ios_v1.json")
        Hotwire.loadPathConfiguration(from: [
            .file(local),
            .server(remote)
        ])
        // Bridge Components stay reserved for the header menu / share sheet.
        return true
    }
}
