import AppKit
import Foundation
import UniformTypeIdentifiers
import WebKit

final class ShellBridge: NSObject, WKScriptMessageHandler {
    private enum HandlerName {
        static let openFile = "doc2mdOpenFile"
        static let saveFile = "doc2mdSaveFile"
        static let saveFileAs = "doc2mdSaveFileAs"
        static let revealInFinder = "doc2mdRevealInFinder"
        static let statFile = "doc2mdStatFile"
        static let getPersistenceSettings = "doc2mdGetPersistenceSettings"
        static let setPersistenceEnabled = "doc2mdSetPersistenceEnabled"
        static let setPersistenceTheme = "doc2mdSetPersistenceTheme"
        static let clearRecentFiles = "doc2mdClearRecentFiles"
        static let getSessionState = "doc2mdGetSessionState"
        static let setSessionState = "doc2mdSetSessionState"

        static let all = [
            openFile,
            saveFile,
            saveFileAs,
            revealInFinder,
            statFile,
            getPersistenceSettings,
            setPersistenceEnabled,
            setPersistenceTheme,
            clearRecentFiles,
            getSessionState,
            setSessionState
        ]
    }

    private struct BridgeMessage {
        let id: String
        let args: Any?
    }

    private struct OpenFileArgs: Codable {
        let path: String?
    }

    private enum SaveFormat: String, Codable {
        case markdown
        case html
    }

    private struct SaveFileAsArgs: Codable {
        let suggestedName: String
        let content: String
        let lineEnding: ShellLineEnding
        // Optional, additive. Absent decodes to Markdown so existing Save As
        // behavior is unchanged.
        let format: SaveFormat?
    }

    private struct RevealInFinderArgs: Codable {
        let path: String
    }

    private struct StatFileArgs: Codable {
        let path: String
    }

    private struct SetPersistenceEnabledArgs: Codable {
        let enabled: Bool
    }

    private struct SetPersistenceThemeArgs: Codable {
        let theme: StoredTheme
    }

    private struct SetSessionStateArgs: Codable {
        let openPaths: [String]
        let selectedPath: String?
    }

    weak var webView: WKWebView?

    private let fileStore: FileStore
    private let persistenceStore: PersistenceStore
    private let sessionStore: SessionStore
    private let licenseReminderController: LicenseReminderController?
    private var knownURLsByPath: [String: URL] = [:]
    private var restoreCandidatePaths: Set<String> = []
    private var nativeRecentOpenPaths: Set<String> = []
    private var sessionSyncSuppressedPaths: Set<String> = []
    private var lastDirectoryURL: URL?

