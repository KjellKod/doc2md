// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import AppKit
import SwiftUI

private let documentLibraryFocusSearch = Notification.Name("doc2mdDocumentLibraryFocusSearch")
private let documentLibraryFocusFirstRow = Notification.Name("doc2mdDocumentLibraryFocusFirstRow")

@MainActor
final class DocumentLibraryViewModel: ObservableObject {
    static let readFailureMessage = "Your library could not be read. Your history is still on disk; reopening a document will not overwrite it."
    static let permissionMessage = "Permission is needed to access this file. Open or save it again."
    static let missingMessage = "The file no longer exists."

    @Published private(set) var entries: [DocumentLibraryEntry] = []
    @Published var query = ""
    @Published private(set) var readError: String?
    @Published private(set) var pendingPaths: Set<String> = []
    @Published private(set) var errorsByPath: [String: String] = [:]

    private let store: DocumentLibraryStore
    private let fileManager: FileManager
    private let openRequest: (URL, @escaping (ShellCallResult) -> Void) -> Bool
    private let didOpen: () -> Void
    private var pendingWorkItems: [String: DispatchWorkItem] = [:]
    private var inFlightPaths: Set<String> = []

    init(
        store: DocumentLibraryStore,
        fileManager: FileManager = .default,
        openRequest: @escaping (URL, @escaping (ShellCallResult) -> Void) -> Bool,
        didOpen: @escaping () -> Void = {}
    ) {
        self.store = store
        self.fileManager = fileManager
        self.openRequest = openRequest
        self.didOpen = didOpen
    }

    var filteredEntries: [DocumentLibraryEntry] {
        store.search(entries, query: query)
    }

    func reload() {
        do {
            entries = try store.load()
            readError = nil
        } catch {
            entries = []
            readError = Self.readFailureMessage
        }
    }

    func open(_ entry: DocumentLibraryEntry) {
        guard inFlightPaths.insert(entry.path).inserted else { return }
        pendingWorkItems[entry.path]?.cancel()
        errorsByPath[entry.path] = nil

        let deferred = openRequest(URL(fileURLWithPath: entry.path)) { [weak self] result in
            DispatchQueue.main.async {
                self?.finishOpen(entry: entry, result: result)
            }
        }

        if deferred {
            pendingPaths.insert(entry.path)
        } else {
            let workItem = DispatchWorkItem { [weak self] in
                self?.pendingPaths.insert(entry.path)
            }
            pendingWorkItems[entry.path] = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: workItem)
        }
    }

    func openFirstFilteredEntry() {
        guard let entry = filteredEntries.first else { return }
        open(entry)
    }

    func focusFirstFilteredEntry() -> String? {
        filteredEntries.first?.path
    }

    func errorMessage(for entry: DocumentLibraryEntry, result: ShellCallResult) -> String {
        if result.code == "permission-needed" {
            return Self.permissionMessage
        }
        if !fileManager.fileExists(atPath: entry.path) {
            return Self.missingMessage
        }
        return result.message ?? "The document could not be opened."
    }

    private func finishOpen(entry: DocumentLibraryEntry, result: ShellCallResult) {
        inFlightPaths.remove(entry.path)
        pendingWorkItems.removeValue(forKey: entry.path)?.cancel()
        pendingPaths.remove(entry.path)
        if result.ok {
            errorsByPath[entry.path] = nil
            reload()
            didOpen()
        } else {
            errorsByPath[entry.path] = errorMessage(for: entry, result: result)
        }
    }
}

final class DocumentLibraryWindow: NSWindow {
    var focusSearch: (() -> Void)?
    var focusFirstRow: (() -> Void)?

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if Self.shouldHandleFind(
            isKeyWindow: isKeyWindow,
            modifierFlags: event.modifierFlags,
            characters: event.charactersIgnoringModifiers
        ) {
            focusSearch?()
            return true
        }

        if Self.shouldMoveFocusIntoList(
            isKeyWindow: isKeyWindow,
            firstResponderIsFieldEditor: firstResponder is NSTextView,
            modifierFlags: event.modifierFlags,
            keyCode: event.keyCode
        ) {
            focusFirstRow?()
            return true
        }

