import SwiftUI
import UIKit

struct ChapterScreen: View {
    @State private var base = "https://margin-bible-spike.dpshade.workers.dev"
    @State private var jump = ""
    @State private var document: ChapterDocument?
    @State private var drafts: [String: [NoteBlock]] = [:]
    @State private var selection: ClosedRange<Int>?
    @State private var expanded = false
    @State private var collapsed: Set<Int> = []
    @State private var chapterOpen = false
    @State private var quiet = false
    @State private var hideNumbers = false
    @State private var gridOpen = false
    @State private var booksOpen = false
    @State private var dockOpen = false
    @State private var inbox: [LibraryNote] = []
    @State private var inboxOpen = false
    @State private var rangeAnchor: Int?
    @State private var focusedBlockID: String?
    @State private var status = ""
    @State private var saves: [String: Task<Void, Never>] = [:]

    var body: some View {
        GeometryReader { proxy in
            let metrics = MarginTheme.metrics(for: proxy.size.width)
            ZStack(alignment: .top) {
                MarginTheme.paper.ignoresSafeArea()
                VStack(spacing: 0) {
                    topBar
                    ScrollViewReader { scroll in
                        ScrollView {
                            chapterBody(metrics)
                                .frame(maxWidth: 36 * MarginTheme.rem)
                                .frame(maxWidth: .infinity)
                                .padding(.horizontal, 1.1 * MarginTheme.rem)
                                .padding(.top, 0.75 * MarginTheme.rem)
                                .padding(.bottom, focusedBlockID == nil ? (quiet ? 1.35 * MarginTheme.rem : 8 * MarginTheme.rem) : 22 * MarginTheme.rem)
                        }
                        .scrollDismissesKeyboard(.interactively)
                        .onChange(of: focusedBlockID) { _, id in
                            guard let id else { return }
                            let slug = drafts.first { $0.value.contains { $0.id == id } }?.key
                            guard let slug else { return }
                            withAnimation(.easeOut(duration: 0.2)) {
                                scroll.scrollTo(slug, anchor: .center)
                            }
                        }
                    }
                }
                if !quiet {
                    VStack {
                        Spacer()
                        chrome
                            .padding(.horizontal, 16)
                            .padding(.bottom, 18)
                    }
                }
                if gridOpen { chapterGrid }
            }
        }
        .font(MarginTheme.sans(16))
        .foregroundStyle(MarginTheme.ink)
        .sheet(isPresented: $inboxOpen) { inboxSheet }
        .task { await load("jhn.3") }
    }

    private var topBar: some View {
        HStack(spacing: 0.5 * MarginTheme.rem) {
            Button { Task { await showInbox() } } label: {
                Image(systemName: "line.3.horizontal")
                    .frame(width: 2.75 * MarginTheme.rem, height: 2.75 * MarginTheme.rem)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Notes inbox")
            Spacer(minLength: 0)
            Button {
                booksOpen = false
                gridOpen.toggle()
            } label: {
                Text(titleText)
                    .font(MarginTheme.head(1.05 * MarginTheme.rem))
                    .lineLimit(1)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 2.75 * MarginTheme.rem)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(titleText)
            Spacer(minLength: 0)
            HStack(spacing: 0.25 * MarginTheme.rem) {
                iconButton("camera.macro", "Focus", on: quiet) { quiet.toggle() }
                if !quiet {
                    iconButton("doc.on.doc", "Copy chapter notes") { copyChapter() }
                }
            }
        }
        .padding(.horizontal, MarginTheme.rem)
        .padding(.top, 0.55 * MarginTheme.rem)
        .padding(.bottom, 0.55 * MarginTheme.rem)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) { Rectangle().fill(MarginTheme.line).frame(height: 1) }
    }

