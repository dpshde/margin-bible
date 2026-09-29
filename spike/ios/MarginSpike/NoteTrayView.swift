import SwiftUI
import UIKit

struct NoteTrayView: View {
    var label: String
    var routeBibleURL: URL
    @Binding var blocks: [NoteBlock]
    var onChange: () -> Void
    var onClear: () -> Void

    @FocusState private var focusedID: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(blocks) { block in
                    blockRow(block)
                }
            }
            .padding(.vertical, 0.35 * MarginTheme.rem)
            .frame(maxWidth: .infinity, minHeight: 5.5 * MarginTheme.rem, alignment: .topLeading)
            .background(MarginTheme.paperRaised)
            .overlay(
                RoundedRectangle(cornerRadius: 0.65 * MarginTheme.rem)
                    .stroke(focusedID == nil ? MarginTheme.line : MarginTheme.ink.opacity(0.28), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 0.65 * MarginTheme.rem))

            HStack(alignment: .center, spacing: 0.2 * MarginTheme.rem) {
                Link(label, destination: routeBibleURL)
                    .font(MarginTheme.sans(0.78 * MarginTheme.rem))
                    .foregroundStyle(MarginTheme.faint)
                    .lineLimit(1)
                Spacer(minLength: 8)
                trayButton("doc.on.doc", "Copy note") { copy() }
                trayButton("trash", "Clear note", action: onClear)
                trayButton("arrow.up.right.square", "Open on route.bible") {
                    UIApplication.shared.open(routeBibleURL)
                }
            }
            .padding(.top, 0.4 * MarginTheme.rem)
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Button("Outdent") { adjust(delta: -1) }
                Button("Indent") { adjust(delta: 1) }
                Button("Bullet") { toggleBullet() }
                Button("New line") { splitFocused() }
                Button("Merge") { mergeFocused() }
            }
        }
    }

    private func blockRow(_ block: NoteBlock) -> some View {
        let depth = CGFloat(block.indent)
        return HStack(alignment: .top, spacing: 0.4 * MarginTheme.rem) {
            Circle()
                .fill(block.bullet ? MarginTheme.faint.opacity(0.75) : Color.clear)
                .frame(width: 0.34 * MarginTheme.rem, height: 0.34 * MarginTheme.rem)
                .padding(.top, 0.58 * MarginTheme.rem)
                .onTapGesture { toggleBullet(id: block.id) }
            TextField("", text: binding(for: block.id), axis: .vertical)
                .font(MarginTheme.sans(16))
                .foregroundStyle(MarginTheme.ink)
                .focused($focusedID, equals: block.id)
                .onSubmit { split(id: block.id) }
        }
        .padding(.leading, 0.55 * MarginTheme.rem + depth * 1.15 * MarginTheme.rem)
        .padding(.trailing, 0.7 * MarginTheme.rem)
        .padding(.vertical, 0.05 * MarginTheme.rem)
    }

    private func trayButton(_ system: String, _ name: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 14, weight: .regular))
                .frame(width: 2.75 * MarginTheme.rem, height: 2.75 * MarginTheme.rem)
        }
        .buttonStyle(.plain)
        .foregroundStyle(MarginTheme.faint)
        .accessibilityLabel(name)
    }

    private func update(_ body: (inout [NoteBlock]) -> Void) {
        var copy = blocks
        body(&copy)
        blocks = copy
    }

    private func binding(for id: String) -> Binding<String> {
        Binding(
            get: { blocks.first { $0.id == id }?.text ?? "" },
            set: { newValue in
                var created: String?
                update { blocks in
                    guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
                    if let newline = newValue.firstIndex(of: "\n") {
                        let left = String(newValue[..<newline])
                        let right = String(newValue[newValue.index(after: newline)...])
                        blocks[index].text = left
                        let next = OutlinerBlocks.split(&blocks, index: index, offset: left.count)
                        if let createdIndex = blocks.firstIndex(where: { $0.id == next }) {
                            blocks[createdIndex].text = right
                        }
                        created = next
                        return
                    }
                    if newValue.hasPrefix(" ") {
                        _ = OutlinerBlocks.consumeLeadingSpace(&blocks, index: index)
                        return
                    }
                    blocks[index].text = newValue
                }
                if let created { focusedID = created }
                onChange()
            }
        )
    }

    private func split(id: String) {
        var created = id
        update { blocks in
            guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
            created = OutlinerBlocks.split(&blocks, index: index, offset: blocks[index].text.count)
        }
        focusedID = created
        onChange()
    }

    private func splitFocused() {
        guard let id = focusedID else { return }
        split(id: id)
    }

    private func mergeFocused() {
        guard let id = focusedID else { return }
        var focus = id
        update { blocks in
            guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
            focus = OutlinerBlocks.backspaceAtStart(&blocks, index: index)
        }
        focusedID = focus
        onChange()
    }

    private func adjust(delta: Int) {
        guard let id = focusedID else { return }
        update { blocks in
            guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
            OutlinerBlocks.indent(&blocks, index: index, delta: delta)
        }
        onChange()
    }

    private func toggleBullet(id: String? = nil) {
        let target = id ?? focusedID
        guard let target else { return }
        update { blocks in
            guard let index = blocks.firstIndex(where: { $0.id == target }) else { return }
            blocks[index].bullet.toggle()
        }
        onChange()
    }

    private func copy() {
        let lines = blocks.map { block -> String in
            let pad = String(repeating: "  ", count: block.indent)
            let mark = block.bullet ? "- " : ""
            return pad + mark + block.text
        }
        UIPasteboard.general.string = ([label] + lines).joined(separator: "\n")
    }
}
