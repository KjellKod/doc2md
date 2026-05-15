import Foundation

struct DesktopSessionState: Codable, Equatable {
    var openPaths: [String]
    var selectedPath: String?
}

struct ShellSessionStateOk: Encodable {
    let ok = true
    let openPaths: [String]
    let selectedPath: String?
    let recentFiles: [RecentFile]
}

final class SessionStore {
    private let fileManager: FileManager
    private let sessionURL: URL

    init(fileManager: FileManager = .default, sessionURL: URL? = nil) {
        self.fileManager = fileManager
        self.sessionURL = sessionURL ?? Self.defaultSessionURL(fileManager: fileManager)
    }

    func loadAndPrune() throws -> DesktopSessionState {
        let loaded = load()
        let pruned = prunedState(from: loaded)
        if pruned != loaded {
            try write(pruned)
        }
        return pruned
    }

    func write(openPaths: [String], selectedPath: String?) throws -> DesktopSessionState {
        let state = prunedState(
            from: DesktopSessionState(
                openPaths: Self.uniqueStandardPaths(openPaths),
                selectedPath: selectedPath.map(Self.standardPath)
            )
        )
        try write(state)
        return state
    }

    func writeTrusted(
        openPaths: [String],
        selectedPath: String?,
        trustedPaths: Set<String>
    ) throws -> DesktopSessionState {
        let standardizedTrustedPaths = Set(trustedPaths.map(Self.standardPath))
        let trustedOpenPaths = openPaths
            .map(Self.standardPath)
            .filter { standardizedTrustedPaths.contains($0) }
        let trustedSelectedPath = selectedPath.map(Self.standardPath).flatMap { path in
            standardizedTrustedPaths.contains(path) ? path : nil
        }

        return try write(openPaths: trustedOpenPaths, selectedPath: trustedSelectedPath)
    }

    func clear() throws {
        do {
            guard fileManager.fileExists(atPath: sessionURL.path) else {
                return
            }

            try fileManager.removeItem(at: sessionURL)
        } catch {
            throw FileStoreError.error(message: "Could not clear desktop session state.")
        }
    }

    func isRestoreEligiblePath(_ path: String) -> Bool {
        Self.isMarkdownPath(path) && fileExists(at: path)
    }

    private func load() -> DesktopSessionState {
        do {
            let data = try Data(contentsOf: sessionURL)
            return try JSONDecoder().decode(DesktopSessionState.self, from: data)
        } catch {
            return DesktopSessionState(openPaths: [], selectedPath: nil)
        }
    }

    private func write(_ state: DesktopSessionState) throws {
        do {
            let directory = sessionURL.deletingLastPathComponent()
            try fileManager.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )

            let data = try JSONEncoder().encode(state)
            let tempURL = directory.appendingPathComponent(
                ".\(sessionURL.lastPathComponent).doc2md-\(UUID().uuidString).tmp"
            )
            var createdPlaceholder = false

            guard fileManager.createFile(atPath: tempURL.path, contents: data) else {
                throw FileStoreError.error(message: "Could not create a temporary session file.")
            }

            do {
                if !fileManager.fileExists(atPath: sessionURL.path) {
                    guard fileManager.createFile(atPath: sessionURL.path, contents: Data()) else {
                        throw FileStoreError.error(message: "Could not prepare the session file.")
                    }
                    createdPlaceholder = true
                }

                _ = try fileManager.replaceItemAt(
                    sessionURL,
                    withItemAt: tempURL,
                    backupItemName: nil,
                    options: []
                )
            } catch {
                if createdPlaceholder {
                    try? fileManager.removeItem(at: sessionURL)
                }
                try? fileManager.removeItem(at: tempURL)
                throw error
            }
        } catch let error as FileStoreError {
            throw error
        } catch {
            throw FileStoreError.error(message: "Could not update desktop session state.")
        }
    }

    private func prunedState(from state: DesktopSessionState) -> DesktopSessionState {
        let openPaths = Self.uniqueStandardPaths(state.openPaths)
            .filter(isRestoreEligiblePath)
        let openPathSet = Set(openPaths)
        let selectedPath = state.selectedPath.map(Self.standardPath).flatMap { path in
            openPathSet.contains(path) ? path : nil
        }

        return DesktopSessionState(openPaths: openPaths, selectedPath: selectedPath)
    }

    private func fileExists(at path: String) -> Bool {
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: Self.standardPath(path), isDirectory: &isDirectory) else {
            return false
        }
        return !isDirectory.boolValue
    }

    static func isMarkdownPath(_ path: String) -> Bool {
        let fileExtension = URL(fileURLWithPath: path).pathExtension.lowercased()
        return fileExtension == "md" || fileExtension == "markdown"
    }

    static func standardPath(_ path: String) -> String {
        URL(fileURLWithPath: path).standardizedFileURL.path
    }

    private static func uniqueStandardPaths(_ paths: [String]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []

        for path in paths {
            let standardized = standardPath(path)
            guard seen.insert(standardized).inserted else {
                continue
            }
            result.append(standardized)
        }

        return result
    }

    private static func defaultSessionURL(fileManager: FileManager) -> URL {
        let applicationSupportURL = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)

        return applicationSupportURL
            .appendingPathComponent("doc2md", isDirectory: true)
            .appendingPathComponent("session.json")
    }
}
