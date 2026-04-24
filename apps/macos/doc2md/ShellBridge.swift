import AppKit
import Foundation
import WebKit

final class ShellBridge: NSObject, WKScriptMessageHandler {
    private enum HandlerName {
        static let openFile = "doc2mdOpenFile"
        static let saveFile = "doc2mdSaveFile"
        static let saveFileAs = "doc2mdSaveFileAs"
        static let revealInFinder = "doc2mdRevealInFinder"

        static let all = [
            openFile,
            saveFile,
            saveFileAs,
            revealInFinder
        ]
    }

    private struct BridgeMessage {
        let id: String
        let args: Any?
    }

    private struct OpenFileArgs: Codable {
        let path: String?
    }

    private struct SaveFileAsArgs: Codable {
        let suggestedName: String
        let content: String
        let lineEnding: ShellLineEnding
    }

    private struct RevealInFinderArgs: Codable {
        let path: String
    }

    weak var webView: WKWebView?

    private let fileStore = FileStore()
    private var knownURLsByPath: [String: URL] = [:]
    private var lastDirectoryURL: URL?

    func install(on userContentController: WKUserContentController) {
        let script = WKUserScript(
            source: Self.scriptSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )

        userContentController.addUserScript(script)

        for name in HandlerName.all {
            userContentController.add(self, name: name)
        }
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard HandlerName.all.contains(message.name),
              let bridgeMessage = Self.bridgeMessage(from: message.body)
        else {
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.handle(messageName: message.name, bridgeMessage: bridgeMessage)
        }
    }

    private func handle(messageName: String, bridgeMessage: BridgeMessage) {
        switch messageName {
        case HandlerName.openFile:
            handleOpenFile(bridgeMessage)
        case HandlerName.saveFile:
            handleSaveFile(bridgeMessage)
        case HandlerName.saveFileAs:
            handleSaveFileAs(bridgeMessage)
        case HandlerName.revealInFinder:
            handleRevealInFinder(bridgeMessage)
        default:
            resolve(id: bridgeMessage.id, result: .error(message: "Unknown shell handler."))
        }
    }

