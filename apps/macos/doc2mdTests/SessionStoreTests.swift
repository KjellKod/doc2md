import Foundation
import WebKit
import XCTest

final class SessionStoreTests: XCTestCase {
    private var tempDirectories: [URL] = []

    override func tearDownWithError() throws {
        for url in tempDirectories {
            try? FileManager.default.removeItem(at: url)
        }
        tempDirectories = []
        try super.tearDownWithError()
    }

    func testWriteStoresOnlyExistingMarkdownPathsAndSelectedPath() throws {
        let sessionURL = try makeSessionURL()
        let store = SessionStore(sessionURL: sessionURL)
        let first = try makeFile(name: "first.md")
        let second = try makeFile(name: "second.markdown")
        _ = try makeFile(name: "notes.txt")

        let state = try store.write(
            openPaths: [
                first.path,
                second.path,
                first.path,
                sessionURL.deletingLastPathComponent().appendingPathComponent("notes.txt").path,
                "/tmp/missing.md"
            ],
            selectedPath: second.path
        )

        XCTAssertEqual(state.openPaths, [first.path, second.path])
        XCTAssertEqual(state.selectedPath, second.path)

        let rawJSON = try XCTUnwrap(String(data: Data(contentsOf: sessionURL), encoding: .utf8))
        XCTAssertTrue(rawJSON.contains("first.md"))
        XCTAssertTrue(rawJSON.contains("second.markdown"))
        XCTAssertFalse(rawJSON.contains("notes.txt"))
        XCTAssertFalse(rawJSON.contains("content"))
        XCTAssertFalse(rawJSON.contains("markdown\":\""))
    }

    func testLoadPrunesMissingFilesAndPersistsPrunedState() throws {
        let sessionURL = try makeSessionURL()
        let existing = try makeFile(name: "existing.md")
        let missing = sessionURL.deletingLastPathComponent().appendingPathComponent("missing.md")
        try writeRawSession(
            url: sessionURL,
            openPaths: [existing.path, missing.path],
            selectedPath: missing.path
        )
        let store = SessionStore(sessionURL: sessionURL)

        let state = try store.loadAndPrune()

        XCTAssertEqual(state.openPaths, [existing.path])
        XCTAssertNil(state.selectedPath)

        let reloaded = try JSONDecoder().decode(
            DesktopSessionState.self,
            from: Data(contentsOf: sessionURL)
        )
        XCTAssertEqual(reloaded, state)
    }

    func testWriteTrustedDoesNotPersistArbitraryWebViewSubmittedPath() throws {
        let sessionURL = try makeSessionURL()
        let trusted = try makeFile(name: "trusted.md")
        let arbitrary = try makeFile(name: "arbitrary.md")
        let store = SessionStore(sessionURL: sessionURL)

        let state = try store.writeTrusted(
            openPaths: [trusted.path, arbitrary.path],
            selectedPath: arbitrary.path,
            trustedPaths: [trusted.path]
        )

        XCTAssertEqual(state.openPaths, [trusted.path])
        XCTAssertNil(state.selectedPath)

        let reloaded = try SessionStore(sessionURL: sessionURL).loadAndPrune()
        XCTAssertEqual(reloaded.openPaths, [trusted.path])
        XCTAssertNil(reloaded.selectedPath)
        XCTAssertFalse(reloaded.openPaths.contains(arbitrary.path))
    }

    func testTrustedRestoreCandidateCanBePersistedAcrossRelaunch() throws {
        let sessionURL = try makeSessionURL()
        let restored = try makeFile(name: "restored.md")
        let store = SessionStore(sessionURL: sessionURL)

        _ = try store.write(openPaths: [restored.path], selectedPath: restored.path)
        let loaded = try SessionStore(sessionURL: sessionURL).loadAndPrune()
        let updated = try SessionStore(sessionURL: sessionURL).writeTrusted(
            openPaths: loaded.openPaths,
            selectedPath: loaded.selectedPath,
            trustedPaths: Set(loaded.openPaths)
        )

        XCTAssertEqual(updated.openPaths, [restored.path])
        XCTAssertEqual(updated.selectedPath, restored.path)
    }

