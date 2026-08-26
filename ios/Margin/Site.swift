import Foundation

enum Site {
    static let production = URL(string: "https://margin.bible")!
    static let local = URL(string: "http://localhost:3000")!

    /// Debug talks to the Rails server on this machine.
    /// Release uses `MARGIN_BASE_URL` when set, otherwise margin.bible.
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
