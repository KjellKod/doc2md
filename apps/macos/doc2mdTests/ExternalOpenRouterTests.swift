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

    func testNavigationResetReopensLibraryRequestWithFreshResult() {
        var openCount = 0
        var delivery: ((Bool) -> Void)?
        let router = ExternalOpenRouter(
            opener: { _ in .error(message: "finder") },
            dispatcher: { _, callback in delivery = callback },
            libraryOpener: { url in
                openCount += 1
                return self.markdownResult(url)
            }
        )
        router.markWebShellReady()
        _ = router.enqueueLibrary(url: makeURL("Reset.md")) { _ in }
        router.markWebShellNotReady()
        delivery?(false)
        router.markWebShellReady()
        XCTAssertEqual(openCount, 2)
    }

    func testFinderAndLibrarySelectDifferentOpeners() {
        var messages: [String] = []
        let router = ExternalOpenRouter(
            opener: { url in self.markdownResult(url) },
            dispatcher: { result in messages.append(result.path ?? "") },
            libraryOpener: { url in self.markdownResult(url) }
        )
        router.markWebShellReady()
        router.enqueue(urls: [makeURL("Finder.md")])
        _ = router.enqueueLibrary(url: makeURL("Library.md")) { _ in }
        XCTAssertEqual(messages, ["/tmp/doc2md-router-tests/Finder.md", "/tmp/doc2md-router-tests/Library.md"])
    }

    func testMixedFinderAndLibraryRequestsPreserveOrder() {
        var messages: [String] = []
        let router = ExternalOpenRouter(
            opener: { self.markdownResult($0) },
            dispatcher: { result in messages.append(result.path ?? "") },
            libraryOpener: { self.markdownResult($0) }
        )
        router.enqueue(urls: [makeURL("One.md")])
        _ = router.enqueueLibrary(url: makeURL("Two.md")) { _ in }
        router.markWebShellReady()
        XCTAssertEqual(messages, ["/tmp/doc2md-router-tests/One.md", "/tmp/doc2md-router-tests/Two.md"])
    }

    func testFailedLibraryDeliveryCompletesWithoutDuplicateCompletion() {
        var dispatchCount = 0
        var openCount = 0
        var completionCount = 0
        var delivery: ((Bool) -> Void)?
        let router = ExternalOpenRouter(
            opener: { _ in .error(message: "finder") },
            dispatcher: { _, callback in
                dispatchCount += 1
                delivery = callback
            },
            libraryOpener: { url in
                openCount += 1
                return .openMarkdown(ShellOpenMarkdownOk(
                    ok: true,
                    kind: "markdown",
                    path: url.path,
                    mtimeMs: 0,
                    content: "# Test",
                    lineEnding: .lf
                ))
            }
        )
        router.markWebShellReady()
        _ = router.enqueueLibrary(url: makeURL("Retry.md")) { _ in completionCount += 1 }
        delivery?(false)
        XCTAssertEqual(dispatchCount, 1)
        XCTAssertEqual(openCount, 1)
        XCTAssertEqual(completionCount, 1)
    }

    func testFailedLibraryDispatchCompletesInlineWithoutWebDelivery() {
        var dispatched = false
        var completion: ShellCallResult?
        let router = ExternalOpenRouter(
            opener: { _ in .error(message: "finder") },
            dispatcher: { _, callback in
                dispatched = true
                callback(false)
            },
            libraryOpener: { _ in
                .openMarkdown(ShellOpenMarkdownOk(
                    ok: true,
                    kind: "markdown",
                    path: "/tmp/Test.md",
                    mtimeMs: 0,
                    content: "# Test",
                    lineEnding: .lf
                ))
            }
        )
        router.markWebShellReady()
        _ = router.enqueueLibrary(url: makeURL("Unavailable.md")) { completion = $0 }
        XCTAssertTrue(dispatched)
        XCTAssertEqual(completion?.code, "error")
    }

    func testFailedLibraryResultCompletesWithoutDesktopDispatch() {
        var dispatched = false
        var completion: ShellCallResult?
        let router = ExternalOpenRouter(
            opener: { _ in .error(message: "finder") },
            dispatcher: { _, _ in dispatched = true },
            libraryOpener: { _ in .error(message: "Missing") }
        )
        router.markWebShellReady()
        _ = router.enqueueLibrary(url: makeURL("Missing.md")) { completion = $0 }
        XCTAssertFalse(dispatched)
        XCTAssertEqual(completion?.message, "Missing")
    }

    func testExistingInitializerDefaultsLibraryRouteWithoutCallSiteChanges() {
        var messages: [String] = []
        let router = ExternalOpenRouter(
            opener: { self.markdownResult($0) },
            dispatcher: { result in messages.append(result.path ?? "") }
        )
        router.markWebShellReady()
        _ = router.enqueueLibrary(url: makeURL("Default.md")) { _ in }
        XCTAssertEqual(messages, [makeURL("Default.md").path])
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

    private func markdownResult(_ url: URL) -> ShellCallResult {
        .openMarkdown(ShellOpenMarkdownOk(
            ok: true,
            kind: "markdown",
            path: url.path,
            mtimeMs: 0,
            content: "# Test",
            lineEnding: .lf
        ))
    }
}
