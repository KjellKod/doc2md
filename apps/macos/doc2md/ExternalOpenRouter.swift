import Foundation
import WebKit

// Buffers Finder and Document Library URLs until `doc2mdShellReady`, emitted
// only after the web shell installs its native-event listener. Navigation
// resets readiness so the old data-app-ready cold-launch deadlock cannot recur.
final class ExternalOpenRouter {
    static let externalOpenEventName = "doc2md:native-external-open"

    private enum Route { case finder, library }

    private struct Request {
        let id = UUID()
        let url: URL
        let route: Route
        let completion: ((ShellCallResult) -> Void)?
        var result: ShellCallResult?
    }

    private let finderOpener: (URL) -> ShellCallResult
    private let libraryOpener: (URL) -> ShellCallResult
    private let dispatcher: (ShellCallResult, @escaping (Bool) -> Void) -> Void
    private var pendingRequests: [Request] = []
    private var isAppReady = false
    private var readinessGeneration = 0
    private var inFlightDelivery: (requestID: UUID, generation: Int, result: ShellCallResult)?

    init(shellBridge: ShellBridge) {
        finderOpener = { url in shellBridge.openExternalMarkdownURL(url) }
        libraryOpener = { url in shellBridge.openLibraryURL(url) }
        dispatcher = { [weak shellBridge] result, completion in
            ExternalOpenRouter.dispatchToWebView(result, shellBridge: shellBridge, completion: completion)
        }
    }

    init(
        opener: @escaping (URL) -> ShellCallResult,
        dispatcher: @escaping (ShellCallResult, @escaping (Bool) -> Void) -> Void,
        libraryOpener: ((URL) -> ShellCallResult)? = nil
    ) {
        finderOpener = opener
        self.libraryOpener = libraryOpener ?? opener
        self.dispatcher = dispatcher
    }

    convenience init(
        opener: @escaping (URL) -> ShellCallResult,
        dispatcher: @escaping (ShellCallResult) -> Void,
        libraryOpener: ((URL) -> ShellCallResult)? = nil
    ) {
        self.init(
            opener: opener,
            dispatcher: { result, completion in
                dispatcher(result)
                completion(true)
            },
            libraryOpener: libraryOpener
        )
    }

    func enqueue(urls: [URL]) {
        guard !urls.isEmpty else { return }
        pendingRequests.append(contentsOf: urls.map {
            Request(url: $0, route: .finder, completion: nil)
        })
        flushIfReady()
    }

    @discardableResult
    func enqueueLibrary(url: URL, completion: @escaping (ShellCallResult) -> Void) -> Bool {
        let deferred = !isAppReady || inFlightDelivery != nil || !pendingRequests.isEmpty
        pendingRequests.append(Request(url: url, route: .library, completion: completion))
        flushIfReady()
        return deferred
    }

    func markWebShellReady() {
        isAppReady = true
        flushIfReady()
    }

    func markWebShellNotReady() {
        isAppReady = false
        readinessGeneration += 1
        pendingRequests = pendingRequests.map { request in
            var request = request
            request.result = nil
            return request
        }
    }

    private func flushIfReady() {
        guard isAppReady, !pendingRequests.isEmpty, inFlightDelivery == nil else { return }
        var request = pendingRequests[0]
        let generation = readinessGeneration
        if request.result == nil {
            switch request.route {
            case .finder:
                request.result = finderOpener(request.url)
            case .library:
                request.result = libraryOpener(request.url)
            }
            pendingRequests[0] = request
        }
        guard let result = request.result else { return }
        inFlightDelivery = (request.id, generation, result)

        // A failed library reopen is shown inline by the library row. There is
        // no web-shell state to deliver, so completing it here avoids a second
        // hidden-window notice while preserving Finder dispatch/retry behavior.
        if request.route == .library, !result.ok {
            finishDelivery(requestID: request.id, generation: generation, delivered: true)
            return
        }
        dispatcher(result) { [weak self] delivered in
            self?.finishDelivery(requestID: request.id, generation: generation, delivered: delivered)
        }
    }

    private func finishDelivery(requestID: UUID, generation: Int, delivered: Bool) {
        guard let delivery = inFlightDelivery,
              delivery.requestID == requestID,
              delivery.generation == generation else { return }

        inFlightDelivery = nil
        if delivered, isAppReady, generation == readinessGeneration {
            let request = pendingRequests.removeFirst()
            request.completion?(delivery.result)
            flushIfReady()
        } else if !delivered,
                  isAppReady,
                  generation == readinessGeneration,
                  pendingRequests.first?.route == .library {
            let request = pendingRequests.removeFirst()
            request.completion?(.error(message: "The document could not be opened. Try again."))
            flushIfReady()
        } else if isAppReady, generation != readinessGeneration {
            flushIfReady()
        }
    }

    private static func dispatchToWebView(
        _ result: ShellCallResult,
        shellBridge: ShellBridge?,
        completion: @escaping (Bool) -> Void
    ) {
        guard let webView = shellBridge?.webView else {
            completion(false)
            return
        }

        let detailJSON: String
        do {
            detailJSON = try ShellBridge.encodeJSON(result)
        } catch {
            #if DEBUG
            print("ExternalOpenRouter failed to encode result: \(error.localizedDescription)")
            #endif
            completion(false)
            return
        }

        let script = """
        window.dispatchEvent(new CustomEvent("\(externalOpenEventName)", { detail: \(detailJSON) }));
        """
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { _, error in
                #if DEBUG
                if let error {
                    print("ExternalOpenRouter failed to dispatch external open: \(error.localizedDescription)")
                }
                #endif
                completion(error == nil)
            }
        }
    }
}
