import Foundation

struct NoteBlock: Codable, Equatable, Identifiable {
    var id: String
    var indent: Int
    var text: String
    var bullet: Bool

    static func fresh(text: String = "") -> NoteBlock {
        NoteBlock(id: OutlinerBlocks.newId(), indent: 0, text: text, bullet: true)
    }
}

enum OutlinerBlocks {
    static func newId() -> String {
        "b_" + UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(8).lowercased()
    }

    static func seed(_ blocks: [NoteBlock]) -> [NoteBlock] {
        blocks.isEmpty ? [NoteBlock.fresh()] : blocks
    }

    static func isEmpty(_ blocks: [NoteBlock]) -> Bool {
        blocks.allSatisfy { $0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    static func clamp(_ blocks: inout [NoteBlock]) {
        for index in blocks.indices {
            if index == 0 {
                blocks[index].indent = 0
            } else {
                blocks[index].indent = min(max(0, blocks[index].indent), blocks[index - 1].indent + 1)
            }
            blocks[index].indent = min(blocks[index].indent, 32)
        }
    }

    static func subtreeEnd(_ blocks: [NoteBlock], index: Int) -> Int {
        let base = blocks[index].indent
        var cursor = index + 1
        while cursor < blocks.count && blocks[cursor].indent > base {
            cursor += 1
        }
        return cursor
    }

    @discardableResult
    static func indent(_ blocks: inout [NoteBlock], index: Int, delta: Int) -> Bool {
        guard blocks.indices.contains(index), delta != 0 else { return false }
        if delta > 0 {
            guard index > 0, blocks[index].indent < blocks[index - 1].indent + 1 else { return false }
        } else if blocks[index].indent <= 0 {
            return false
        }
        let end = subtreeEnd(blocks, index: index)
        for cursor in index ..< end {
            blocks[cursor].indent += delta
        }
        clamp(&blocks)
        return true
    }

    static func consumeLeadingSpace(_ blocks: inout [NoteBlock], index: Int) -> Bool {
        guard blocks.indices.contains(index) else { return false }
        guard blocks[index].text.hasPrefix(" ") else { return false }
        blocks[index].text = String(blocks[index].text.drop { $0 == " " })
        return indent(&blocks, index: index, delta: 1)
    }

    @discardableResult
    static func split(_ blocks: inout [NoteBlock], index: Int, offset: Int) -> String {
        let current = blocks[index]
        let safe = min(max(0, offset), current.text.count)
        let splitIndex = current.text.index(current.text.startIndex, offsetBy: safe)
        blocks[index].text = String(current.text[..<splitIndex])
        let created = NoteBlock(
            id: newId(),
            indent: current.indent,
            text: String(current.text[splitIndex...]),
            bullet: true
        )
        blocks.insert(created, at: subtreeEnd(blocks, index: index))
        clamp(&blocks)
        return created.id
    }

    static func backspaceAtStart(_ blocks: inout [NoteBlock], index: Int) -> String {
        guard blocks.indices.contains(index) else { return blocks.first?.id ?? "" }
        if blocks[index].indent > 0 {
            indent(&blocks, index: index, delta: -1)
            return blocks[index].id
        }
        if blocks[index].bullet {
            blocks[index].bullet = false
            return blocks[index].id
        }
        guard index > 0 else { return blocks[index].id }
        let previous = index - 1
        if blocks[index].text.isEmpty {
            let end = subtreeEnd(blocks, index: index)
            if end > index + 1 {
                for cursor in (index + 1) ..< end {
                    blocks[cursor].indent = max(0, blocks[cursor].indent - 1)
                }
            }
        } else {
            blocks[previous].text += blocks[index].text
        }
        let focus = blocks[previous].id
        blocks.remove(at: index)
        if blocks.isEmpty { blocks = [NoteBlock.fresh()] }
        clamp(&blocks)
        return focus
    }
}

enum VerseNotes {
    static func covers(_ note: LibraryNote, verse: Int) -> Bool {
        guard note.kind != "chapter", let start = note.verseStart else { return false }
        let end = note.verseEnd ?? start
        return verse >= start && verse <= end
    }

    static func shouldShowTray(expanding: Bool, selected: Bool, collapsed: Bool, hasContent: Bool) -> Bool {
        if collapsed { return false }
        if selected { return true }
        if !hasContent { return false }
        return expanding
    }
}
