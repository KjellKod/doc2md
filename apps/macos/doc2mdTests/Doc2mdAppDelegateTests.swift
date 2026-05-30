import AppKit
import XCTest

final class Doc2mdAppDelegateTests: XCTestCase {
    func testOpenBeforeConfigureBuffersUntilShellHostConfigured() {
        let (router, recorder) = makeRecordingRouter()
        let delegate = Doc2mdAppDelegate()
        let url = makeMarkdownURL("Buffered.md")

        delegate.application(NSApp, open: [url])
        XCTAssertEqual(recorder.openedPaths, [], "URLs must buffer before configure")

        delegate.configure(externalOpenRouter: router)
        XCTAssertEqual(recorder.openedPaths, [url.path], "Configure flushes buffered URLs")
    }

    func testOpenAfterConfigureRoutesImmediately() {
        let (router, recorder) = makeRecordingRouter()
        let delegate = Doc2mdAppDelegate()
        let url = makeMarkdownURL("Immediate.md")

        delegate.configure(externalOpenRouter: router)
        delegate.application(NSApp, open: [url])

        XCTAssertEqual(recorder.openedPaths, [url.path])
    }

    func testMultipleOpenURLsFlushInOriginalOrder() {
        let (router, recorder) = makeRecordingRouter()
        let delegate = Doc2mdAppDelegate()
        let first = makeMarkdownURL("First.md")
        let second = makeMarkdownURL("Second.md")
        let third = makeMarkdownURL("Third.md")

        delegate.application(NSApp, open: [first, second, third])
        delegate.configure(externalOpenRouter: router)

        XCTAssertEqual(recorder.openedPaths, [first.path, second.path, third.path])
    }

    func testRepeatedConfigureDoesNotDoubleFlushBufferedURLs() {
        let (router, recorder) = makeRecordingRouter()
        let delegate = Doc2mdAppDelegate()
        let url = makeMarkdownURL("Once.md")

        delegate.application(NSApp, open: [url])
        delegate.configure(externalOpenRouter: router)
        delegate.configure(externalOpenRouter: router)

        XCTAssertEqual(recorder.openedPaths, [url.path], "Buffered URLs must flush exactly once")
    }

    // MARK: Helpers

    private final class Recorder {
        var openedPaths: [String] = []
    }

    // The router is created ready, so any enqueued URL flushes through the
    // capturing opener immediately. The dispatcher is a no-op; we only need to
    // observe which URLs the router opened and in what order.
    private func makeRecordingRouter() -> (ExternalOpenRouter, Recorder) {
        let recorder = Recorder()
        let router = ExternalOpenRouter(
            opener: { url in
                recorder.openedPaths.append(url.path)
                return ShellCallResult.error(message: "test")
            },
            dispatcher: { _ in }
        )
        router.markWebShellReady()
        return (router, recorder)
    }

    private func makeMarkdownURL(_ name: String) -> URL {
        URL(fileURLWithPath: "/tmp/doc2md-tests/\(name)")
    }
}
