// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import XCTest

@MainActor
final class DocumentLibraryWindowTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("doc2md-library-window-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    func testImmediateOpenDoesNotFlashPendingLabel() throws {
        let entry = try makeEntry(existing: true)
        let model = makeModel { _, completion in
            completion(.error(message: "failed"))
            return false
        }
        model.open(entry)
        RunLoop.main.run(until: Date().addingTimeInterval(0.2))
        XCTAssertFalse(model.pendingPaths.contains(entry.path))
    }

    func testFormattedTimestampUsesHumanReadableDateForStoredFractionalValue() throws {
        let entry = try makeEntry(existing: true)
        XCTAssertNotEqual(DocumentLibraryView.formattedTimestamp(entry.lastTouchedAt), entry.lastTouchedAt)
    }

    func testReturnOpensFirstFilteredEntry() throws {
        let first = try makeEntry(existing: true)
        let second = try makeEntry(existing: true, name: "Other.md")
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        try store.record(url: URL(fileURLWithPath: first.path))
        try store.record(url: URL(fileURLWithPath: second.path))
        var openedPath: String?
        let model = DocumentLibraryViewModel(store: store) { url, _ in
            openedPath = url.path
            return true
        }
        model.reload()
        model.query = "Existing"
        model.openFirstFilteredEntry()
        XCTAssertEqual(openedPath, first.path)
    }

    func testRepeatedReturnDoesNotQueueTheSameEntryTwice() throws {
        let entry = try makeEntry(existing: true)
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        try store.record(url: URL(fileURLWithPath: entry.path))
        var openCount = 0
        let model = DocumentLibraryViewModel(store: store) { _, _ in
            openCount += 1
            return true
        }
        model.reload()
        model.openFirstFilteredEntry()
        model.openFirstFilteredEntry()
        XCTAssertEqual(openCount, 1)
    }

    func testDownFocusPolicyTargetsTheFirstFilteredEntry() throws {
        let first = try makeEntry(existing: true)
        let second = try makeEntry(existing: true, name: "Other.md")
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        try store.record(url: URL(fileURLWithPath: first.path))
        try store.record(url: URL(fileURLWithPath: second.path))
        let model = DocumentLibraryViewModel(store: store) { _, _ in true }
        model.reload()
        model.query = "Existing"
        XCTAssertEqual(model.focusFirstFilteredEntry(), first.path)
    }

    func testSuccessfulOpenNotifiesWindowController() throws {
        let entry = try makeEntry(existing: true)
        var didOpen = false
        let model = DocumentLibraryViewModel(
            store: DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json")),
            openRequest: { _, completion in
                completion(.openMarkdown(ShellOpenMarkdownOk(
                    ok: true,
                    kind: "markdown",
                    path: entry.path,
                    mtimeMs: 0,
                    content: "# Test",
                    lineEnding: .lf
                )))
                return false
            },
            didOpen: { didOpen = true }
        )
        model.open(entry)
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        XCTAssertTrue(didOpen)
    }

    func testWindowOpenReloadsAndRequestsSearchFocus() throws {
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        try store.record(url: directory.appendingPathComponent("Entry.md"))
        let controller = DocumentLibraryWindowController(store: store) { _, _ in false }
        let focused = expectation(forNotification: Notification.Name("doc2mdDocumentLibraryFocusSearch"), object: nil)
        controller.show()
        wait(for: [focused], timeout: 1)
        XCTAssertEqual(controller.viewModel.entries.count, 1)
        controller.close()
    }

    func testCommandFFocusesSearchOnlyForKeyLibraryWindow() {
        XCTAssertTrue(DocumentLibraryWindow.shouldHandleFind(
            isKeyWindow: true,
            modifierFlags: .command,
            characters: "f"
        ))
        XCTAssertTrue(DocumentLibraryWindow.shouldHandleFind(
            isKeyWindow: true,
            modifierFlags: [.command, .capsLock],
            characters: "f"
        ))
        XCTAssertFalse(DocumentLibraryWindow.shouldHandleFind(
            isKeyWindow: false,
            modifierFlags: .command,
            characters: "f"
        ))
        XCTAssertFalse(DocumentLibraryWindow.shouldHandleFind(
            isKeyWindow: true,
            modifierFlags: [.command, .shift],
            characters: "f"
        ))
    }

    func testDownArrowMovesFocusIntoListOnlyFromSearchField() {
        XCTAssertTrue(DocumentLibraryWindow.shouldMoveFocusIntoList(
            isKeyWindow: true,
            firstResponderIsFieldEditor: true,
            modifierFlags: [.function, .numericPad],
            keyCode: 125
        ))
        XCTAssertTrue(DocumentLibraryWindow.shouldMoveFocusIntoList(
            isKeyWindow: true,
            firstResponderIsFieldEditor: true,
            modifierFlags: [.capsLock, .function, .numericPad],
            keyCode: 125
        ))
        XCTAssertFalse(DocumentLibraryWindow.shouldMoveFocusIntoList(
            isKeyWindow: false,
            firstResponderIsFieldEditor: true,
            modifierFlags: [],
            keyCode: 125
        ))
        XCTAssertFalse(DocumentLibraryWindow.shouldMoveFocusIntoList(
            isKeyWindow: true,
            firstResponderIsFieldEditor: false,
            modifierFlags: [],
            keyCode: 125
        ))
        XCTAssertFalse(DocumentLibraryWindow.shouldMoveFocusIntoList(
            isKeyWindow: true,
            firstResponderIsFieldEditor: true,
            modifierFlags: .command,
            keyCode: 125
        ))
        XCTAssertFalse(DocumentLibraryWindow.shouldMoveFocusIntoList(
            isKeyWindow: true,
            firstResponderIsFieldEditor: true,
            modifierFlags: [.shift, .function, .numericPad],
            keyCode: 125
        ))
        XCTAssertFalse(DocumentLibraryWindow.shouldMoveFocusIntoList(
            isKeyWindow: true,
            firstResponderIsFieldEditor: true,
            modifierFlags: [],
            keyCode: 126
        ))
    }

    func testDeferredOpenShowsPendingLabel() throws {
        let entry = try makeEntry(existing: true)
        let model = makeModel { _, _ in true }
        model.open(entry)
        XCTAssertTrue(model.pendingPaths.contains(entry.path))
    }

    func testPermissionFailureUsesShippedPermissionCopyAndPreservesRow() throws {
        let entry = try makeEntry(existing: true)
        let result = ShellCallResult.permissionNeeded(path: entry.path, message: "other")
        XCTAssertEqual(makeModel().errorMessage(for: entry, result: result), DocumentLibraryViewModel.permissionMessage)
    }

    func testMissingFailureUsesShippedMissingCopyAndPreservesRow() throws {
        let entry = try makeEntry(existing: false)
        XCTAssertEqual(
            makeModel().errorMessage(for: entry, result: .error(message: "other")),
            DocumentLibraryViewModel.missingMessage
        )
    }

    func testExistingPathGenericFailureShowsReturnedMessageNotMissingCopy() throws {
        let entry = try makeEntry(existing: true)
        XCTAssertEqual(makeModel().errorMessage(for: entry, result: .error(message: "Invalid UTF-8")), "Invalid UTF-8")
    }

    func testEmptyAndNoMatchCopyIsStateNeutral() throws {
        let model = makeModel()
        model.reload()
        XCTAssertTrue(model.entries.isEmpty)
        model.query = "nothing"
        XCTAssertTrue(model.filteredEntries.isEmpty)
    }

    func testStoreReadFailureShowsPreservationMessageNotEmptyState() throws {
        let storeURL = directory.appendingPathComponent("document-library.json")
        XCTAssertTrue(FileManager.default.createFile(atPath: storeURL.path, contents: Data("bad".utf8)))
        let model = DocumentLibraryViewModel(store: DocumentLibraryStore(storeURL: storeURL)) { _, _ in false }
        model.reload()
        XCTAssertEqual(model.readError, DocumentLibraryViewModel.readFailureMessage)
    }

    private func makeModel(
        open: @escaping (URL, @escaping (ShellCallResult) -> Void) -> Bool = { _, _ in false }
    ) -> DocumentLibraryViewModel {
        DocumentLibraryViewModel(
            store: DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json")),
            openRequest: open
        )
    }

    private func makeEntry(existing: Bool, name: String? = nil) throws -> DocumentLibraryEntry {
        let url = directory.appendingPathComponent(name ?? (existing ? "Existing.md" : "Missing.md"))
        if existing {
            XCTAssertTrue(FileManager.default.createFile(atPath: url.path, contents: Data("# Test".utf8)))
        }
        return DocumentLibraryEntry(path: url.path, displayName: url.lastPathComponent, lastTouchedAt: "2026-09-05T00:00:00.000Z")
    }
}