    private func handleOpenFile(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(OpenFileArgs.self, from: message.args)
            let url: URL

            if let path = args.path {
                guard let knownURL = knownURLsByPath[Self.standardPath(path)] else {
                    resolve(
                        id: message.id,
                        result: .permissionNeeded(
                            path: path,
                            message: "Open the file again before reloading it."
                        )
                    )
                    return
                }
                url = knownURL
            } else {
                let panel = NSOpenPanel()
                panel.canChooseDirectories = false
                panel.canChooseFiles = true
                panel.allowsMultipleSelection = false
                panel.directoryURL = lastDirectoryURL
                panel.allowedFileTypes = Self.markdownFileExtensions

                guard panel.runModal() == .OK else {
                    throw FileStoreError.cancelled
                }

                url = try FileStore.selectedURL(from: panel.url)
            }

            let result = try withSecurityScope(for: url) {
                try fileStore.open(url: url)
            }
            remember(url: url)
            resolve(id: message.id, result: .open(result))
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleSaveFile(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(SaveFileArgs.self, from: message.args)
            guard let knownURL = knownURLsByPath[Self.standardPath(args.path)] else {
                resolve(
                    id: message.id,
                    result: .permissionNeeded(
                        path: args.path,
                        message: "Open the file again before saving it."
                    )
                )
                return
            }

            let result = try withSecurityScope(for: knownURL) {
                try fileStore.save(args: args, knownURL: knownURL)
            }

            remember(url: knownURL)
            resolve(id: message.id, result: .save(result))
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleSaveFileAs(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(SaveFileAsArgs.self, from: message.args)
            let panel = NSSavePanel()
            panel.nameFieldStringValue = args.suggestedName
            panel.directoryURL = lastDirectoryURL
            panel.allowedFileTypes = Self.markdownFileExtensions
            panel.canCreateDirectories = true

            guard panel.runModal() == .OK else {
                throw FileStoreError.cancelled
            }

            let url = try FileStore.selectedURL(from: panel.url)
            let result = try withSecurityScope(for: url) {
                try fileStore.saveAs(
                    url: url,
                    content: args.content,
                    lineEnding: args.lineEnding
                )
            }

            remember(url: url)
            resolve(id: message.id, result: .save(result))
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleRevealInFinder(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(RevealInFinderArgs.self, from: message.args)
            let knownURL = knownURLsByPath[Self.standardPath(args.path)]
            let url = knownURL ?? URL(fileURLWithPath: args.path)
            let result = try withSecurityScope(for: url) {
                try fileStore.reveal(path: url.path)
            }

            resolve(id: message.id, result: .reveal(result))
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func withSecurityScope<T>(for url: URL, operation: () throws -> T) throws -> T {
        let started = url.startAccessingSecurityScopedResource()
        defer {
            if started {
                url.stopAccessingSecurityScopedResource()
            }
        }

        return try operation()
    }

    private func remember(url: URL) {
        knownURLsByPath[url.standardizedFileURL.path] = url
        lastDirectoryURL = url.deletingLastPathComponent()
    }

    private func resolve(id: String, result: ShellCallResult) {
        do {
            let encoder = JSONEncoder()
            let idData = try encoder.encode(id)
            let resultData = try encoder.encode(result)
            guard let idJSON = String(data: idData, encoding: .utf8),
                  let resultJSON = String(data: resultData, encoding: .utf8)
            else {
                return
            }

            let script = "window.__doc2mdShellResolve(\(idJSON), \(resultJSON));"

            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(script)
            }
        } catch {
            #if DEBUG
            print("ShellBridge failed to encode result: \(error.localizedDescription)")
            #endif
        }
    }

    private static func bridgeMessage(from body: Any) -> BridgeMessage? {
        guard let dictionary = body as? [String: Any],
              let id = dictionary["id"] as? String
        else {
            return nil
        }

        return BridgeMessage(id: id, args: dictionary["args"])
    }

    private static func decode<T: Decodable>(_ type: T.Type, from args: Any?) throws -> T {
        if args == nil || args is NSNull {
            return try JSONDecoder().decode(T.self, from: Data("{}".utf8))
        }

        guard JSONSerialization.isValidJSONObject(args as Any) else {
            throw FileStoreError.error(message: "Invalid native request payload.")
        }

        let data = try JSONSerialization.data(withJSONObject: args as Any)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func response(for error: Error) -> ShellCallResult {
        if let fileError = error as? FileStoreError {
            switch fileError {
            case .cancelled:
                return .cancelled()
            case .conflict(let path, let actualMtimeMs):
                return .conflict(path: path, actualMtimeMs: actualMtimeMs)
            case .permissionNeeded(let path, let message):
                return .permissionNeeded(path: path, message: message)
            case .error(let message):
                return .error(message: message)
            }
        }

        return .error(message: error.localizedDescription)
    }

    private static func standardPath(_ path: String) -> String {
        URL(fileURLWithPath: path).standardizedFileURL.path
    }

    private static let markdownFileExtensions = ["md", "markdown", "txt"]

    private static let scriptSource = #"""
(() => {
  if (window.doc2mdShell && window.doc2mdShell.version === 1) {
    return;
  }

  const pending = new Map();

  const callShell = (handlerName, args) => {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pending.set(id, resolve);

      try {
        window.webkit.messageHandlers[handlerName].postMessage({
          id,
          args: args ?? null
        });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  };

  Object.defineProperty(window, "__doc2mdShellResolve", {
    configurable: true,
    value: (id, result) => {
      const resolve = pending.get(id);
      if (!resolve) {
        return;
      }

      pending.delete(id);
      resolve(result);
    }
  });

  Object.defineProperty(window, "doc2mdShell", {
    configurable: true,
    value: {
      version: 1,
      openFile: (args) => callShell("doc2mdOpenFile", args ?? null),
      saveFile: (args) => callShell("doc2mdSaveFile", args),
      saveFileAs: (args) => callShell("doc2mdSaveFileAs", args),
      revealInFinder: (args) => callShell("doc2mdRevealInFinder", args)
    }
  });
})();
"""#
}

private struct ShellCallResult: Encodable {
    let ok: Bool
    let path: String?
    let mtimeMs: Int64?
    let content: String?
    let lineEnding: ShellLineEnding?
    let code: String?
    let actualMtimeMs: Int64?
    let message: String?

    static func open(_ result: ShellOpenOk) -> ShellCallResult {
        ShellCallResult(
            ok: true,
            path: result.path,
            mtimeMs: result.mtimeMs,
            content: result.content,
            lineEnding: result.lineEnding,
            code: nil,
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func save(_ result: ShellSaveOk) -> ShellCallResult {
        ShellCallResult(
            ok: true,
            path: result.path,
            mtimeMs: result.mtimeMs,
            content: nil,
            lineEnding: nil,
            code: nil,
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func reveal(_ result: ShellRevealOk) -> ShellCallResult {
        ShellCallResult(
            ok: true,
            path: result.path,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            code: nil,
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func cancelled() -> ShellCallResult {
        ShellCallResult(
            ok: false,
            path: nil,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            code: "cancelled",
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func conflict(path: String, actualMtimeMs: Int64) -> ShellCallResult {
        ShellCallResult(
            ok: false,
            path: path,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            code: "conflict",
            actualMtimeMs: actualMtimeMs,
            message: nil
        )
    }

    static func permissionNeeded(path: String?, message: String) -> ShellCallResult {
        ShellCallResult(
            ok: false,
            path: path,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            code: "permission-needed",
            actualMtimeMs: nil,
            message: message
        )
    }

    static func error(message: String) -> ShellCallResult {
        ShellCallResult(
            ok: false,
            path: nil,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            code: "error",
            actualMtimeMs: nil,
            message: message
        )
    }
}
