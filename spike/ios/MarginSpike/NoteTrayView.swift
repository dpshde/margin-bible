import SwiftUI
import UIKit

struct NoteTrayView: View {
    var label: String
    var routeBibleURL: URL
    @Binding var blocks: [NoteBlock]
    @Binding var focusedBlockID: String?
    var onChange: () -> Void
    var onClear: () -> Void

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
                    .stroke(focusedBlockID == nil ? MarginTheme.line : MarginTheme.ink.opacity(0.28), lineWidth: 1)
            )
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
    }

    private func blockRow(_ block: NoteBlock) -> some View {
        let depth = CGFloat(block.indent)
        let alone = blocks.count == 1
        return HStack(alignment: .top, spacing: 0.4 * MarginTheme.rem) {
            Circle()
                .fill(block.bullet ? MarginTheme.faint.opacity(0.75) : MarginTheme.faint.opacity(0.28))
                .frame(width: 0.34 * MarginTheme.rem, height: 0.34 * MarginTheme.rem)
                .padding(.top, 0.58 * MarginTheme.rem)
                .onTapGesture { toggleBullet(id: block.id) }
            LineEditor(
                text: binding(for: block.id),
                isFocused: focusedBlockID == block.id,
                dismissKeyboard: focusedBlockID == nil,
                onFocus: { focusedBlockID = block.id },
                onReturn: { split(id: block.id) },
                onIndent: { delta in adjust(id: block.id, delta: delta) },
                onBullet: { toggleBullet(id: block.id) },
                onMerge: { merge(id: block.id) }
            )
            .frame(maxWidth: .infinity, minHeight: alone ? 4.4 * MarginTheme.rem : 28, alignment: .topLeading)
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
                update { blocks in
                    guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
                    blocks[index].text = newValue
                    if newValue.hasPrefix(" ") {
                        _ = OutlinerBlocks.consumeLeadingSpace(&blocks, index: index)
                    }
                }
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
        focusedBlockID = created
        onChange()
    }

    private func merge(id: String) {
        var focus = id
        update { blocks in
            guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
            focus = OutlinerBlocks.backspaceAtStart(&blocks, index: index)
        }
        focusedBlockID = focus
        onChange()
    }

    private func adjust(id: String, delta: Int) {
        update { blocks in
            guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
            OutlinerBlocks.indent(&blocks, index: index, delta: delta)
        }
        focusedBlockID = id
        onChange()
    }

    private func toggleBullet(id: String) {
        update { blocks in
            guard let index = blocks.firstIndex(where: { $0.id == id }) else { return }
            blocks[index].bullet.toggle()
        }
        focusedBlockID = id
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

struct LineEditor: UIViewRepresentable {
    @Binding var text: String
    var isFocused: Bool
    var dismissKeyboard: Bool
    var onFocus: () -> Void
    var onReturn: () -> Void
    var onIndent: (Int) -> Void
    var onBullet: () -> Void
    var onMerge: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> FocusableTextField {
        let field = FocusableTextField()
        field.delegate = context.coordinator
        field.font = UIFont(name: "Poppins-Regular", size: 16) ?? .systemFont(ofSize: 16)
        field.textColor = UIColor(red: 28 / 255, green: 25 / 255, blue: 23 / 255, alpha: 1)
        field.tintColor = field.textColor
        field.backgroundColor = .clear
        field.borderStyle = .none
        field.autocorrectionType = .yes
        field.autocapitalizationType = .sentences
        field.returnKeyType = .default
        field.addTarget(context.coordinator, action: #selector(Coordinator.changed(_:)), for: .editingChanged)
        field.inputAccessoryView = context.coordinator.accessory
        return field
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: FocusableTextField, context: Context) -> CGSize? {
        let width = proposal.width ?? UIView.noIntrinsicMetric
        return CGSize(width: width, height: max(28, uiView.intrinsicContentSize.height))
    }

    func updateUIView(_ field: FocusableTextField, context: Context) {
        context.coordinator.parent = self
        if field.text != text {
            field.text = text
        }
        field.focusIfNeeded = { [weak field] in
            guard let field else { return }
            guard context.coordinator.parent.isFocused, !field.isFirstResponder else { return }
            field.becomeFirstResponder()
        }
        if isFocused, field.window != nil, !field.isFirstResponder, !context.coordinator.focusQueued {
            context.coordinator.focusQueued = true
            DispatchQueue.main.async {
                context.coordinator.focusQueued = false
                field.focusIfNeeded?()
            }
        } else if dismissKeyboard, field.isFirstResponder {
            field.resignFirstResponder()
        }
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: LineEditor
        var focusQueued = false
        let accessory: UIToolbar

        init(_ parent: LineEditor) {
            self.parent = parent
            accessory = UIToolbar()
            super.init()
            accessory.sizeToFit()
            accessory.items = [
                item("Outdent", action: #selector(outdent)),
                item("Indent", action: #selector(indent)),
                item("Bullet", action: #selector(bullet)),
                item("New line", action: #selector(newline)),
                item("Merge", action: #selector(merge)),
            ]
        }

        func item(_ title: String, action: Selector) -> UIBarButtonItem {
            UIBarButtonItem(title: title, style: .plain, target: self, action: action)
        }

        @objc func changed(_ field: UITextField) {
            parent.text = field.text ?? ""
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            parent.onFocus()
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            parent.onReturn()
            return false
        }

        func textField(_ textField: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
            if string.isEmpty, range.location == 0, range.length == 0 {
                parent.onMerge()
                return false
            }
            return true
        }

        @objc func outdent() { parent.onIndent(-1) }
        @objc func indent() { parent.onIndent(1) }
        @objc func bullet() { parent.onBullet() }
        @objc func newline() { parent.onReturn() }
        @objc func merge() { parent.onMerge() }
    }
}

final class FocusableTextField: UITextField {
    var focusIfNeeded: (() -> Void)?

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else { return }
        focusIfNeeded?()
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: max(28, super.intrinsicContentSize.height))
    }
}
