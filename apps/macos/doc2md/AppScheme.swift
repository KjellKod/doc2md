import Foundation
import WebKit
import UniformTypeIdentifiers

// WKWebView treats every file:// URL as a distinct origin, which silently blocks
// ES module imports between sibling files (index.html importing ./assets/*.js).
// Serving the bundled web app from a custom `doc2md://` scheme gives the webview
// a single stable origin and lets module loading, fetch, and workers behave as
// they do on http servers. This handler is read-only and serves only files under
// the app bundle's Resources/Web directory.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "doc2md"
    static let host = "app"

    private let webRoot: URL?

    override init() {
        self.webRoot = Bundle.main.url(forResource: "Web", withExtension: nil)
    }

    static func indexURL() -> URL? {
        guard let base = URL(string: "\(scheme)://\(host)/") else { return nil }
        return base.appendingPathComponent("index.html")
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            finish(urlSchemeTask, status: 400, data: Data(), mimeType: "text/plain")
            return
        }

        guard let webRoot = webRoot else {
            finish(urlSchemeTask, status: 500, data: Data("Bundled Web resources missing".utf8), mimeType: "text/plain")
            return
        }

        let rawPath = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        let relative = rawPath.hasPrefix("/") ? String(rawPath.dropFirst()) : rawPath

        guard let resolved = safeResolve(relativePath: relative, under: webRoot) else {
            finish(urlSchemeTask, status: 404, data: Data(), mimeType: "text/plain")
            return
        }

        do {
            let data = try Data(contentsOf: resolved)
            let mimeType = mimeType(for: resolved)
            finish(urlSchemeTask, status: 200, data: data, mimeType: mimeType)
        } catch {
            finish(urlSchemeTask, status: 404, data: Data(), mimeType: "text/plain")
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // No async work to cancel; handled synchronously in start.
    }

    private func safeResolve(relativePath: String, under root: URL) -> URL? {
        let candidate = root.appendingPathComponent(relativePath).standardizedFileURL
        let rootPath = root.standardizedFileURL.path
        guard candidate.path == rootPath || candidate.path.hasPrefix(rootPath + "/") else {
            return nil
        }
        guard FileManager.default.fileExists(atPath: candidate.path) else {
            return nil
        }
        return candidate
    }

    private func mimeType(for url: URL) -> String {
        let ext = url.pathExtension.lowercased()
        switch ext {
        case "html", "htm":
            return "text/html; charset=utf-8"
        case "js", "mjs":
            return "application/javascript; charset=utf-8"
        case "css":
            return "text/css; charset=utf-8"
        case "json":
            return "application/json; charset=utf-8"
        case "svg":
            return "image/svg+xml"
        case "png":
            return "image/png"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "gif":
            return "image/gif"
        case "webp":
            return "image/webp"
        case "ico":
            return "image/x-icon"
        case "woff":
            return "font/woff"
        case "woff2":
            return "font/woff2"
        case "ttf":
            return "font/ttf"
        case "otf":
            return "font/otf"
        case "txt":
            return "text/plain; charset=utf-8"
        case "wasm":
            return "application/wasm"
        case "map":
            return "application/json; charset=utf-8"
        default:
            if let utType = UTType(filenameExtension: ext), let mime = utType.preferredMIMEType {
                return mime
            }
            return "application/octet-stream"
        }
    }

    private func finish(
        _ task: WKURLSchemeTask,
        status: Int,
        data: Data,
        mimeType: String
    ) {
        let headers: [String: String] = [
            "Content-Type": mimeType,
            "Content-Length": "\(data.count)",
            "Access-Control-Allow-Origin": "*"
        ]

        guard
            let url = task.request.url,
            let response = HTTPURLResponse(
                url: url,
                statusCode: status,
                httpVersion: "HTTP/1.1",
                headerFields: headers
            )
        else {
            task.didFailWithError(NSError(domain: "AppSchemeHandler", code: -1))
            return
        }

        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }
}
