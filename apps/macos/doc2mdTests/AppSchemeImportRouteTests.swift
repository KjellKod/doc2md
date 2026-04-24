import Foundation
import WebKit
import XCTest

final class AppSchemeImportRouteTests: XCTestCase {
    private var tempDirectories: [URL] = []

    override func setUpWithError() throws {
        try super.setUpWithError()
        ImportHandoff.shared.clear()
    }

    override func tearDownWithError() throws {
        ImportHandoff.shared.clear()

        for url in tempDirectories {
            try? FileManager.default.removeItem(at: url)
        }
        tempDirectories = []

        try super.tearDownWithError()
    }

    func testUnknownImportTokenReturns404() throws {
        let handler = AppSchemeHandler(webRoot: nil)
        let task = MockURLSchemeTask(
            url: try XCTUnwrap(URL(string: "doc2md://app/__shell/import/missing-token"))
        )
        let didFinish = expectation(description: "import 404 finished")
        task.onFinish = { didFinish.fulfill() }

        handler.webView(WKWebView(), start: task)

        wait(for: [didFinish], timeout: 1.0)

        let response = try XCTUnwrap(task.receivedResponse as? HTTPURLResponse)
        XCTAssertEqual(response.statusCode, 404)
        XCTAssertEqual(task.receivedData, Data())
    }

    func testNavigationClearsActiveHandoff() throws {
        let sourceURL = try makeFile(name: "cleared.txt", data: Data("cleared".utf8))
        let ticket = try ImportHandoff.shared.enqueue(url: sourceURL)
        let handler = AppSchemeHandler(webRoot: nil)
        let task = MockURLSchemeTask(url: try XCTUnwrap(URL(string: ImportHandoff.importURL(for: ticket.token))))
        let didFinish = expectation(description: "cleared import finished")
        task.onFinish = { didFinish.fulfill() }

        handler.clearImportHandoff()
        handler.webView(WKWebView(), start: task)

        wait(for: [didFinish], timeout: 1.0)

        let response = try XCTUnwrap(task.receivedResponse as? HTTPURLResponse)
        XCTAssertEqual(response.statusCode, 404)
        XCTAssertEqual(task.receivedData, Data())
    }

    func testValidImportTokenReturnsBytesAndMimeType() throws {
        let sourceData = Data("hello import".utf8)
        let sourceURL = try makeFile(name: "sample.txt", data: sourceData)
        let ticket = try ImportHandoff.shared.enqueue(url: sourceURL)
        let handler = AppSchemeHandler(webRoot: nil)
        let task = MockURLSchemeTask(url: try XCTUnwrap(URL(string: ImportHandoff.importURL(for: ticket.token))))
        let didFinish = expectation(description: "import 200 finished")
        task.onFinish = { didFinish.fulfill() }

        handler.webView(WKWebView(), start: task)

        wait(for: [didFinish], timeout: 1.0)

        let response = try XCTUnwrap(task.receivedResponse as? HTTPURLResponse)
        XCTAssertEqual(response.statusCode, 200)
        XCTAssertEqual(response.value(forHTTPHeaderField: "Content-Type"), "text/plain")
        XCTAssertEqual(response.allHeaderFields["Cache-Control"] as? String, "no-store")
        XCTAssertEqual(task.receivedData, sourceData)
        XCTAssertNil(try ImportHandoff.shared.peek(token: ticket.token))
    }

    func testStoppingImportTaskBeforeDeliveryDoesNotCrash() throws {
        let sourceURL = try makeFile(name: "cancel.txt", data: Data(repeating: 0x61, count: 64 * 1024))
        let ticket = try ImportHandoff.shared.enqueue(url: sourceURL)
        let handler = AppSchemeHandler(webRoot: nil)
        let webView = WKWebView()
        let task = MockURLSchemeTask(url: try XCTUnwrap(URL(string: ImportHandoff.importURL(for: ticket.token))))
        let settled = expectation(description: "import stop settled")

        handler.webView(webView, start: task)
        handler.webView(webView, stop: task)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            settled.fulfill()
        }
        wait(for: [settled], timeout: 1.0)

