import XCTest

final class ExternalOpenRouterTests: XCTestCase {
    private final class Recorder {
        var dispatchedMessages: [String] = []
    }

    func testQueuedOpenFlushesWhenShellReadyWithoutSelectedDocument() {
        let (router, recorder) = makeRouter()
        let url = makeURL("Cold.md")

        // No selected document and no readiness yet: the URL must buffer.
        router.enqueue(urls: [url])
        XCTAssertEqual(recorder.dispatchedMessages, [])

        // Readiness alone (independent of any document selection) flushes it.
        router.markWebShellReady()
        XCTAssertEqual(recorder.dispatchedMessages, [url.path])
    }

    func testReadyAfterOldProbeTimeoutStillFlushesOnce() {
        // The router has no capped probe window, so readiness arriving late
        // still flushes. Buffer first, then signal ready much later.
        let (router, recorder) = makeRouter()
        let url = makeURL("Late.md")

        router.enqueue(urls: [url])
        router.markWebShellReady()

        XCTAssertEqual(recorder.dispatchedMessages, [url.path])
    }

    func testRepeatedReadyDoesNotDispatchDuplicateOpen() {
        let (router, recorder) = makeRouter()
        let url = makeURL("Single.md")

        router.enqueue(urls: [url])
        router.markWebShellReady()
        router.markWebShellReady()
        router.markWebShellReady()

        XCTAssertEqual(recorder.dispatchedMessages, [url.path])
    }

    func testDidStartMarksRouterNotReadyUntilNextShellReady() {
        let (router, recorder) = makeRouter()
        let first = makeURL("First.md")
        let second = makeURL("Second.md")

        router.markWebShellReady()
        router.enqueue(urls: [first])
        XCTAssertEqual(recorder.dispatchedMessages, [first.path])

        // Simulate a navigation reset: not ready again.
        router.markWebShellNotReady()
        router.enqueue(urls: [second])
        XCTAssertEqual(
            recorder.dispatchedMessages,
            [first.path],
            "Buffered URL must wait while the router is not ready"
        )

        router.markWebShellReady()
        XCTAssertEqual(recorder.dispatchedMessages, [first.path, second.path])
    }

    func testMultipleURLsDispatchResultsInOrder() {
        let (router, recorder) = makeRouter()
        let first = makeURL("Alpha.md")
        let second = makeURL("Beta.md")
        let third = makeURL("Gamma.md")

        router.markWebShellReady()
        router.enqueue(urls: [first, second, third])

        XCTAssertEqual(
            recorder.dispatchedMessages,
            [first.path, second.path, third.path]
        )
    }

    func testNavigationResetDuringFlushRetriesOnceAfterNextReady() {
        let recorder = Recorder()
        let url = makeURL("Reset.md")
        var router: ExternalOpenRouter!
        router = ExternalOpenRouter(
            opener: { url in ShellCallResult.error(message: url.path) },
            dispatcher: { result in
                if let message = result.message {
                    recorder.dispatchedMessages.append(message)
                }
                if recorder.dispatchedMessages.count == 1 {
                    router.markWebShellNotReady()
                }
            }
        )

        router.markWebShellReady()
        router.enqueue(urls: [url])
        XCTAssertEqual(recorder.dispatchedMessages, [url.path])

        router.markWebShellReady()
        XCTAssertEqual(recorder.dispatchedMessages, [url.path, url.path])

        router.markWebShellReady()
        XCTAssertEqual(recorder.dispatchedMessages, [url.path, url.path])
    }

    // MARK: Helpers

    // Opener echoes the URL path so the recorder can assert order; dispatcher
    // records each delivered result. This exercises the queue/readiness logic
    // without a live WKWebView.
    private func makeRouter() -> (ExternalOpenRouter, Recorder) {
        let recorder = Recorder()
        let router = ExternalOpenRouter(
            opener: { url in ShellCallResult.error(message: url.path) },
            dispatcher: { result in
                if let message = result.message {
                    recorder.dispatchedMessages.append(message)
                }
            }
        )
        return (router, recorder)
    }

    private func makeURL(_ name: String) -> URL {
        URL(fileURLWithPath: "/tmp/doc2md-router-tests/\(name)")
    }
}
