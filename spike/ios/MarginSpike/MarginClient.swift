import Foundation

struct LibraryNote: Codable, Equatable, Identifiable {
    var slug: String
    var label: String
    var kind: String
    var text: String
    var blocks: [NoteBlock]
    var book: String
    var chapter: Int
    var verseStart: Int?
    var verseEnd: Int?
    var id: String { slug }

    var hasText: Bool { !OutlinerBlocks.isEmpty(blocks) }
}

struct ChapterDocument: Equatable {
    struct Verse: Equatable, Identifiable {
        var v: Int
        var text: String
        var heading: String?
        var id: Int { v }
    }

    var passageSlug: String
    var passageLabel: String
    var passageKind: String
    var book: String
    var chapterNumber: Int
    var chapterSlug: String
    var chapterLabel: String
    var verseStart: Int?
    var verseEnd: Int?
    var verses: [Verse]
    var notes: [LibraryNote]
    var routeBibleURL: URL
    var previousSlug: String?
    var nextSlug: String?
}

enum MarginClientError: Error, Equatable {
    case unresolvable
    case missingChapter
    case badStatus(Int)
}

struct MarginClient {
    var baseURL: URL
    var session: URLSession = .shared

    func open(address: String) async throws -> ChapterDocument {
        let slug = try await resolve(address)
        if let document = try await chapterAPI(slug) {
            return document
        }
        return try await chapterFromAssets(slug)
    }

    func library() async throws -> [LibraryNote] {
        let (data, response) = try await session.data(from: baseURL.appending(path: "api/notes"))
        try Self.validate(response)
        return try JSONDecoder().decode(NotesResponse.self, from: data).notes
    }

    func save(slug: String, blocks: [NoteBlock]) async throws -> [LibraryNote] {
        var request = URLRequest(url: baseURL.appending(path: "api/notes").appending(path: slug))
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload = blocks.map { block -> [String: Any] in
            ["id": block.id, "indent": block.indent, "text": block.text, "bullet": block.bullet]
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: ["blocks": payload])
        let (data, response) = try await session.data(for: request)
        try Self.validate(response)
        let saved = try JSONDecoder().decode(SaveResponse.self, from: data)
        return saved.chapterNotes ?? []
    }

    private func resolve(_ address: String) async throws -> String {
        let trimmed = address.trimmingCharacters(in: .whitespacesAndNewlines)
        if let parsed = PassageSlug.parse(trimmed) {
            return parsed.slug
        }
        var components = URLComponents(url: baseURL.appending(path: "jump"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "q", value: trimmed)]
        guard let url = components?.url else { throw MarginClientError.unresolvable }
        let (_, response) = try await session.data(from: url)
        if let http = response as? HTTPURLResponse, http.statusCode == 422 {
            throw MarginClientError.unresolvable
        }
        let path = response.url?.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")) ?? ""
        guard PassageSlug.parse(path) != nil else { throw MarginClientError.unresolvable }
        return path
    }

    private func chapterAPI(_ slug: String) async throws -> ChapterDocument? {
        let url = baseURL.appending(path: "api/chapters").appending(path: slug)
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else { return nil }
        if http.statusCode == 404 { return nil }
        guard (200 ..< 300).contains(http.statusCode) else {
            try Self.validate(response)
            return nil
        }
        return try? JSONDecoder().decode(ChapterAPIDocument.self, from: data).asDocument()
    }