    func testClearRemovesSessionFile() throws {
        let sessionURL = try makeSessionURL()
        try writeRawSession(url: sessionURL, openPaths: [], selectedPath: nil)
        let store = SessionStore(sessionURL: sessionURL)

        try store.clear()

        XCTAssertFalse(FileManager.default.fileExists(atPath: sessionURL.path))
    }

    private func makeSessionURL() throws -> URL {
        let directory = try makeDirectory()
        return directory.appendingPathComponent("session.json")
    }

    private func makeFile(name: String) throws -> URL {
        let directory = try makeDirectory()
        let fileURL = directory.appendingPathComponent(name)
        try Data("# test\n".utf8).write(to: fileURL)
        return fileURL
    }

    private func makeDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("doc2md-session-store-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        tempDirectories.append(directory)
        return directory
    }

    private func writeRawSession(
        url: URL,
        openPaths: [String],
        selectedPath: String?
    ) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder().encode(
            DesktopSessionState(openPaths: openPaths, selectedPath: selectedPath)
        )
        try data.write(to: url)
    }
}

@MainActor
final class ShellBridgeSessionTrustTests: XCTestCase {
    private var tempDirectories: [URL] = []

    override func tearDownWithError() throws {
        for url in tempDirectories {
            try? FileManager.default.removeItem(at: url)
        }
        tempDirectories = []
        try super.tearDownWithError()
    }

    func testSetSessionStateDoesNotAuthorizeArbitraryPathOpen() async throws {
        let harness = try makeHarness()
        let arbitrary = try makeFile(name: "arbitrary.md")

        let syncResult = try await sendMessage(
            harness: harness,
            name: "doc2mdSetSessionState",
            id: "sync-arbitrary",
            args: [
                "openPaths": [arbitrary.path],
                "selectedPath": arbitrary.path
            ]
        )

        XCTAssertEqual(syncResult.openPaths, [])
        XCTAssertNil(syncResult.selectedPath)

        let openResult = try await sendMessage(
            harness: harness,
            name: "doc2mdOpenFile",
            id: "open-arbitrary",
            args: ["path": arbitrary.path]
        )

        XCTAssertFalse(openResult.ok)
        XCTAssertEqual(openResult.code, "permission-needed")
        XCTAssertEqual(openResult.path, arbitrary.path)
        XCTAssertNil(openResult.content)
    }

    func testRelaunchSessionLoadTrustsPrunedSessionPathOnly() async throws {
        let trusted = try makeFile(name: "restored.md", content: "# trusted\n")
        let arbitrary = try makeFile(name: "webview.md", content: "# arbitrary\n")
        let harness = try makeHarness(seedSession: DesktopSessionState(
            openPaths: [trusted.path],
            selectedPath: trusted.path
        ))

        let syncResult = try await sendMessage(
            harness: harness,
            name: "doc2mdSetSessionState",
            id: "sync-relaunch",
            args: [
                "openPaths": [trusted.path, arbitrary.path],
                "selectedPath": arbitrary.path
            ]
        )

        XCTAssertEqual(syncResult.openPaths, [trusted.path])
        XCTAssertNil(syncResult.selectedPath)

        let arbitraryOpen = try await sendMessage(
            harness: harness,
            name: "doc2mdOpenFile",
            id: "open-webview",
            args: ["path": arbitrary.path]
        )

        XCTAssertFalse(arbitraryOpen.ok)
        XCTAssertEqual(arbitraryOpen.code, "permission-needed")
        XCTAssertEqual(arbitraryOpen.path, arbitrary.path)
        XCTAssertNil(arbitraryOpen.content)

        let trustedOpen = try await sendMessage(
            harness: harness,
            name: "doc2mdOpenFile",
            id: "open-restored",
            args: ["path": trusted.path]
        )

        XCTAssertTrue(trustedOpen.ok)
        XCTAssertEqual(trustedOpen.kind, "markdown")
        XCTAssertEqual(trustedOpen.path, trusted.path)
        XCTAssertEqual(trustedOpen.content, "# trusted\n")
    }

