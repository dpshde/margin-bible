import Foundation

struct ChapterDocument: Decodable, Equatable {
    struct Passage: Decodable, Equatable {
        let slug: String
        let osis: String
        let label: String
        let kind: String
        let book: String
        let chapter: Int
        let verseStart: Int?
        let verseEnd: Int?
    }

    struct Verse: Decodable, Equatable, Identifiable {
        let v: Int
        let text: String
        let heading: String?
        var id: Int { v }
    }

    struct Chapter: Decodable, Equatable {
        let slug: String
        let label: String
        let translation: String
        let book: String
        let chapter: Int
        let verses: [Verse]
    }

    struct Note: Decodable, Equatable, Identifiable {
        let slug: String
        let label: String
        let kind: String
        let text: String
        var id: String { slug }
    }

    let passage: Passage
    let chapter: Chapter
    let routeBibleUrl: URL
    let prev: String?
    let next: String?
    let notes: [Note]
}

enum MarginClientError: Error, Equatable {
    case unresolvable
    case missingChapter
    case badStatus(Int)
}

struct MarginClient {
    var baseURL: URL
    var session: URLSession = .shared

    func chapter(address: String) async throws -> ChapterDocument {
        let (data, response) = try await session.data(from: chapterURL(address: address))
        try Self.validate(response)
        return try JSONDecoder().decode(ChapterDocument.self, from: data)
    }

    func saveNote(slug: String, text: String) async throws {
        var request = URLRequest(url: baseURL.appending(path: "api/notes").appending(path: slug))
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["text": text])
        let (_, response) = try await session.data(for: request)
        try Self.validate(response)
    }

    func chapterURL(address: String) -> URL {
        let root = baseURL.appending(path: "api/chapters")
        let trimmed = address.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.contains(" ") || trimmed.contains(":") {
            var components = URLComponents(url: root, resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "q", value: trimmed)]
            return components?.url ?? root
        }
        return root.appending(path: trimmed)
    }

    private static func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        if http.statusCode == 422 { throw MarginClientError.unresolvable }
        if http.statusCode == 404 { throw MarginClientError.missingChapter }
        guard (200 ..< 300).contains(http.statusCode) else {
            throw MarginClientError.badStatus(http.statusCode)
        }
    }
}