    private func chapterFromAssets(_ slug: String) async throws -> ChapterDocument {
        guard let passage = PassageSlug.parse(slug) else { throw MarginClientError.unresolvable }
        let packURL = baseURL.appending(path: "bsb").appending(path: "\(passage.book.lowercased()).\(passage.chapter).json")
        let (packData, packResponse) = try await session.data(from: packURL)
        guard let http = packResponse as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            throw MarginClientError.missingChapter
        }
        let pack = try JSONDecoder().decode(BsbPack.self, from: packData)
        let notes = try await notes(chapter: passage.chapterSlug)
        let previous = BooksCatalog.neighbor(book: passage.book, chapter: passage.chapter, step: -1)
        let following = BooksCatalog.neighbor(book: passage.book, chapter: passage.chapter, step: 1)
        return ChapterDocument(
            passageSlug: passage.slug,
            passageLabel: passage.label,
            passageKind: passage.kind,
            book: passage.book,
            chapterNumber: passage.chapter,
            chapterSlug: passage.chapterSlug,
            chapterLabel: "\(BooksCatalog.name(passage.book)) \(passage.chapter)",
            verseStart: passage.verseStart,
            verseEnd: passage.verseEnd,
            verses: pack.verses.map { ChapterDocument.Verse(v: $0.v, text: $0.text, heading: $0.heading) },
            notes: notes,
            routeBibleURL: URL(string: "https://route.bible/\(passage.slug)")!,
            previousSlug: previous.map { "\($0.book.lowercased()).\($0.chapter)" },
            nextSlug: following.map { "\($0.book.lowercased()).\($0.chapter)" }
        )
    }

    private func notes(chapter: String) async throws -> [LibraryNote] {
        var components = URLComponents(url: baseURL.appending(path: "api/notes"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "chapter", value: chapter)]
        guard let url = components?.url else { return [] }
        let (data, response) = try await session.data(from: url)
        try Self.validate(response)
        return try JSONDecoder().decode(NotesResponse.self, from: data).notes
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

struct PassageSlug: Equatable {
    var book: String
    var chapter: Int
    var verseStart: Int?
    var verseEnd: Int?
    var kind: String
    var slug: String
    var chapterSlug: String
    var label: String

    static func parse(_ raw: String) -> PassageSlug? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let pattern = #"^([1-3]?[a-z]{2,})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$"#
        guard let match = value.range(of: pattern, options: .regularExpression) else { return nil }
        let parts = String(value[match])
        let bits = parts.split(separator: ".", omittingEmptySubsequences: false)
        guard bits.count >= 2, let chapter = Int(bits[1]) else { return nil }
        let book = bits[0].uppercased()
        guard BooksCatalog.chapterCounts[book] != nil, chapter >= 1, chapter <= BooksCatalog.chapters(book) else {
            return nil
        }
        var verseStart: Int?
        var verseEnd: Int?
        if bits.count >= 3 {
            let verseBits = bits[2].split(separator: "-", omittingEmptySubsequences: false)
            verseStart = Int(verseBits[0])
            if verseBits.count > 1 { verseEnd = Int(verseBits[1]) }
            guard let start = verseStart, start >= 1 else { return nil }
            if let end = verseEnd, end < start { return nil }
        }
        let kind = verseStart == nil ? "chapter" : (verseEnd == nil ? "verse" : "range")
        let name = BooksCatalog.name(book)
        let label: String
        if let start = verseStart, let end = verseEnd {
            label = "\(name) \(chapter):\(start)\u{2013}\(end)"
        } else if let start = verseStart {
            label = "\(name) \(chapter):\(start)"
        } else {
            label = "\(name) \(chapter)"
        }
        let slug: String
        if let start = verseStart, let end = verseEnd {
            slug = "\(book.lowercased()).\(chapter).\(start)-\(end)"
        } else if let start = verseStart {
            slug = "\(book.lowercased()).\(chapter).\(start)"
        } else {
            slug = "\(book.lowercased()).\(chapter)"
        }
        return PassageSlug(
            book: book,
            chapter: chapter,
            verseStart: verseStart,
            verseEnd: verseEnd,
            kind: kind,
            slug: slug,
            chapterSlug: "\(book.lowercased()).\(chapter)",
            label: label
        )
    }
}

private struct BsbPack: Decodable {
    struct Verse: Decodable {
        var v: Int
        var text: String
        var heading: String?
    }

    var verses: [Verse]
}

private struct NotesResponse: Decodable {
    var notes: [LibraryNote]
}

private struct SaveResponse: Decodable {
    var chapterNotes: [LibraryNote]?
}

private struct ChapterAPIDocument: Decodable {
    struct Passage: Decodable {
        var slug: String
        var label: String
        var kind: String
        var book: String
        var chapter: Int
        var verseStart: Int?
        var verseEnd: Int?
    }

    struct Verse: Decodable {
        var v: Int
        var text: String
        var heading: String?
    }

    struct Chapter: Decodable {
        var slug: String
        var label: String
        var book: String
        var chapter: Int
        var verses: [Verse]
    }

    var passage: Passage
    var chapter: Chapter
    var routeBibleUrl: URL
    var prev: String?
    var next: String?
    var notes: [LibraryNote]

    func asDocument() -> ChapterDocument {
        ChapterDocument(
            passageSlug: passage.slug,
            passageLabel: passage.label,
            passageKind: passage.kind,
            book: passage.book,
            chapterNumber: passage.chapter,
            chapterSlug: chapter.slug,
            chapterLabel: chapter.label,
            verseStart: passage.verseStart,
            verseEnd: passage.verseEnd,
            verses: chapter.verses.map { ChapterDocument.Verse(v: $0.v, text: $0.text, heading: $0.heading) },
            notes: notes,
            routeBibleURL: routeBibleUrl,
            previousSlug: prev,
            nextSlug: next
        )
    }
}
