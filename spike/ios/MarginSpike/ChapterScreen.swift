import SwiftUI

struct ChapterScreen: View {
    @State private var address = "John 3:16"
    @State private var base = "http://127.0.0.1:8787"
    @State private var document: ChapterDocument?
    @State private var noteText = ""
    @State private var status = ""
    @State private var loading = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Workers URL", text: $base)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("John 3:16", text: $address)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit { Task { await load() } }
                    Button("Open") { Task { await load() } }
                        .disabled(loading)
                }

                if let document {
                    Section(document.passage.label) {
                        Link("Open on route.bible", destination: document.routeBibleUrl)
                        Text(status).font(.footnote).foregroundStyle(.secondary)
                        TextEditor(text: $noteText)
                            .frame(minHeight: 120)
                        Button("Save note") { Task { await save(document) } }
                    }

                    Section("Notes in this chapter") {
                        if document.notes.isEmpty {
                            Text("No notes yet")
                                .foregroundStyle(.secondary)
                        }
                        ForEach(document.notes) { note in
                            Button(note.label) {
                                address = note.slug
                                Task { await load() }
                            }
                            Text(note.text)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Section(document.chapter.label) {
                        ForEach(document.chapter.verses) { verse in
                            VStack(alignment: .leading, spacing: 6) {
                                if let heading = verse.heading {
                                    Text(heading).font(.headline)
                                }
                                Button {
                                    address = "\(document.chapter.book.lowercased()).\(document.chapter.chapter).\(verse.v)"
                                    Task { await load() }
                                } label: {
                                    Text("\(verse.v)  \(verse.text)")
                                        .foregroundStyle(.primary)
                                        .multilineTextAlignment(.leading)
                                }
                            }
                            .listRowBackground(focused(verse.v, document) ? Color.yellow.opacity(0.25) : Color.clear)
                        }
                    }
                }
            }
            .navigationTitle("Margin")
        }
    }

    private func focused(_ verse: Int, _ document: ChapterDocument) -> Bool {
        guard let start = document.passage.verseStart else { return false }
        let end = document.passage.verseEnd ?? start
        return verse >= start && verse <= end
    }

    private func client() -> MarginClient? {
        guard let url = URL(string: base) else { return nil }
        return MarginClient(baseURL: url)
    }

    private func load() async {
        guard let client = client() else {
            status = "Set a Workers URL"
            return
        }
        loading = true
        defer { loading = false }
        do {
            let loaded = try await client.chapter(address: address)
            document = loaded
            address = loaded.passage.slug
            noteText = loaded.notes.first { $0.slug == loaded.passage.slug }?.text ?? ""
            status = "Loaded \(loaded.passage.slug)"
        } catch MarginClientError.unresolvable {
            status = "Couldn’t resolve that passage"
        } catch MarginClientError.missingChapter {
            status = "That chapter is not in the BSB pack"
        } catch {
            status = "Couldn’t load the chapter"
        }
    }

    private func save(_ document: ChapterDocument) async {
        guard let client = client() else { return }
        do {
            try await client.saveNote(slug: document.passage.slug, text: noteText)
            status = noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Cleared" : "Saved"
            await load()
        } catch {
            status = "Not saved"
        }
    }
}
