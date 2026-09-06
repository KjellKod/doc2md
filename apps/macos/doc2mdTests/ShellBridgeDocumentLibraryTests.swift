// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import XCTest
import WebKit

@MainActor
final class ShellBridgeDocumentLibraryTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("doc2md-shell-library-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        ImportHandoff.shared.clear()
    }

    override func tearDownWithError() throws {
        ImportHandoff.shared.clear()
        try? FileManager.default.removeItem(at: directory)
    }

    func testLicensedAndGraceUserActionsRecordLibrary() throws {
        let entitlement = LicenseEntitlement(expiresAt: nil)
        for (index, state) in [LicenseState.licensed(entitlement), .grace(entitlement)].enumerated() {
            let source = try makeFile("\(index).md", "# Test")
            let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("\(index).json"))
            let bridge = ShellBridge(documentLibraryStore: store, licenseStateProvider: { state })
            XCTAssertTrue(bridge.openExternalMarkdownURL(source).ok)
            XCTAssertEqual(try store.load().map(\.path), [source.standardizedFileURL.path])
        }
    }

    func testNonRecordingStatesLeaveLibraryBytesUnchanged() throws {
        let source = try makeFile("free.md", "# Test")
        let storeURL = directory.appendingPathComponent("library.json")
        let store = DocumentLibraryStore(storeURL: storeURL)
        try store.record(url: source, now: Date(timeIntervalSince1970: 1))
        let expectedBytes = try Data(contentsOf: storeURL)
        let expectedEntry = try XCTUnwrap(store.load().first)
        let states: [LicenseState] = [
            .expiredReminder(LicenseEntitlement(expiresAt: nil)),
            .unlicensed,
            .invalid(reason: "invalid"),
            .licenseCheckFailed(reason: "failed"),
        ]
        for state in states {
            XCTAssertTrue(ShellBridge(documentLibraryStore: store, licenseStateProvider: { state }).openExternalMarkdownURL(source).ok)
        }
        XCTAssertEqual(try Data(contentsOf: storeURL), expectedBytes)
        XCTAssertEqual(try store.load(), [expectedEntry])
        XCTAssertTrue(ShellBridge(documentLibraryStore: store, licenseStateProvider: { .unlicensed }).openLibraryURL(source).ok)
    }

    func testNativeImportHandoffRecordsBeforeWebConversion() throws {
        let source = try makeFile("source.txt", "plain")
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        let bridge = ShellBridge(
            documentLibraryStore: store,
            licenseStateProvider: { .licensed(LicenseEntitlement(expiresAt: nil)) }
        )
        let result = bridge.openLibraryURL(source)
        XCTAssertTrue(result.ok)
        XCTAssertNotNil(result.importUrl)
        XCTAssertEqual(try store.load().map(\.path), [source.standardizedFileURL.path])
    }

    func testSuccessfulLibraryMarkdownReopenRetouchesExistingRow() throws {
        let source = try makeFile("repeat.md", "# Test")
        var now = Date(timeIntervalSince1970: 1)
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"), now: { now })
        let bridge = ShellBridge(
            documentLibraryStore: store,
            licenseStateProvider: { .licensed(LicenseEntitlement(expiresAt: nil)) }
        )
        XCTAssertTrue(bridge.openLibraryURL(source).ok)
        let first = try store.load()[0].lastTouchedAt
        now = Date(timeIntervalSince1970: 2)
        XCTAssertTrue(bridge.openLibraryURL(source).ok)
        XCTAssertEqual(try store.load().count, 1)
        XCTAssertNotEqual(try store.load()[0].lastTouchedAt, first)
    }

    func testFinderOpenRecordsButSessionRestoreDoesNot() async throws {
        let source = try makeFile("restore.md", "# Test")
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        let settingsURL = directory.appendingPathComponent("settings.json")
        let sessionURL = directory.appendingPathComponent("session.json")
        let persistence = PersistenceStore(settingsURL: settingsURL)
        _ = try persistence.setPersistenceEnabled(true)
        _ = try SessionStore(sessionURL: sessionURL).write(openPaths: [source.path], selectedPath: source.path)
        let bridge = ShellBridge(
            persistenceStore: persistence,
            sessionStore: SessionStore(sessionURL: sessionURL),
            documentLibraryStore: store,
            licenseStateProvider: { .licensed(LicenseEntitlement(expiresAt: nil)) }
        )
        let webView = DocumentLibraryCapturingWebView()
        bridge.webView = webView

        await sendOpen(bridge: bridge, webView: webView, path: source.path, id: "restore")
        XCTAssertTrue(try store.load().isEmpty)
        await sendOpen(bridge: bridge, webView: webView, path: source.path, id: "recent")
        XCTAssertEqual(try store.load().map(\.path), [source.path])
    }

    func testFailedSessionRestoreThenRecentReopenRecordsWhenLicensed() async throws {
        let source = try makeFile("failed-restore.md", "# Test")
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        let settingsURL = directory.appendingPathComponent("settings.json")
        let sessionURL = directory.appendingPathComponent("session.json")
        let persistence = PersistenceStore(settingsURL: settingsURL)
        _ = try persistence.setPersistenceEnabled(true)
        _ = try SessionStore(sessionURL: sessionURL).write(openPaths: [source.path], selectedPath: source.path)
        let bridge = ShellBridge(
            persistenceStore: persistence,
            sessionStore: SessionStore(sessionURL: sessionURL),
            documentLibraryStore: store,
            licenseStateProvider: { .licensed(LicenseEntitlement(expiresAt: nil)) }
        )
        let webView = DocumentLibraryCapturingWebView()
        bridge.webView = webView
        try FileManager.default.removeItem(at: source)

        await sendMessage(bridge: bridge, webView: webView, name: "doc2mdOpenFile", id: "failed-restore", args: ["path": source.path])
        XCTAssertTrue(try store.load().isEmpty)
        try Data("# restored".utf8).write(to: source)
        await sendMessage(bridge: bridge, webView: webView, name: "doc2mdOpenFile", id: "recent-reopen", args: ["path": source.path])
        XCTAssertEqual(try store.load().map(\.path), [source.path])
    }

    func testReloadFromDiskAndConflictReloadRetouchWhenLicensed() async throws {
        let source = try makeFile("reload.md", "# Test")
        var now = Date(timeIntervalSince1970: 1)
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"), now: { now })
        let persistence = PersistenceStore(settingsURL: directory.appendingPathComponent("settings.json"))
        _ = try persistence.setPersistenceEnabled(true)
        _ = try persistence.recordRecentDocument(url: source)
        let bridge = ShellBridge(
            persistenceStore: persistence,
            documentLibraryStore: store,
            licenseStateProvider: { .licensed(LicenseEntitlement(expiresAt: nil)) }
        )
        let webView = DocumentLibraryCapturingWebView()
        bridge.webView = webView

        await sendMessage(bridge: bridge, webView: webView, name: "doc2mdOpenFile", id: "reload", args: ["path": source.path])
        let first = try XCTUnwrap(store.load().first).lastTouchedAt
        now = Date(timeIntervalSince1970: 2)
        await sendMessage(bridge: bridge, webView: webView, name: "doc2mdOpenFile", id: "conflict-reload", args: ["path": source.path])
        XCTAssertEqual(try store.load().count, 1)
        XCTAssertNotEqual(try XCTUnwrap(store.load().first).lastTouchedAt, first)
    }

    func testListingSearchingAndActivationDoNotSeedSessionState() throws {
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        let source = try makeFile("browse.md", "# Test")
        let sessionURL = directory.appendingPathComponent("session.json")
        let persistence = PersistenceStore(settingsURL: directory.appendingPathComponent("settings.json"))
        _ = try persistence.setPersistenceEnabled(true)
        try store.record(url: source)
        let bridge = ShellBridge(
            persistenceStore: persistence,
            sessionStore: SessionStore(sessionURL: sessionURL),
            documentLibraryStore: store,
            licenseStateProvider: { .licensed(LicenseEntitlement(expiresAt: nil)) }
        )
        XCTAssertEqual(try store.search(store.load(), query: "browse").map(\.path), [source.path])
        XCTAssertTrue(bridge.openLibraryURL(source).ok)
        XCTAssertEqual(try SessionStore(sessionURL: sessionURL).loadAndPrune(), DesktopSessionState(openPaths: [], selectedPath: nil))
    }

    func testSuccessfulMarkdownSaveRecordsOnlyWhenAllowed() async throws {
        let source = try makeFile("save.md", "# before")
        let store = DocumentLibraryStore(storeURL: directory.appendingPathComponent("library.json"))
        var state: LicenseState = .unlicensed
        let bridge = ShellBridge(
            documentLibraryStore: store,
            licenseStateProvider: { state }
        )
        XCTAssertTrue(bridge.openExternalMarkdownURL(source).ok)
        let webView = DocumentLibraryCapturingWebView()
        bridge.webView = webView
        let expectedMtimeMs = try FileStore().modificationTimeMs(for: source)

        state = .licensed(LicenseEntitlement(expiresAt: nil))
        await sendMessage(
            bridge: bridge,
            webView: webView,
            name: "doc2mdSaveFile",
            id: "licensed-save",
            args: ["path": source.path, "content": "# after", "expectedMtimeMs": expectedMtimeMs, "lineEnding": "lf"]
        )
        XCTAssertEqual(try store.load().map(\.path), [source.path])

        let retainedBytes = try Data(contentsOf: directory.appendingPathComponent("library.json"))
        state = .expiredReminder(LicenseEntitlement(expiresAt: nil))
        let secondMtimeMs = try FileStore().modificationTimeMs(for: source)
        let expiredSaveScript = await sendMessage(
            bridge: bridge,
            webView: webView,
            name: "doc2mdSaveFile",
            id: "expired-save",
            args: ["path": source.path, "content": "# later", "expectedMtimeMs": secondMtimeMs, "lineEnding": "lf"]
        )
        XCTAssertTrue(expiredSaveScript.contains("\"ok\":true"))
        XCTAssertEqual(try Data(contentsOf: directory.appendingPathComponent("library.json")), retainedBytes)
    }

    func testLiveLicenseProviderRecordsOnlyWhileLicensed() throws {
        let source = try makeFile("host.md", "# Test")
        let entitlement = LicenseEntitlement(expiresAt: nil)
        var state: LicenseState = .licensed(entitlement)
        let licensedStore = DocumentLibraryStore(storeURL: directory.appendingPathComponent("licensed.json"))
        let bridge = ShellBridge(documentLibraryStore: licensedStore, licenseStateProvider: { state })
        XCTAssertTrue(bridge.openExternalMarkdownURL(source).ok)
        XCTAssertEqual(try licensedStore.load().count, 1)

        state = .expiredReminder(entitlement)
        XCTAssertTrue(bridge.openExternalMarkdownURL(source).ok)
        XCTAssertEqual(try licensedStore.load().count, 1)
    }

    private func sendOpen(
        bridge: ShellBridge,
        webView: DocumentLibraryCapturingWebView,
        path: String,
        id: String
    ) async {
        _ = await sendMessage(bridge: bridge, webView: webView, name: "doc2mdOpenFile", id: id, args: ["path": path])
    }

    @discardableResult
    private func sendMessage(
        bridge: ShellBridge,
        webView: DocumentLibraryCapturingWebView,
        name: String,
        id: String,
        args: [String: Any]
    ) async -> String {
        let completed = expectation(description: "message \(id)")
        var evaluatedScript = ""
        webView.onEvaluateJavaScript = { script in
            evaluatedScript = script
            completed.fulfill()
        }
        bridge.userContentController(
            WKUserContentController(),
            didReceive: DocumentLibraryStubScriptMessage(
                name: name,
                body: ["id": id, "args": args]
            )
        )
        await fulfillment(of: [completed], timeout: 1)
        return evaluatedScript
    }

    private func makeFile(_ name: String, _ contents: String) throws -> URL {
        let url = directory.appendingPathComponent(name)
        try Data(contents.utf8).write(to: url)
        return url
    }
}

private final class DocumentLibraryCapturingWebView: WKWebView {
    var onEvaluateJavaScript: ((String) -> Void)?

    override func evaluateJavaScript(
        _ javaScriptString: String,
        completionHandler: (@MainActor @Sendable (Any?, (any Error)?) -> Void)? = nil
    ) {
        onEvaluateJavaScript?(javaScriptString)
        completionHandler?(nil, nil)
    }
}

private final class DocumentLibraryStubScriptMessage: WKScriptMessage {
    private let stubName: String
    private let stubBody: Any

    override var name: String { stubName }
    override var body: Any { stubBody }

    init(name: String, body: Any) {
        stubName = name
        stubBody = body
        super.init()
    }
}
