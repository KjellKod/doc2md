import AppKit
import Foundation

enum StoredTheme: String, Codable, Equatable {
    case light
    case dark
}

struct RecentFile: Codable, Equatable {
    let path: String
    let displayName: String
    let lastOpenedAt: String
}

struct PersistenceSettings: Codable, Equatable {
    var persistenceEnabled: Bool
    var theme: StoredTheme?
    var recentFiles: [RecentFile]

    private enum CodingKeys: String, CodingKey {
        case persistenceEnabled
        case theme
        case recentFiles
    }

    static let disabled = PersistenceSettings(
        persistenceEnabled: false,
        theme: nil,
        recentFiles: []
    )

    init(persistenceEnabled: Bool, theme: StoredTheme?, recentFiles: [RecentFile] = []) {
        self.persistenceEnabled = persistenceEnabled
        self.theme = theme
        self.recentFiles = recentFiles
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        persistenceEnabled = try container.decode(Bool.self, forKey: .persistenceEnabled)
        theme = try container.decodeIfPresent(StoredTheme.self, forKey: .theme)
        recentFiles = try container.decodeIfPresent([RecentFile].self, forKey: .recentFiles) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(persistenceEnabled, forKey: .persistenceEnabled)
        try container.encodeIfPresent(theme, forKey: .theme)
        try container.encode(recentFiles, forKey: .recentFiles)
    }
}

struct ShellPersistenceSettingsOk: Encodable {
    let ok = true
    let persistenceEnabled: Bool
    let theme: StoredTheme?
    let recentFiles: [RecentFile]

    init(settings: PersistenceSettings, recentFiles: [RecentFile]) {
        persistenceEnabled = settings.persistenceEnabled
        theme = settings.theme
        self.recentFiles = settings.persistenceEnabled ? recentFiles : []
    }
}

protocol RecentDocumentControlling {
    var recentDocumentURLs: [URL] { get }
    func noteNewRecentDocumentURL(_ url: URL)
    func clearRecentDocuments(_ sender: Any?)
}

extension NSDocumentController: RecentDocumentControlling {}

final class PersistenceStore {
    private static let maxRecentFiles = 10

    private let fileManager: FileManager
    private let settingsURL: URL
    private let recentDocumentController: RecentDocumentControlling

    init(
        fileManager: FileManager = .default,
        settingsURL: URL? = nil,
        recentDocumentController: RecentDocumentControlling = NSDocumentController.shared
    ) {
        self.fileManager = fileManager
        self.settingsURL = settingsURL ?? Self.defaultSettingsURL(fileManager: fileManager)
        self.recentDocumentController = recentDocumentController
    }

    func load() -> PersistenceSettings {
        do {
            let data = try Data(contentsOf: settingsURL)
            return try JSONDecoder().decode(PersistenceSettings.self, from: data)
        } catch {
            return .disabled
        }
    }

    func setPersistenceEnabled(_ enabled: Bool) throws -> PersistenceSettings {
        if !enabled {
            try removeSettingsFile()
            recentDocumentController.clearRecentDocuments(nil)
            return .disabled
        }

        var settings = load()
        settings.persistenceEnabled = true
        try write(settings)
        return settings
    }

    func setTheme(_ theme: StoredTheme) throws -> PersistenceSettings {
        var settings = load()
        guard settings.persistenceEnabled else {
            return .disabled
        }

        settings.theme = theme
        try write(settings)
        return settings
    }

    func clearRecentFiles() throws -> PersistenceSettings {
        var settings = load()
        guard settings.persistenceEnabled else {
            return .disabled
        }

        settings.recentFiles = []
        try write(settings)
        recentDocumentController.clearRecentDocuments(nil)
        return settings
    }