        XCTAssertNil(task.receivedResponse)
        XCTAssertEqual(task.receivedData, Data())
        XCTAssertFalse(task.didFinishCalled)
        XCTAssertNil(task.didFailError)
        XCTAssertNotNil(try ImportHandoff.shared.peek(token: ticket.token))
    }

    func testOversizedImportsAreRejectedOnEnqueue() throws {
        let oversizedURL = try makeSparseFile(
            name: "oversized.pdf",
            size: UInt64(ImportHandoff.maxImportSizeBytes + 1)
        )

        XCTAssertThrowsError(try ImportHandoff.shared.enqueue(url: oversizedURL)) { error in
            XCTAssertEqual(
                error as? FileStoreError,
                .error(message: ImportHandoff.oversizedImportMessage)
            )
        }
    }

    func testImportGrowthPastCapIsRejectedAtServeTime() throws {
        let sourceURL = try makeFile(name: "growing.txt", data: Data(repeating: 0x61, count: 1024))
        let ticket = try ImportHandoff.shared.enqueue(url: sourceURL)
        let handle = try FileHandle(forWritingTo: sourceURL)
        try handle.truncate(atOffset: UInt64(ImportHandoff.maxImportSizeBytes + 1))
        try handle.close()

        let handler = AppSchemeHandler(webRoot: nil)
        let task = MockURLSchemeTask(url: try XCTUnwrap(URL(string: ImportHandoff.importURL(for: ticket.token))))
        let didFinish = expectation(description: "oversized serve rejected")
        task.onFinish = { didFinish.fulfill() }

        handler.webView(WKWebView(), start: task)

        wait(for: [didFinish], timeout: 1.0)

        let response = try XCTUnwrap(task.receivedResponse as? HTTPURLResponse)
        XCTAssertEqual(response.statusCode, 413)
        XCTAssertEqual(task.receivedData, Data(ImportHandoff.oversizedImportMessage.utf8))
        XCTAssertNil(try ImportHandoff.shared.peek(token: ticket.token))
    }

    func testNonMarkdownSaveTargetsAreRejected() throws {
        let store = FileStore()
        let existingMarkdownAliasURL = try makeFile(name: "notes.markdown", data: Data("old".utf8))

        XCTAssertThrowsError(
            try store.save(
                args: SaveFileArgs(
                    path: existingMarkdownAliasURL.path,
                    content: "new",
                    expectedMtimeMs: try store.modificationTimeMs(for: existingMarkdownAliasURL),
                    lineEnding: .lf
                ),
                knownURL: existingMarkdownAliasURL
            )
        ) { error in
            XCTAssertEqual(
                error as? FileStoreError,
                .error(message: "Save target must use the .md extension.")
            )
        }

        let saveAsURL = existingMarkdownAliasURL.deletingLastPathComponent().appendingPathComponent("notes.txt")
        XCTAssertThrowsError(
            try store.saveAs(url: saveAsURL, content: "new", lineEnding: .lf)
        ) { error in
            XCTAssertEqual(
                error as? FileStoreError,
                .error(message: "Save target must use the .md extension.")
            )
        }
    }

    private func makeFile(name: String, data: Data) throws -> URL {
        let directory = try makeDirectory()
        let fileURL = directory.appendingPathComponent(name)
        try data.write(to: fileURL)
        return fileURL
    }

    private func makeSparseFile(name: String, size: UInt64) throws -> URL {
        let fileURL = try makeFile(name: name, data: Data())
        let handle = try FileHandle(forWritingTo: fileURL)
        try handle.truncate(atOffset: size)
        try handle.close()
        return fileURL
    }

    private func makeDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("doc2md-app-scheme-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        tempDirectories.append(directory)
        return directory
    }
}

private final class MockURLSchemeTask: NSObject, WKURLSchemeTask {
    let request: URLRequest

    var receivedResponse: URLResponse?
    var receivedData = Data()
    var didFinishCalled = false
    var didFailError: Error?
    var onFinish: (() -> Void)?

    init(url: URL) {
        request = URLRequest(url: url)
    }

    func didReceive(_ response: URLResponse) {
        receivedResponse = response
    }

    func didReceive(_ data: Data) {
        receivedData.append(data)
    }

    func didFinish() {
        didFinishCalled = true
        onFinish?()
    }

    func didFailWithError(_ error: Error) {
        didFailError = error
        onFinish?()
    }
}