        return super.performKeyEquivalent(with: event)
    }

    static func shouldHandleFind(
        isKeyWindow: Bool,
        modifierFlags: NSEvent.ModifierFlags,
        characters: String?
    ) -> Bool {
        let userModifiers = modifierFlags
            .intersection(.deviceIndependentFlagsMask)
            .subtracting(.capsLock)
        return isKeyWindow
            && userModifiers == .command
            && characters?.lowercased() == "f"
    }

    static func shouldMoveFocusIntoList(
        isKeyWindow: Bool,
        firstResponderIsFieldEditor: Bool,
        modifierFlags: NSEvent.ModifierFlags,
        keyCode: UInt16
    ) -> Bool {
        // Arrow keys always carry .function and normally .numericPad; .capsLock is ambient, not user-held.
        let userModifiers = modifierFlags
            .intersection(.deviceIndependentFlagsMask)
            .subtracting([.capsLock, .function, .numericPad])
        return isKeyWindow
            && firstResponderIsFieldEditor
            && userModifiers.isEmpty
            && keyCode == 125
    }
}

@MainActor
final class DocumentLibraryWindowController: NSWindowController {
    let viewModel: DocumentLibraryViewModel

    init(
        store: DocumentLibraryStore,
        openRequest: @escaping (URL, @escaping (ShellCallResult) -> Void) -> Bool
    ) {
        let window = DocumentLibraryWindow(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 520),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        viewModel = DocumentLibraryViewModel(
            store: store,
            openRequest: openRequest,
            didOpen: { [weak window] in window?.orderOut(nil) }
        )
        window.title = "Document Library"
        window.minSize = NSSize(width: 560, height: 360)
        window.center()
        window.contentView = NSHostingView(rootView: DocumentLibraryView(viewModel: viewModel))
        super.init(window: window)
        window.focusSearch = { [weak window] in
            guard window?.isKeyWindow == true else { return }
            NotificationCenter.default.post(name: documentLibraryFocusSearch, object: nil)
        }
        window.focusFirstRow = { [weak window] in
            guard window?.isKeyWindow == true, window?.firstResponder is NSTextView else { return }
            NotificationCenter.default.post(name: documentLibraryFocusFirstRow, object: nil)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func show() {
        viewModel.reload()
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: documentLibraryFocusSearch, object: nil)
        }
    }
}

struct DocumentLibraryView: View {
    private static let timestampFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    @ObservedObject var viewModel: DocumentLibraryViewModel
    @FocusState private var searchFocused: Bool
    @FocusState private var focusedEntryPath: String?

    var body: some View {
        VStack(spacing: 0) {
            TextField("Search documents", text: $viewModel.query)
                .textFieldStyle(.roundedBorder)
                .focused($searchFocused)
                .onSubmit { viewModel.openFirstFilteredEntry() }
                .onMoveCommand { direction in
                    if direction == .down {
                        focusedEntryPath = viewModel.focusFirstFilteredEntry()
                    }
                }
                .accessibilityLabel("Search document library")
                .padding(16)

            Divider()

            if let readError = viewModel.readError {
                stateMessage(readError)
            } else if viewModel.entries.isEmpty {
                stateMessage("Your library is empty. Documents you open or convert will appear here.")
            } else if viewModel.filteredEntries.isEmpty {
                stateMessage("No documents match your search.")
            } else {
                List(viewModel.filteredEntries) { entry in
                    row(entry)
                }
                .listStyle(.inset)
            }
        }
        .frame(minWidth: 560, minHeight: 360)
        .onReceive(NotificationCenter.default.publisher(for: documentLibraryFocusSearch)) { _ in
            searchFocused = true
        }
        .onReceive(NotificationCenter.default.publisher(for: documentLibraryFocusFirstRow)) { _ in
            focusedEntryPath = viewModel.focusFirstFilteredEntry()
        }
    }

    private func row(_ entry: DocumentLibraryEntry) -> some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.displayName)
                    .font(.body.weight(.semibold))
                    .lineLimit(1)
                Text(entry.path)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                HStack(spacing: 8) {
                    Text(Self.formattedTimestamp(entry.lastTouchedAt))
                    if let error = viewModel.errorsByPath[entry.path] {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 16)
            let isPending = viewModel.pendingPaths.contains(entry.path)
            let hasError = viewModel.errorsByPath[entry.path] != nil
            let actionLabel = isPending ? "Opening" : hasError ? "Retry" : "Open"
            Button(isPending ? "Opening..." : actionLabel) {
                viewModel.open(entry)
            }
            .disabled(isPending)
            .focused($focusedEntryPath, equals: entry.path)
            .accessibilityLabel("\(actionLabel) \(entry.displayName)")
            .accessibilityAddTraits(isPending ? .updatesFrequently : [])
            .frame(minWidth: 64, minHeight: 32)
        }
        .padding(.vertical, 8)
    }

    private func stateMessage(_ message: String) -> some View {
        Text(message)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: 440)
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    static func formattedTimestamp(_ value: String) -> String {
        guard let date = timestampFormatter.date(from: value) else { return value }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