    func recentFiles(now: Date = Date()) -> [RecentFile] {
        let settings = load()
        guard settings.persistenceEnabled else {
            return []
        }

        let nativeRecentFiles = recentDocumentController.recentDocumentURLs
            .map { recentFile(for: $0, now: now) }
        return Self.dedupedRecentFiles(nativeRecentFiles + settings.recentFiles)
    }

    func recordRecentDocument(url: URL, now: Date = Date()) throws -> PersistenceSettings {
        var settings = load()
        guard settings.persistenceEnabled else {
            return .disabled
        }

        let recentFile = recentFile(for: url, now: now)
        settings.recentFiles = Self.dedupedRecentFiles([recentFile] + settings.recentFiles)
        try write(settings)
        recentDocumentController.noteNewRecentDocumentURL(url.standardizedFileURL)
        return settings
    }

    private func recentFile(for url: URL, now: Date) -> RecentFile {
        let standardizedPath = Self.standardPath(for: url)
        return RecentFile(
            path: standardizedPath,
            displayName: URL(fileURLWithPath: standardizedPath).lastPathComponent,
            lastOpenedAt: Self.timestamp(from: now)
        )
    }

    private func write(_ settings: PersistenceSettings) throws {
        do {
            let directory = settingsURL.deletingLastPathComponent()
            try fileManager.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )

            let data = try JSONEncoder().encode(settings)
            let tempURL = directory.appendingPathComponent(
                ".\(settingsURL.lastPathComponent).doc2md-\(UUID().uuidString).tmp"
            )
            var createdPlaceholder = false

            guard fileManager.createFile(atPath: tempURL.path, contents: data) else {
                throw FileStoreError.error(message: "Could not create a temporary settings file.")
            }

            do {
                if !fileManager.fileExists(atPath: settingsURL.path) {
                    // Keep writes on the narrow createFile + replaceItemAt API surface.
                    // If interruption leaves this empty placeholder, load() treats it as disabled.
                    guard fileManager.createFile(atPath: settingsURL.path, contents: Data()) else {
                        throw FileStoreError.error(message: "Could not prepare the settings file.")
                    }
                    createdPlaceholder = true
                }

                _ = try fileManager.replaceItemAt(
                    settingsURL,
                    withItemAt: tempURL,
                    backupItemName: nil,
                    options: []
                )
            } catch {
                if createdPlaceholder {
                    try? fileManager.removeItem(at: settingsURL)
                }
                try? fileManager.removeItem(at: tempURL)
                throw error
            }
        } catch let error as FileStoreError {
            throw error
        } catch {
            throw FileStoreError.error(message: "Could not update desktop persistence settings.")
        }
    }

    private func removeSettingsFile() throws {
        do {
            guard fileManager.fileExists(atPath: settingsURL.path) else {
                return
            }

            try fileManager.removeItem(at: settingsURL)
        } catch {
            throw FileStoreError.error(message: "Could not clear desktop persistence settings.")
        }
    }

    static func standardPath(for url: URL) -> String {
        URL(fileURLWithPath: url.path).standardizedFileURL.path
    }

    private static func dedupedRecentFiles(_ recentFiles: [RecentFile]) -> [RecentFile] {
        var seen = Set<String>()
        var result: [RecentFile] = []

        for recentFile in recentFiles {
            let standardizedPath = standardPath(for: URL(fileURLWithPath: recentFile.path))
            guard seen.insert(standardizedPath).inserted else {
                continue
            }

            result.append(
                RecentFile(
                    path: standardizedPath,
                    displayName: URL(fileURLWithPath: standardizedPath).lastPathComponent,
                    lastOpenedAt: recentFile.lastOpenedAt
                )
            )

            if result.count == maxRecentFiles {
                break
            }
        }

        return result
    }

    private static func defaultSettingsURL(fileManager: FileManager) -> URL {
        let applicationSupportURL = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)

        return applicationSupportURL
            .appendingPathComponent("doc2md", isDirectory: true)
            .appendingPathComponent("settings.json")
    }

    private static func timestamp(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