    init(
        fileStore: FileStore = FileStore(),
        persistenceStore: PersistenceStore = PersistenceStore(),
        sessionStore: SessionStore = SessionStore(),
        licenseReminderController: LicenseReminderController? = nil
    ) {
        self.fileStore = fileStore
        self.persistenceStore = persistenceStore
        self.sessionStore = sessionStore
        self.licenseReminderController = licenseReminderController
        super.init()
        seedRestoreCandidatePaths()
    }

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
        case HandlerName.statFile:
            handleStatFile(bridgeMessage)
        case HandlerName.getPersistenceSettings:
            handleGetPersistenceSettings(bridgeMessage)
        case HandlerName.setPersistenceEnabled:
            handleSetPersistenceEnabled(bridgeMessage)
        case HandlerName.setPersistenceTheme:
            handleSetPersistenceTheme(bridgeMessage)
        case HandlerName.clearRecentFiles:
            handleClearRecentFiles(bridgeMessage)
        case HandlerName.getSessionState:
            handleGetSessionState(bridgeMessage)
        case HandlerName.setSessionState:
            handleSetSessionState(bridgeMessage)
        default:
            resolve(
                id: bridgeMessage.id,
                result: ShellCallResult.error(message: "Unknown shell handler.")
            )
        }
    }

    private func handleOpenFile(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(OpenFileArgs.self, from: message.args)
            let url: URL

            if let path = args.path {
                let standardizedPath = Self.standardPath(path)
                if let knownURL = knownURLsByPath[standardizedPath] {
                    url = knownURL
                } else if restoreCandidatePaths.contains(standardizedPath),
                          sessionStore.isRestoreEligiblePath(standardizedPath) {
                    url = URL(fileURLWithPath: standardizedPath)
                } else if nativeRecentOpenPaths.contains(standardizedPath),
                          Self.isSupportedExistingFilePath(standardizedPath) {
                    url = URL(fileURLWithPath: standardizedPath)
                } else {
                    resolve(
                        id: message.id,
                        result: ShellCallResult.permissionNeeded(
                            path: path,
                            message: "Open the file again before reloading it."
                        )
                    )
                    return
                }
            } else {
                let panel = NSOpenPanel()
                panel.canChooseDirectories = false
                panel.canChooseFiles = true
                panel.allowsMultipleSelection = false
                panel.directoryURL = lastDirectoryURL
                panel.allowedContentTypes = Self.openContentTypes

                guard panel.runModal() == .OK else {
                    throw FileStoreError.cancelled
                }

                url = try FileStore.selectedURL(from: panel.url)
            }

            let standardizedURL = url.standardizedFileURL
            let fileExtension = standardizedURL.pathExtension.lowercased()

            if Self.markdownDirectExtensions.contains(fileExtension) {
                let result = try openMarkdownURL(standardizedURL)
                resolve(id: message.id, result: ShellCallResult.openMarkdown(result))
                return
            }

            guard SupportedFormats.supportedNonMarkdownExtensions.contains(fileExtension) else {
                throw FileStoreError.error(message: "The selected file type is not supported.")
            }

            let ticket = try ImportHandoff.shared.enqueue(url: standardizedURL)
            rememberLastDirectory(from: standardizedURL)
            recordRecentDocumentIfEnabled(url: standardizedURL)
            // Import-source handoff URLs are intentionally not remembered as
            // directly editable paths; only `.md` targets belong in knownURLsByPath.
            let openImportResult = ShellOpenImportOk(
                ok: true,
                kind: "import-source",
                path: ticket.path,
                name: ticket.name,
                format: ticket.format,
                mtimeMs: ticket.mtimeMs,
                importUrl: ImportHandoff.importURL(for: ticket.token),
                mimeType: ticket.mimeType
            )
            resolve(id: message.id, result: ShellCallResult.openImport(openImportResult))
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    // Shared entry point for Finder / Open With / drag-onto-icon opens. It
    // reuses the exact File > Open Markdown logic (security scope, FileStore
    // open, remember, record recent) so external opens behave identically to
    // menu opens. Non-Markdown external URLs are rejected with an error result
    // rather than routed through the import handoff: Finder association is
    // Markdown only, so anything else here is unexpected and should surface a
    // clear message instead of an empty window.
    func openExternalMarkdownURL(_ url: URL) -> ShellCallResult {
        let standardizedURL = url.standardizedFileURL
        let fileExtension = standardizedURL.pathExtension.lowercased()

        guard Self.markdownDirectExtensions.contains(fileExtension) else {
            return ShellCallResult.error(
                message: "doc2md can only open Markdown files (.md, .markdown)."
            )
        }

        do {
            let result = try openMarkdownURL(standardizedURL)
            return ShellCallResult.openMarkdown(result)
        } catch {
            return Self.response(for: error)
        }
    }

    private func openMarkdownURL(_ standardizedURL: URL) throws -> ShellOpenMarkdownOk {
        let result = try withSecurityScope(for: standardizedURL) {
            try fileStore.open(url: standardizedURL)
        }
        remember(url: standardizedURL)
        recordRecentDocumentIfEnabled(url: standardizedURL)
        return result
    }

    private func handleSaveFile(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(SaveFileArgs.self, from: message.args)
            guard let knownURL = knownURLsByPath[Self.standardPath(args.path)] else {
                resolve(
                    id: message.id,
                    result: ShellCallResult.permissionNeeded(
                        path: args.path,
                        message: "Open the file again before saving it."
                    )
                )
                return
            }

            try FileStore.validateMarkdownSaveTarget(url: knownURL)
            let result = try withSecurityScope(for: knownURL) {
                try fileStore.save(args: args, knownURL: knownURL)
            }

            remember(url: knownURL)
            recordRecentDocumentIfEnabled(url: knownURL)
            resolve(id: message.id, result: ShellCallResult.save(result)) { [weak self] in
                self?.licenseReminderController?.recordSuccessfulSave()
            }
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleSaveFileAs(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(SaveFileAsArgs.self, from: message.args)

            if args.format == .html {
                try handleSaveFileAsHtml(message: message, args: args)
                return
            }

            let panel = NSSavePanel()
            panel.nameFieldStringValue = args.suggestedName
            panel.directoryURL = lastDirectoryURL
            panel.allowedContentTypes = Self.saveContentTypes
            panel.canCreateDirectories = true

            guard panel.runModal() == .OK else {
                throw FileStoreError.cancelled
            }

            let url = try FileStore.selectedURL(from: panel.url)
            try FileStore.validateMarkdownSaveTarget(url: url)
            let result = try withSecurityScope(for: url) {
                try fileStore.saveAs(
                    url: url,
                    content: args.content,
                    lineEnding: args.lineEnding
                )
            }

            remember(url: url)
            recordRecentDocumentIfEnabled(url: url)
            resolve(id: message.id, result: ShellCallResult.save(result)) { [weak self] in
                self?.licenseReminderController?.recordSuccessfulSave()
            }
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    // HTML export save-as. Deliberately skips every Markdown-only side effect
    // so exporting HTML cannot corrupt the active Markdown document's state:
    //   - no validateMarkdownSaveTarget (uses the HTML validator instead)
    //   - no remember(url:)        — the .html file is not an editable doc
    //   - no recordRecentDocumentIfEnabled — HTML is not a recent Markdown doc
    //   - no licenseReminderController.recordSuccessfulSave — not a Markdown save
    private func handleSaveFileAsHtml(message: BridgeMessage, args: SaveFileAsArgs) throws {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = args.suggestedName
        panel.directoryURL = lastDirectoryURL
        panel.allowedContentTypes = Self.htmlSaveContentTypes
        panel.canCreateDirectories = true

        guard panel.runModal() == .OK else {
            throw FileStoreError.cancelled
        }

        let url = try FileStore.selectedURL(from: panel.url)
        try FileStore.validateHtmlSaveTarget(url: url)
        let result = try withSecurityScope(for: url) {
            try fileStore.saveAs(
                url: url,
                content: args.content,
                lineEnding: args.lineEnding,
                validate: FileStore.validateHtmlSaveTarget
            )
        }

        // Only update the last-used directory; do NOT remember the path as an
        // editable Markdown target or record it in recents.
        rememberLastDirectory(from: url)
        resolve(id: message.id, result: ShellCallResult.save(result))
    }

    private func handleRevealInFinder(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(RevealInFinderArgs.self, from: message.args)
            let knownURL = knownURLsByPath[Self.standardPath(args.path)]
            let url = knownURL ?? URL(fileURLWithPath: args.path)
            let result = try withSecurityScope(for: url) {
                try fileStore.reveal(path: url.path)
            }

            resolve(id: message.id, result: ShellCallResult.reveal(result))
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleStatFile(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(StatFileArgs.self, from: message.args)
            guard let knownURL = knownURLsByPath[Self.standardPath(args.path)] else {
                resolve(
                    id: message.id,
                    result: ShellCallResult.permissionNeeded(
                        path: args.path,
                        message: "Open the file again before checking it."
                    )
                )
                return
            }

            let result = try withSecurityScope(for: knownURL) {
                try fileStore.stat(url: knownURL)
            }

            resolve(id: message.id, result: ShellCallResult.stat(result))
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleGetPersistenceSettings(_ message: BridgeMessage) {
        let settings = persistenceStore.load()
        resolve(
            id: message.id,
            result: ShellPersistenceSettingsOk(
                settings: settings,
                recentFiles: persistenceStore.recentFiles()
            )
        )
    }

    private func handleSetPersistenceEnabled(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(SetPersistenceEnabledArgs.self, from: message.args)
            let settings = try persistenceStore.setPersistenceEnabled(args.enabled)
            if !args.enabled {
                try sessionStore.clear()
                restoreCandidatePaths.removeAll()
                nativeRecentOpenPaths.removeAll()
                sessionSyncSuppressedPaths.removeAll()
            } else {
                sessionSyncSuppressedPaths.removeAll()
                seedRestoreCandidatePaths()
            }
            resolve(
                id: message.id,
                result: ShellPersistenceSettingsOk(
                    settings: settings,
                    recentFiles: persistenceStore.recentFiles()
                )
            )
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleSetPersistenceTheme(_ message: BridgeMessage) {
        do {
            let args = try Self.decode(SetPersistenceThemeArgs.self, from: message.args)
            let settings = try persistenceStore.setTheme(args.theme)
            resolve(
                id: message.id,
                result: ShellPersistenceSettingsOk(
                    settings: settings,
                    recentFiles: persistenceStore.recentFiles()
                )
            )
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleClearRecentFiles(_ message: BridgeMessage) {
        do {
            let settings = try persistenceStore.clearRecentFiles()
            try sessionStore.clear()
            sessionSyncSuppressedPaths.formUnion(knownURLsByPath.keys)
            restoreCandidatePaths.removeAll()
            nativeRecentOpenPaths.removeAll()
            resolve(
                id: message.id,
                result: ShellPersistenceSettingsOk(
                    settings: settings,
                    recentFiles: persistenceStore.recentFiles()
                )
            )
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleGetSessionState(_ message: BridgeMessage) {
        do {
            guard persistenceStore.load().persistenceEnabled else {
                resolve(
                    id: message.id,
                    result: ShellSessionStateOk(
                        openPaths: [],
                        selectedPath: nil,
                        recentFiles: []
                    )
                )
                return
            }

            let state = try sessionStore.loadAndPrune()
            state.openPaths.forEach { restoreCandidatePaths.insert($0) }
            resolve(
                id: message.id,
                result: ShellSessionStateOk(
                    openPaths: state.openPaths,
                    selectedPath: state.selectedPath,
                    recentFiles: persistenceStore.recentFiles()
                )
            )
        } catch {
            resolve(id: message.id, result: Self.response(for: error))
        }
    }

    private func handleSetSessionState(_ message: BridgeMessage) {
        do {
            guard persistenceStore.load().persistenceEnabled else {
                resolve(
                    id: message.id,
                    result: ShellSessionStateOk(
                        openPaths: [],
                        selectedPath: nil,
                        recentFiles: []
                    )
                )
                return
            }

            let args = try Self.decode(SetSessionStateArgs.self, from: message.args)
            let trustedKnownPaths = Set(knownURLsByPath.keys).subtracting(sessionSyncSuppressedPaths)
            let trustedPaths = trustedKnownPaths.union(restoreCandidatePaths)
            let state = try sessionStore.writeTrusted(
                openPaths: args.openPaths,
                selectedPath: args.selectedPath,
                trustedPaths: trustedPaths
            )
            resolve(
                id: message.id,
                result: ShellSessionStateOk(
                    openPaths: state.openPaths,
                    selectedPath: state.selectedPath,
                    recentFiles: persistenceStore.recentFiles()
                )
            )
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

    private func recordRecentDocumentIfEnabled(url: URL) {
        do {
            let settings = try persistenceStore.recordRecentDocument(url: url)
            if settings.persistenceEnabled {
                let standardizedPath = url.standardizedFileURL.path
                sessionSyncSuppressedPaths.remove(standardizedPath)
                if Self.isSupportedExistingFilePath(standardizedPath) {
                    nativeRecentOpenPaths.insert(standardizedPath)
                }
            }
        } catch {
            #if DEBUG
            print("ShellBridge failed to record recent file: \(error.localizedDescription)")
            #endif
        }
    }

    private func remember(url: URL) {
        let standardizedPath = url.standardizedFileURL.path
        knownURLsByPath[standardizedPath] = url
        restoreCandidatePaths.remove(standardizedPath)
        rememberLastDirectory(from: url)
    }

    private func seedRestoreCandidatePaths() {
        guard persistenceStore.load().persistenceEnabled else {
            restoreCandidatePaths.removeAll()
            nativeRecentOpenPaths.removeAll()
            return
        }

        let sessionState = (try? sessionStore.loadAndPrune()) ?? DesktopSessionState(
            openPaths: [],
            selectedPath: nil
        )
        let sessionPaths = sessionState.openPaths
        let recentPaths = persistenceStore.recentFiles().map(\.path)
        restoreCandidatePaths = Set(sessionPaths.filter {
            sessionStore.isRestoreEligiblePath($0)
        })
        nativeRecentOpenPaths = Set(recentPaths.filter(Self.isSupportedExistingFilePath))
    }

    private func rememberLastDirectory(from url: URL) {
        lastDirectoryURL = url.deletingLastPathComponent()
    }

    func rememberOpenPanelSelection(_ urls: [URL]) {
        guard let firstURL = urls.first else {
            return
        }

        rememberLastDirectory(from: firstURL.standardizedFileURL)
    }

    private func resolve<T: Encodable>(id: String, result: T, completion: (() -> Void)? = nil) {
        do {
            let resultJSON = try Self.encodeJSON(result)
            let idJSON = try Self.encodeJSON(id)
            let script = "window.__doc2mdShellResolve(\(idJSON), \(resultJSON));"

            DispatchQueue.main.async { [weak self] in
                guard let webView = self?.webView else {
                    return
                }
                webView.evaluateJavaScript(script) { _, error in
                    if error == nil {
                        completion?()
                    }
                }
            }
        } catch {
            #if DEBUG
            print("ShellBridge failed to encode result: \(error.localizedDescription)")
            #endif
        }
    }

    // Single JSON encoding path shared by `resolve()` (window.__doc2mdShellResolve)
    // and the external-open event detail in ExternalOpenRouter, so both emit a
    // byte-identical encoding of the same ShellCallResult shape.
    static func encodeJSON<T: Encodable>(_ value: T) throws -> String {
        let data = try JSONEncoder().encode(value)
        guard let json = String(data: data, encoding: .utf8) else {
            throw FileStoreError.error(message: "Failed to encode native result as JSON.")
        }
        return json
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

    private static func isSupportedExistingFilePath(_ path: String) -> Bool {
        let standardizedPath = standardPath(path)
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(
            atPath: standardizedPath,
            isDirectory: &isDirectory
        ), !isDirectory.boolValue else {
            return false
        }

        let fileExtension = URL(fileURLWithPath: standardizedPath).pathExtension.lowercased()
        return allSupportedOpenExtensions.contains(fileExtension)
    }

    private static let markdownDirectExtensions = ["md", "markdown"]
    private static let allSupportedOpenExtensions = Set(SupportedFormats.allSupportedExtensions)
    private static let openContentTypes = contentTypes(forExtensions: SupportedFormats.allSupportedExtensions)
    private static let saveContentTypes = contentTypes(forExtensions: [FileStore.markdownSaveExtension])
    private static let htmlSaveContentTypes = contentTypes(forExtensions: [FileStore.htmlSaveExtension])

    private static func contentTypes(forExtensions extensions: [String]) -> [UTType] {
        var seenIdentifiers = Set<String>()

        return extensions.compactMap { fileExtension in
            guard let type = UTType(filenameExtension: fileExtension) else {
                return nil
            }

            guard seenIdentifiers.insert(type.identifier).inserted else {
                return nil
            }

            return type
        }
    }

    private static let scriptSource = #"""
(() => {
  if (window.doc2mdShell && window.doc2mdShell.version === 2) {
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
      version: 2,
      openFile: (args) => callShell("doc2mdOpenFile", args ?? null),
      saveFile: (args) => callShell("doc2mdSaveFile", args),
      saveFileAs: (args) => callShell("doc2mdSaveFileAs", args),
      revealInFinder: (args) => callShell("doc2mdRevealInFinder", args),
      statFile: (args) => callShell("doc2mdStatFile", args),
      getPersistenceSettings: () => callShell("doc2mdGetPersistenceSettings", null),
      setPersistenceEnabled: (args) => callShell("doc2mdSetPersistenceEnabled", args),
      setPersistenceTheme: (args) => callShell("doc2mdSetPersistenceTheme", args),
      clearRecentFiles: () => callShell("doc2mdClearRecentFiles", null),
      getSessionState: () => callShell("doc2mdGetSessionState", null),
      setSessionState: (args) => callShell("doc2mdSetSessionState", args)
    }
  });
})();
"""#
}

struct ShellCallResult: Encodable {
    let ok: Bool
    let kind: String?
    let path: String?
    let name: String?
    let format: String?
    let mtimeMs: Int64?
    let content: String?
    let lineEnding: ShellLineEnding?
    let importUrl: String?
    let mimeType: String?
    let code: String?
    let actualMtimeMs: Int64?
    let message: String?

    static func openMarkdown(_ result: ShellOpenMarkdownOk) -> ShellCallResult {
        ShellCallResult(
            ok: true,
            kind: result.kind,
            path: result.path,
            name: nil,
            format: nil,
            mtimeMs: result.mtimeMs,
            content: result.content,
            lineEnding: result.lineEnding,
            importUrl: nil,
            mimeType: nil,
            code: nil,
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func openImport(_ result: ShellOpenImportOk) -> ShellCallResult {
        ShellCallResult(
            ok: true,
            kind: result.kind,
            path: result.path,
            name: result.name,
            format: result.format,
            mtimeMs: result.mtimeMs,
            content: nil,
            lineEnding: nil,
            importUrl: result.importUrl,
            mimeType: result.mimeType,
            code: nil,
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func save(_ result: ShellSaveOk) -> ShellCallResult {
        ShellCallResult(
            ok: true,
            kind: nil,
            path: result.path,
            name: nil,
            format: nil,
            mtimeMs: result.mtimeMs,
            content: nil,
            lineEnding: nil,
            importUrl: nil,
            mimeType: nil,
            code: nil,
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func reveal(_ result: ShellRevealOk) -> ShellCallResult {
        ShellCallResult(
            ok: true,
            kind: nil,
            path: result.path,
            name: nil,
            format: nil,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            importUrl: nil,
            mimeType: nil,
            code: nil,
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func stat(_ result: ShellStatOk) -> ShellCallResult {
        ShellCallResult(
            ok: true,
            kind: nil,
            path: result.path,
            name: nil,
            format: nil,
            mtimeMs: result.mtimeMs,
            content: nil,
            lineEnding: nil,
            importUrl: nil,
            mimeType: nil,
            code: nil,
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func cancelled() -> ShellCallResult {
        ShellCallResult(
            ok: false,
            kind: nil,
            path: nil,
            name: nil,
            format: nil,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            importUrl: nil,
            mimeType: nil,
            code: "cancelled",
            actualMtimeMs: nil,
            message: nil
        )
    }

    static func conflict(path: String, actualMtimeMs: Int64) -> ShellCallResult {
        ShellCallResult(
            ok: false,
            kind: nil,
            path: path,
            name: nil,
            format: nil,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            importUrl: nil,
            mimeType: nil,
            code: "conflict",
            actualMtimeMs: actualMtimeMs,
            message: nil
        )
    }

    static func permissionNeeded(path: String?, message: String) -> ShellCallResult {
        ShellCallResult(
            ok: false,
            kind: nil,
            path: path,
            name: nil,
            format: nil,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            importUrl: nil,
            mimeType: nil,
            code: "permission-needed",
            actualMtimeMs: nil,
            message: message
        )
    }

    static func error(message: String) -> ShellCallResult {
        ShellCallResult(
            ok: false,
            kind: nil,
            path: nil,
            name: nil,
            format: nil,
            mtimeMs: nil,
            content: nil,
            lineEnding: nil,
            importUrl: nil,
            mimeType: nil,
            code: "error",
            actualMtimeMs: nil,
            message: message
        )
    }
}
