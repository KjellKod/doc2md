import Foundation
import UniformTypeIdentifiers
import WebKit

final class ImportHandoff {
    static let shared = ImportHandoff()
    static let maxImportSizeBytes = 128 * 1024 * 1024
    static let oversizedImportMessage = "This file is too large to import (limit: 128 MB)."

    struct Ticket {
        let token: String
        let path: String
        let name: String
        let format: String
        let mtimeMs: Int64
        let mimeType: String?
    }

    struct Payload {
        let data: Data
        let mimeType: String
    }

    private struct StoredImport {
        let token: String
        let url: URL
        let name: String
        let format: String
        let mtimeMs: Int64
        let mimeType: String?
        let startedSecurityScope: Bool
    }

    private let stateQueue = DispatchQueue(label: "com.kjellkod.doc2md.import-handoff")
    private var activeImport: StoredImport?

    func enqueue(url: URL) throws -> Ticket {
        let standardizedURL = url.standardizedFileURL
        let startedSecurityScope = standardizedURL.startAccessingSecurityScopedResource()

        do {
            let values = try standardizedURL.resourceValues(forKeys: [
                .contentModificationDateKey,
                .fileSizeKey,
            ])

            guard let contentModificationDate = values.contentModificationDate else {
                throw FileStoreError.error(message: "Could not read the file modification time.")
            }

            guard let fileSize = values.fileSize else {
                throw FileStoreError.error(message: "Could not read the file size.")
            }

            if fileSize > Self.maxImportSizeBytes {
                throw FileStoreError.error(message: Self.oversizedImportMessage)
            }

            let format = standardizedURL.pathExtension.lowercased()
            let storedImport = StoredImport(
                token: Self.makeToken(),
                url: standardizedURL,
                name: standardizedURL.lastPathComponent,
                format: format,
                mtimeMs: FileStore.mtimeMs(from: contentModificationDate),
                mimeType: Self.mimeType(for: format),
                startedSecurityScope: startedSecurityScope
            )

            stateQueue.sync {
                releaseActiveImportLocked()
                activeImport = storedImport
            }

            return Ticket(
                token: storedImport.token,
                path: storedImport.url.path,
                name: storedImport.name,
                format: storedImport.format,
                mtimeMs: storedImport.mtimeMs,
                mimeType: storedImport.mimeType
            )
        } catch let error as FileStoreError {
            if startedSecurityScope {
                standardizedURL.stopAccessingSecurityScopedResource()
            }
            throw error
        } catch {
            if startedSecurityScope {
                standardizedURL.stopAccessingSecurityScopedResource()
            }
            throw FileStore.map(error: error, path: standardizedURL.path)
        }
    }

    func peek(token: String) throws -> Payload? {
        let storedImport = stateQueue.sync {
            activeImport?.token == token ? activeImport : nil
        }

        guard let storedImport else {
            return nil
        }

        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: storedImport.url.path)
            guard let fileSize = (attributes[.size] as? NSNumber)?.int64Value else {
                throw FileStoreError.error(message: "Could not read the file size.")
            }

            if fileSize > Int64(Self.maxImportSizeBytes) {
                release(token: token)
                throw FileStoreError.error(message: Self.oversizedImportMessage)
            }

            let data = try Data(contentsOf: storedImport.url)
            return Payload(
                data: data,
                mimeType: storedImport.mimeType ?? "application/octet-stream"
            )
        } catch let error as FileStoreError {
            throw error
        } catch {
            throw FileStore.map(error: error, path: storedImport.url.path)
        }
    }

    func release(token: String) {
        stateQueue.sync {
            guard activeImport?.token == token else {
                return
            }

            releaseActiveImportLocked()
        }
    }

    func clear() {
        stateQueue.sync {
            releaseActiveImportLocked()
        }
    }

    static func importURL(for token: String) -> String {
        "\(AppSchemeHandler.scheme)://\(AppSchemeHandler.host)\(AppSchemeHandler.importPathPrefix)\(token)"
    }

    private func releaseActiveImportLocked() {
        guard let activeImport else {
            return
        }

        if activeImport.startedSecurityScope {
            activeImport.url.stopAccessingSecurityScopedResource()
        }

        self.activeImport = nil
    }

    private static func makeToken() -> String {
        UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
    }

    private static func mimeType(for format: String) -> String? {
        guard !format.isEmpty else {
            return nil
        }

        if format == "txt" {
            return "text/plain"
        }

        return UTType(filenameExtension: format)?.preferredMIMEType
    }
}