    func testNativeRecentSupportedImportSourceCanReopenWithoutSessionPersistence() async throws {
        let recentImport = try makeFile(name: "recent.docx", content: "fake docx payload")
        let harness = try makeHarness(seedRecentURLs: [recentImport])

        let openResult = try await sendMessage(
            harness: harness,
            name: "doc2mdOpenFile",
            id: "open-native-recent-import",
            args: ["path": recentImport.path]
        )

        XCTAssertTrue(openResult.ok)
        XCTAssertEqual(openResult.kind, "import-source")
        XCTAssertEqual(openResult.path, recentImport.path)
        XCTAssertEqual(openResult.name, "recent.docx")
        XCTAssertEqual(openResult.format, "docx")
        XCTAssertNotNil(openResult.importUrl)
        XCTAssertNil(openResult.content)

        let syncResult = try await sendMessage(
            harness: harness,
            name: "doc2mdSetSessionState",
            id: "sync-native-recent-import",
            args: [
                "openPaths": [recentImport.path],
                "selectedPath": recentImport.path
            ]
        )

        XCTAssertEqual(syncResult.openPaths, [])
        XCTAssertNil(syncResult.selectedPath)

        let persisted = try SessionStore(sessionURL: harness.sessionURL).loadAndPrune()
        XCTAssertEqual(persisted.openPaths, [])
        XCTAssertNil(persisted.selectedPath)
    }

    func testNativeRecentMarkdownCannotBePersistedUntilOpened() async throws {
        let recentMarkdown = try makeFile(name: "recent.md", content: "# recent\n")
        let harness = try makeHarness(seedRecentURLs: [recentMarkdown])

        let untrustedSyncResult = try await sendMessage(
            harness: harness,
            name: "doc2mdSetSessionState",
            id: "sync-unopened-native-recent-markdown",
            args: [
                "openPaths": [recentMarkdown.path],
                "selectedPath": recentMarkdown.path
            ]
        )

        XCTAssertEqual(untrustedSyncResult.openPaths, [])
        XCTAssertNil(untrustedSyncResult.selectedPath)

        let openResult = try await sendMessage(
            harness: harness,
            name: "doc2mdOpenFile",
            id: "open-native-recent-markdown",
            args: ["path": recentMarkdown.path]
        )

        XCTAssertTrue(openResult.ok)
        XCTAssertEqual(openResult.kind, "markdown")
        XCTAssertEqual(openResult.path, recentMarkdown.path)
        XCTAssertEqual(openResult.content, "# recent\n")

        let trustedSyncResult = try await sendMessage(
            harness: harness,
            name: "doc2mdSetSessionState",
            id: "sync-opened-native-recent-markdown",
            args: [
                "openPaths": [recentMarkdown.path],
                "selectedPath": recentMarkdown.path
            ]
        )

        XCTAssertEqual(trustedSyncResult.openPaths, [recentMarkdown.path])
        XCTAssertEqual(trustedSyncResult.selectedPath, recentMarkdown.path)
    }

    func testClearRecentFilesRemovesNativeRecentOpenCandidates() async throws {
        let recentMarkdown = try makeFile(name: "recent.md", content: "# recent\n")
        let harness = try makeHarness(seedRecentURLs: [recentMarkdown])

        let clearResult = try await sendMessage(
            harness: harness,
            name: "doc2mdClearRecentFiles",
            id: "clear-native-recents",
            args: nil
        )

        XCTAssertTrue(clearResult.ok)
        XCTAssertEqual(clearResult.persistenceEnabled, true)
        XCTAssertEqual(clearResult.recentFiles?.count, 0)

        let openResult = try await sendMessage(
            harness: harness,
            name: "doc2mdOpenFile",
            id: "open-cleared-native-recent",
            args: ["path": recentMarkdown.path]
        )

        XCTAssertFalse(openResult.ok)
        XCTAssertEqual(openResult.code, "permission-needed")
    }