    private func chapterBody(_ metrics: VerseMetrics) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let document, chapterOpen, !quiet {
                NoteTrayView(
                    label: "Chapter note · \(document.chapterLabel)",
                    routeBibleURL: routeURL(document.chapterSlug),
                    blocks: draftBinding(document.chapterSlug),
                    focusedBlockID: $focusedBlockID,
                    onChange: { scheduleSave(document.chapterSlug) },
                    onClear: { clear(document.chapterSlug) }
                )
                .id(document.chapterSlug)
                .padding(.leading, metrics.textLead)
                .padding(.bottom, 1.15 * MarginTheme.rem)
            }

            if let document {
                ForEach(Array(document.verses.enumerated()), id: \.element.id) { index, verse in
                    if let heading = verse.heading, !heading.isEmpty {
                        Text(heading)
                            .font(MarginTheme.head(1.45 * MarginTheme.rem))
                            .foregroundStyle(MarginTheme.ink)
                            .padding(.leading, metrics.gutter + metrics.gap)
                            .padding(.bottom, 0.85 * MarginTheme.rem)
                            .padding(.top, index == 0 ? 0 : 2.25 * MarginTheme.rem)
                    }
                    verseRow(verse, document: document, metrics: metrics)
                    trays(for: verse.v, document: document, metrics: metrics)
                }
                pager(document)
            } else if !status.isEmpty {
                Text(status)
                    .font(MarginTheme.sans(0.86 * MarginTheme.rem))
                    .foregroundStyle(MarginTheme.inkSoft)
                    .padding(.top, 24)
            }
        }
    }

    private func verseRow(_ verse: ChapterDocument.Verse, document: ChapterDocument, metrics: VerseMetrics) -> some View {
        let open = isOpen(verse.v)
        let spanned = inSpan(verse.v)
        let noted = hasNote(verse.v, document)
        return Button {
            tap(verse.v)
        } label: {
            HStack(alignment: .top, spacing: hideNumbers ? 0 : metrics.gap) {
                if !hideNumbers {
                    Text("\(verse.v)")
                        .font(MarginTheme.read(1.25 * MarginTheme.rem * 0.7))
                        .foregroundStyle(open || spanned ? MarginTheme.inkSoft : MarginTheme.ink.opacity(0.35))
                        .frame(width: metrics.gutter, alignment: .trailing)
                        .padding(.top, 0.42 * MarginTheme.rem)
                }
                Text(verse.text)
                    .font(MarginTheme.read(1.25 * MarginTheme.rem))
                    .foregroundStyle(MarginTheme.ink)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(1.25 * MarginTheme.rem * 0.45)
                    .padding(.horizontal, spanned || open ? 0.08 * MarginTheme.rem : 0)
                    .padding(.vertical, spanned || open ? 0.02 * MarginTheme.rem : 0)
                    .background(spanned || open ? MarginTheme.spanWash : Color.clear)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.leading, metrics.inset)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(open || spanned ? MarginTheme.railOpen : (noted ? MarginTheme.rail : Color.clear))
                .frame(width: 2)
        }
        .simultaneousGesture(LongPressGesture(minimumDuration: 0.35).onEnded { _ in
            prepare(verseSlug(verse.v, document))
            rangeAnchor = verse.v
            selection = verse.v ... verse.v
            collapsed.remove(verse.v)
        })
    }

    @ViewBuilder
    private func trays(for verse: Int, document: ChapterDocument, metrics: VerseMetrics) -> some View {
        let rows = trayRows(verse, document)
        if !rows.isEmpty {
            VStack(alignment: .leading, spacing: 0.45 * MarginTheme.rem) {
                ForEach(rows) { row in
                    tray(slug: row.slug, label: row.label)
                }
            }
            .padding(.leading, metrics.textLead)
            .padding(.bottom, 0.7 * MarginTheme.rem)
        }
    }

    private struct TrayRow: Identifiable {
        var slug: String
        var label: String
        var id: String { slug }
    }

    private func trayRows(_ verse: Int, _ document: ChapterDocument) -> [TrayRow] {
        let covering = document.notes.filter { VerseNotes.covers($0, verse: verse) }
        let open = isOpen(verse) && !collapsed.contains(verse)
        var rows: [TrayRow] = []
        var seen = Set<String>()
        func add(_ slug: String, _ label: String) {
            guard seen.insert(slug).inserted else { return }
            rows.append(TrayRow(slug: slug, label: label))
        }
        for note in covering {
            let shown = VerseNotes.shouldShowTray(
                expanding: expanded,
                selected: open,
                collapsed: collapsed.contains(verse),
                hasContent: draftHasText(note.slug, fallback: note.blocks)
            )
            if shown { add(note.slug, note.label) }
        }
        if open, selection?.lowerBound == selection?.upperBound {
            let slug = verseSlug(verse, document)
            add(slug, PassageSlug.parse(slug)?.label ?? document.chapterLabel)
        }
        if open, let start = selection?.lowerBound, let end = selection?.upperBound, start != end, verse == end {
            let slug = rangeSlug(start, end, document)
            add(slug, PassageSlug.parse(slug)?.label ?? document.passageLabel)
        }
        return rows
    }

    private func tray(slug: String, label: String) -> some View {
        NoteTrayView(
            label: label,
            routeBibleURL: routeURL(slug),
            blocks: draftBinding(slug),
            focusedBlockID: $focusedBlockID,
            onChange: { scheduleSave(slug) },
            onClear: { clear(slug) }
        )
        .id(slug)
    }

    private var chrome: some View {
        HStack(alignment: .center, spacing: 0.45 * MarginTheme.rem) {
            TextField("John 3:16", text: $jump)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(MarginTheme.sans(16))
                .padding(.horizontal, 0.8 * MarginTheme.rem)
                .frame(minHeight: 2.75 * MarginTheme.rem)
                .background(MarginTheme.paper)
                .overlay(RoundedRectangle(cornerRadius: 0.5 * MarginTheme.rem).stroke(MarginTheme.line, lineWidth: 1))
                .onSubmit { Task { await load(jump) } }
            Button { dockOpen.toggle() } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 18, weight: .medium))
                    .frame(width: 2.75 * MarginTheme.rem, height: 2.75 * MarginTheme.rem)
                    .background(MarginTheme.paperRaised)
                    .overlay(RoundedRectangle(cornerRadius: 0.5 * MarginTheme.rem).stroke(MarginTheme.line, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .foregroundStyle(dockOpen ? MarginTheme.ink : MarginTheme.inkSoft)
            .accessibilityLabel("Reader actions")
            .overlay(alignment: .bottomTrailing) {
                if dockOpen { dockPanel.offset(y: -(2.75 * MarginTheme.rem + 0.55 * MarginTheme.rem)) }
            }
        }
        .padding(0.65 * MarginTheme.rem)
        .background(MarginTheme.paperRaised, in: RoundedRectangle(cornerRadius: MarginTheme.rem))
        .overlay(RoundedRectangle(cornerRadius: MarginTheme.rem).stroke(MarginTheme.line, lineWidth: 1))
    }

    private var dockPanel: some View {
        VStack(spacing: 0) {
            dockItem("Focus", system: "camera.macro", on: quiet) { quiet.toggle() }
            dockItem("Chapter note", system: "pencil", on: chapterOpen) {
                if chapterOpen {
                    chapterOpen = false
                    focusedBlockID = nil
                } else if let slug = document?.chapterSlug {
                    focusDraft(slug)
                    chapterOpen = true
                }
            }
            dockItem("Expand notes", system: "arrow.up.left.and.arrow.down.right", on: expanded, enabled: hasAnyVerseNote) {
                expanded.toggle()
                collapsed = []
                materializeNotes()
            }
            dockItem("Hide verse numbers", system: "list.number", on: hideNumbers) { hideNumbers.toggle() }
            Divider().background(MarginTheme.line)
            TextField("Workers URL", text: $base)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(MarginTheme.sans(0.8 * MarginTheme.rem))
                .padding(.horizontal, MarginTheme.rem)
                .padding(.vertical, 0.6 * MarginTheme.rem)
        }
        .frame(width: min(18.5 * MarginTheme.rem, 320))
        .background(MarginTheme.paperRaised)
        .clipShape(RoundedRectangle(cornerRadius: 0.9 * MarginTheme.rem))
        .overlay(RoundedRectangle(cornerRadius: 0.9 * MarginTheme.rem).stroke(MarginTheme.line, lineWidth: 1))
    }

    private func dockItem(_ title: String, system: String, on: Bool, enabled: Bool = true, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 0.7 * MarginTheme.rem) {
                Image(systemName: system).frame(width: 18)
                Text(title)
                Spacer()
                if on { Image(systemName: "checkmark") }
            }
            .font(MarginTheme.sans(0.95 * MarginTheme.rem, weight: on ? .semibold : .medium))
            .foregroundStyle(enabled ? (on ? MarginTheme.ink : MarginTheme.inkSoft) : MarginTheme.inkSoft.opacity(0.35))
            .padding(.horizontal, MarginTheme.rem)
            .frame(minHeight: 2.75 * MarginTheme.rem)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    private var chapterGrid: some View {
        ZStack(alignment: .top) {
            MarginTheme.gridScrim.ignoresSafeArea().onTapGesture { gridOpen = false }
            if let document {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Button { booksOpen.toggle() } label: {
                            HStack(spacing: 6) {
                                Text(BooksCatalog.name(gridBook).uppercased())
                                    .font(MarginTheme.head(0.82 * MarginTheme.rem))
                                    .tracking(0.8)
                                Image(systemName: booksOpen ? "chevron.down" : "chevron.right")
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .foregroundStyle(MarginTheme.muted)
                        }
                        .buttonStyle(.plain)
                        .padding(.bottom, 0.75 * MarginTheme.rem)
                        if booksOpen {
                            bookGroup("Old Testament", BooksCatalog.oldTestament)
                            bookGroup("New Testament", BooksCatalog.newTestament)
                        } else {
                            chapterCells(document)
                        }
                    }
                    .padding(MarginTheme.rem)
                }
                .frame(maxWidth: 28 * MarginTheme.rem, maxHeight: 36 * MarginTheme.rem)
                .background(MarginTheme.paperRaised)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(MarginTheme.line, lineWidth: 1))
                .padding(.top, 4.2 * MarginTheme.rem)
                .padding(.horizontal, MarginTheme.rem)
            }
        }
    }

    private func bookGroup(_ title: String, _ codes: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0.4 * MarginTheme.rem) {
            Text(title.uppercased())
                .font(MarginTheme.sans(0.72 * MarginTheme.rem, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(MarginTheme.faint)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 2.75 * MarginTheme.rem), spacing: 0.4 * MarginTheme.rem)], spacing: 0.4 * MarginTheme.rem) {
                ForEach(codes, id: \.self) { code in
                    Button(code) {
                        gridBook = code
                        booksOpen = false
                    }
                    .font(MarginTheme.sans(0.8 * MarginTheme.rem, weight: .medium))
                    .frame(minHeight: 2.75 * MarginTheme.rem)
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(code == gridBook ? MarginTheme.paper : MarginTheme.ink)
                    .background(code == gridBook ? MarginTheme.ink : MarginTheme.paperRaised)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(code == gridBook ? MarginTheme.ink : MarginTheme.line, lineWidth: 1))
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.bottom, 0.85 * MarginTheme.rem)
    }

    private func chapterCells(_ document: ChapterDocument) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 2.75 * MarginTheme.rem), spacing: 0.4 * MarginTheme.rem)], spacing: 0.4 * MarginTheme.rem) {
            ForEach(1 ... max(BooksCatalog.chapters(gridBook), 1), id: \.self) { number in
                Button("\(number)") {
                    gridOpen = false
                    Task { await load("\(gridBook.lowercased()).\(number)") }
                }
                .font(MarginTheme.sans(16, weight: .regular))
                .frame(minHeight: 2.75 * MarginTheme.rem)
                .frame(maxWidth: .infinity)
                .foregroundStyle(number == document.chapterNumber && gridBook == document.book ? MarginTheme.paper : MarginTheme.ink)
                .background(number == document.chapterNumber && gridBook == document.book ? MarginTheme.ink : MarginTheme.paperRaised)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(MarginTheme.line, lineWidth: 1))
                .buttonStyle(.plain)
            }
        }
    }

    private func pager(_ document: ChapterDocument) -> some View {
        HStack {
            if let previous = document.previousSlug, let label = PassageSlug.parse(previous)?.label {
                Button("← \(label)") { Task { await load(previous) } }
                    .buttonStyle(.plain)
            }
            Spacer()
            if let next = document.nextSlug, let label = PassageSlug.parse(next)?.label {
                Button("\(label) →") { Task { await load(next) } }
                    .buttonStyle(.plain)
            }
        }
        .font(MarginTheme.sans(0.92 * MarginTheme.rem))
        .foregroundStyle(MarginTheme.muted)
        .padding(.top, 2 * MarginTheme.rem)
    }

    private var inboxSheet: some View {
        NavigationStack {
            List(inbox) { note in
                Button {
                    inboxOpen = false
                    Task { await load(note.slug) }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(note.label).font(MarginTheme.sans(16, weight: .medium))
                        Text(note.text).lineLimit(2).font(MarginTheme.sans(0.8 * MarginTheme.rem)).foregroundStyle(MarginTheme.muted)
                    }
                }
                .buttonStyle(.plain)
            }
            .navigationTitle("Notes")
        }
    }

    private var titleText: String {
        guard let document else { return "Margin" }
        guard let selection else { return document.chapterLabel }
        if selection.lowerBound == selection.upperBound {
            return PassageSlug.parse(verseSlug(selection.lowerBound, document))?.label ?? document.chapterLabel
        }
        return PassageSlug.parse(rangeSlug(selection.lowerBound, selection.upperBound, document))?.label ?? document.passageLabel
    }

    @State private var gridBook = "JHN"

    private var hasAnyVerseNote: Bool {
        document?.notes.contains { $0.kind != "chapter" && $0.hasText } ?? false
    }

    private func iconButton(_ system: String, _ label: String, on: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .frame(width: 2.75 * MarginTheme.rem, height: 2.75 * MarginTheme.rem)
                .background(on ? MarginTheme.fill : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 0.5 * MarginTheme.rem))
        }
        .buttonStyle(.plain)
        .foregroundStyle(on ? MarginTheme.ink : MarginTheme.inkSoft)
        .accessibilityLabel(label)
    }

    private func tap(_ verse: Int) {
        guard let document else { return }
        if let anchor = rangeAnchor, anchor != verse {
            let span = min(anchor, verse) ... max(anchor, verse)
            rangeAnchor = nil
            collapsed.remove(verse)
            selection = span
            focusDraft(rangeSlug(span.lowerBound, span.upperBound, document))
            return
        }
        rangeAnchor = nil
        if selection == verse ... verse {
            selection = nil
            focusedBlockID = nil
            if expanded { collapsed.insert(verse) }
            return
        }
        collapsed.remove(verse)
        selection = verse ... verse
        focusDraft(verseSlug(verse, document))
    }

    private func focusDraft(_ slug: String) {
        prepare(slug)
        focusedBlockID = drafts[slug]?.first?.id
    }

    private func prepare(_ slug: String) {
        if drafts[slug] == nil {
            let stored = document?.notes.first { $0.slug == slug }?.blocks ?? []
            drafts[slug] = OutlinerBlocks.seed(stored)
        }
    }

    private func materializeNotes() {
        guard let document else { return }
        for note in document.notes {
            prepare(note.slug)
        }
    }

    private func isOpen(_ verse: Int) -> Bool {
        guard let selection else { return false }
        if selection.lowerBound == selection.upperBound { return selection.lowerBound == verse }
        return verse == selection.upperBound
    }

    private func inSpan(_ verse: Int) -> Bool {
        guard let selection else { return false }
        return selection.contains(verse)
    }

    private func hasNote(_ verse: Int, _ document: ChapterDocument) -> Bool {
        document.notes.contains { VerseNotes.covers($0, verse: verse) && $0.hasText }
    }

    private func verseSlug(_ verse: Int, _ document: ChapterDocument) -> String {
        "\(document.book.lowercased()).\(document.chapterNumber).\(verse)"
    }

    private func rangeSlug(_ start: Int, _ end: Int, _ document: ChapterDocument) -> String {
        "\(document.book.lowercased()).\(document.chapterNumber).\(start)-\(end)"
    }

    private func routeURL(_ slug: String) -> URL {
        URL(string: "https://route.bible/\(slug)")!
    }

    private func draftHasText(_ slug: String, fallback: [NoteBlock]) -> Bool {
        OutlinerBlocks.isEmpty(drafts[slug] ?? fallback) == false
    }

    private func draftBinding(_ slug: String) -> Binding<[NoteBlock]> {
        Binding(
            get: {
                if let existing = drafts[slug] { return existing }
                let stored = document?.notes.first { $0.slug == slug }?.blocks ?? []
                if !stored.isEmpty { return stored }
                return [NoteBlock(id: "pending-\(slug)", indent: 0, text: "", bullet: true)]
            },
            set: { drafts[slug] = $0 }
        )
    }

    private func load(_ address: String) async {
        let target = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !target.isEmpty, let url = URL(string: base) else {
            status = "Set a Workers URL"
            return
        }
        do {
            let loaded = try await MarginClient(baseURL: url).open(address: target)
            document = loaded
            drafts = Dictionary(uniqueKeysWithValues: loaded.notes.map { ($0.slug, OutlinerBlocks.seed($0.blocks)) })
            if let start = loaded.verseStart {
                let end = loaded.verseEnd ?? start
                selection = start ... end
                let slug = end == start
                    ? verseSlug(start, loaded)
                    : rangeSlug(start, end, loaded)
                focusDraft(slug)
            } else {
                selection = nil
                focusedBlockID = nil
            }
            gridBook = loaded.book
            chapterOpen = false
            expanded = false
            collapsed = []
            jump = ""
            status = ""
            dockOpen = false
        } catch MarginClientError.unresolvable {
            status = "Couldn’t resolve that passage"
        } catch MarginClientError.missingChapter {
            status = "That chapter is not in the BSB pack"
        } catch {
            status = "Couldn’t load the chapter"
        }
    }

    private func scheduleSave(_ slug: String) {
        saves[slug]?.cancel()
        saves[slug] = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            if Task.isCancelled { return }
            await persist(slug)
        }
    }

    private func clear(_ slug: String) {
        let block = NoteBlock.fresh()
        drafts[slug] = [block]
        focusedBlockID = block.id
        scheduleSave(slug)
    }

    private func persist(_ slug: String) async {
        guard let url = URL(string: base), let blocks = drafts[slug], var document else { return }
        do {
            let notes = try await MarginClient(baseURL: url).save(slug: slug, blocks: blocks)
            document.notes = notes
            self.document = document
        } catch {
            status = "Not saved"
        }
    }

    private func showInbox() async {
        guard let url = URL(string: base) else { return }
        inbox = (try? await MarginClient(baseURL: url).library()) ?? []
        inboxOpen = true
    }

    private func copyChapter() {
        guard let document else { return }
        var lines = [document.chapterLabel]
        for note in document.notes where note.hasText {
            lines.append(note.label)
            for block in drafts[note.slug] ?? note.blocks {
                let pad = String(repeating: "  ", count: block.indent)
                let mark = block.bullet ? "- " : ""
                lines.append(pad + mark + block.text)
            }
        }
        UIPasteboard.general.string = lines.joined(separator: "\n")
    }
}