// WKWebView treats every file:// URL as a distinct origin, which silently blocks
// ES module imports between sibling files (index.html importing ./assets/*.js).
// Serving the bundled web app from a custom `doc2md://` scheme gives the webview
// a single stable origin and lets module loading, fetch, and workers behave as
// they do on http servers. This handler is read-only and serves only files under
// the app bundle's Resources/Web directory, plus one-shot native import handoffs.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "doc2md"
    static let host = "app"
    static let importPathPrefix = "/__shell/import/"

    private let webRoot: URL?
    private var liveTasks: Set<ObjectIdentifier> = []

    init(webRoot: URL? = Bundle.main.url(forResource: "Web", withExtension: nil)) {
        self.webRoot = webRoot
    }

    static func indexURL() -> URL? {
        guard let base = URL(string: "\(scheme)://\(host)/") else { return nil }
        return base.appendingPathComponent("index.html")
    }

    func clearImportHandoff() {
        ImportHandoff.shared.clear()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        markTaskLive(urlSchemeTask)

        guard let url = urlSchemeTask.request.url else {
            failIfLive(
                urlSchemeTask,
                error: NSError(domain: "AppSchemeHandler", code: -1)
            )
            return
        }

        if let token = Self.importToken(from: url) {
            serveImport(token: token, task: urlSchemeTask)
            return
        }

        guard let webRoot else {
            _ = finishIfLive(
                urlSchemeTask,
                status: 500,
                data: Data("Bundled Web resources missing".utf8),
                mimeType: "text/plain"
            )
            return
        }

        let rawPath = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        let relative = rawPath.hasPrefix("/") ? String(rawPath.dropFirst()) : rawPath

        guard let resolved = safeResolve(relativePath: relative, under: webRoot) else {
            _ = finishIfLive(urlSchemeTask, status: 404, data: Data(), mimeType: "text/plain")
            return
        }

        do {
            let data = try Data(contentsOf: resolved)
            let mimeType = mimeType(forBundledResource: resolved)
            _ = finishIfLive(urlSchemeTask, status: 200, data: data, mimeType: mimeType)
        } catch {
            _ = finishIfLive(urlSchemeTask, status: 404, data: Data(), mimeType: "text/plain")
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        unmarkTaskLive(urlSchemeTask)
    }

    private func serveImport(token: String, task: WKURLSchemeTask) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else {
                return
            }

            let payload: ImportHandoff.Payload?

            do {
                payload = try ImportHandoff.shared.peek(token: token)
            } catch let error as FileStoreError {
                let status = error == .error(message: ImportHandoff.oversizedImportMessage) ? 413 : 404
                let data = status == 413
                    ? Data(ImportHandoff.oversizedImportMessage.utf8)
                    : Data()

                DispatchQueue.main.async {
                    _ = self.finishIfLive(
                        task,
                        status: status,
                        data: data,
                        mimeType: "text/plain",
                        cacheControl: "no-store"
                    )
                }
                return
            } catch {
                #if DEBUG
                print("AppScheme import read failed: \(error.localizedDescription)")
                #endif

                DispatchQueue.main.async {
                    _ = self.finishIfLive(task, status: 404, data: Data(), mimeType: "text/plain")
                }
                return
            }

            DispatchQueue.main.async {
                guard let payload else {
                    _ = self.finishIfLive(task, status: 404, data: Data(), mimeType: "text/plain")
                    return
                }

                let didFinish = self.finishIfLive(
                    task,
                    status: 200,
                    data: payload.data,
                    mimeType: payload.mimeType,
                    cacheControl: "no-store"
                )

                if didFinish {
                    ImportHandoff.shared.release(token: token)
                }
            }
        }
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

    private func mimeType(forBundledResource url: URL) -> String {
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

    private func finishIfLive(
        _ task: WKURLSchemeTask,
        status: Int,
        data: Data,
        mimeType: String,
        cacheControl: String? = nil
    ) -> Bool {
        guard isTaskLive(task), let url = task.request.url else {
            return false
        }

        var headers: [String: String] = [
            "Content-Type": mimeType,
            "Content-Length": "\(data.count)",
            "Access-Control-Allow-Origin": "*",
        ]

        if let cacheControl {
            headers["Cache-Control"] = cacheControl
        }

        guard let response = HTTPURLResponse(
            url: url,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        ) else {
            failIfLive(task, error: NSError(domain: "AppSchemeHandler", code: -1))
            return false
        }

        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
        unmarkTaskLive(task)
        return true
    }

    private func failIfLive(_ task: WKURLSchemeTask, error: Error) {
        guard isTaskLive(task) else {
            return
        }

        task.didFailWithError(error)
        unmarkTaskLive(task)
    }

    private func markTaskLive(_ task: WKURLSchemeTask) {
        liveTasks.insert(Self.taskID(for: task))
    }

    private func unmarkTaskLive(_ task: WKURLSchemeTask) {
        liveTasks.remove(Self.taskID(for: task))
    }

    private func isTaskLive(_ task: WKURLSchemeTask) -> Bool {
        liveTasks.contains(Self.taskID(for: task))
    }

    private static func taskID(for task: WKURLSchemeTask) -> ObjectIdentifier {
        ObjectIdentifier(task as AnyObject)
    }

    private static func importToken(from url: URL) -> String? {
        guard url.path.hasPrefix(importPathPrefix) else {
            return nil
        }

        let token = String(url.path.dropFirst(importPathPrefix.count))
        return token.isEmpty ? nil : token
    }
}