    private func makeHarness(
        seedSession: DesktopSessionState = DesktopSessionState(openPaths: [], selectedPath: nil),
        seedRecentURLs: [URL] = []
    ) throws -> ShellBridgeHarness {
        let directory = try makeDirectory()
        let settingsURL = directory.appendingPathComponent("settings.json")
        let sessionURL = directory.appendingPathComponent("session.json")
        let recentDocumentController = ShellBridgeTestRecentDocumentController()
        let persistenceStore = PersistenceStore(
            settingsURL: settingsURL,
            recentDocumentController: recentDocumentController
        )
        _ = try persistenceStore.setPersistenceEnabled(true)
        for url in seedRecentURLs {
            _ = try persistenceStore.recordRecentDocument(url: url)
        }

        if !seedSession.openPaths.isEmpty || seedSession.selectedPath != nil {
            _ = try SessionStore(sessionURL: sessionURL).write(
                openPaths: seedSession.openPaths,
                selectedPath: seedSession.selectedPath
            )
        }

        let webView = CapturingWebView()
        let bridge = ShellBridge(
            fileStore: FileStore(),
            persistenceStore: persistenceStore,
            sessionStore: SessionStore(sessionURL: sessionURL)
        )
        bridge.webView = webView

        return ShellBridgeHarness(bridge: bridge, webView: webView, sessionURL: sessionURL)
    }

    private func sendMessage(
        harness: ShellBridgeHarness,
        name: String,
        id: String,
        args: Any?
    ) async throws -> CapturedShellResult {
        let expectation = expectation(description: "resolve \(id)")
        var capturedScript: String?
        harness.webView.onEvaluateJavaScript = { script in
            capturedScript = script
            expectation.fulfill()
        }

        harness.bridge.userContentController(
            WKUserContentController(),
            didReceive: StubScriptMessage(
                name: name,
                body: [
                    "id": id,
                    "args": args ?? NSNull()
                ]
            )
        )

        await fulfillment(of: [expectation], timeout: 2)
        let script = try XCTUnwrap(capturedScript)
        return try decodeResult(from: script)
    }

    private func decodeResult(from script: String) throws -> CapturedShellResult {
        let prefix = "window.__doc2mdShellResolve("
        XCTAssertTrue(script.hasPrefix(prefix))
        XCTAssertTrue(script.hasSuffix(");"))

        let payloadStart = script.index(script.startIndex, offsetBy: prefix.count)
        let payloadEnd = script.index(script.endIndex, offsetBy: -2)
        let payload = script[payloadStart..<payloadEnd]
        let resultStart = try XCTUnwrap(payload.firstIndex(of: ","))
        let resultJSONStart = payload.index(resultStart, offsetBy: 2)
        let resultJSON = payload[resultJSONStart..<payloadEnd]
        let data = Data(String(resultJSON).utf8)

        return try JSONDecoder().decode(CapturedShellResult.self, from: data)
    }

    private func makeFile(name: String, content: String = "# test\n") throws -> URL {
        let directory = try makeDirectory()
        let fileURL = directory.appendingPathComponent(name)
        try Data(content.utf8).write(to: fileURL)
        return fileURL
    }

    private func makeDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("doc2md-shell-bridge-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        tempDirectories.append(directory)
        return directory
    }
}

private struct ShellBridgeHarness {
    let bridge: ShellBridge
    let webView: CapturingWebView
    let sessionURL: URL
}

private struct CapturedShellResult: Decodable {
    let ok: Bool
    let kind: String?
    let path: String?
    let name: String?
    let format: String?
    let content: String?
    let importUrl: String?
    let code: String?
    let persistenceEnabled: Bool?
    let recentFiles: [RecentFile]?
    let openPaths: [String]?
    let selectedPath: String?
}

private final class ShellBridgeTestRecentDocumentController: RecentDocumentControlling {
    private(set) var recentDocumentURLs: [URL] = []

    func noteNewRecentDocumentURL(_ url: URL) {
        recentDocumentURLs = [url] + recentDocumentURLs.filter {
            $0.standardizedFileURL.path != url.standardizedFileURL.path
        }
    }

    func clearRecentDocuments(_ sender: Any?) {
        recentDocumentURLs = []
    }
}

private final class CapturingWebView: WKWebView {
    var onEvaluateJavaScript: ((String) -> Void)?

    override func evaluateJavaScript(
        _ javaScriptString: String,
        completionHandler: (@MainActor @Sendable (Any?, (any Error)?) -> Void)? = nil
    ) {
        onEvaluateJavaScript?(javaScriptString)
        completionHandler?(nil, nil)
    }
}

private final class StubScriptMessage: WKScriptMessage {
    private let stubName: String
    private let stubBody: Any

    override var name: String {
        stubName
    }

    override var body: Any {
        stubBody
    }

    init(name: String, body: Any) {
        self.stubName = name
        self.stubBody = body
        super.init()
    }
}
