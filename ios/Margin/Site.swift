import Foundation

enum Site {
    static let production = URL(string: "https://web-production-0b88ca.up.railway.app")!
    static let local = URL(string: "http://localhost:3000")!

    /// Debug talks to the Rails server on this machine.
    /// Release uses `MARGIN_BASE_URL` when set, otherwise the Railway production host.
    /// Do not restore margin.bible until DNS exists.
    static var baseURL: URL {
        #if DEBUG
        return local
        #else
        if let raw = Bundle.main.object(forInfoDictionaryKey: "MARGIN_BASE_URL") as? String,
           let url = URL(string: raw), !raw.isEmpty {
            return url
        }
        return production
        #endif
    }
}
