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

    static let disabled = PersistenceSettings(
        persistenceEnabled: false,
        theme: nil,
        recentFiles: []
    )
}

struct ShellPersistenceSettingsOk: Encodable {
    let ok = true
    let persistenceEnabled: Bool
    let theme: StoredTheme?
    let recentFiles: [RecentFile]

    init(settings: PersistenceSettings) {
        persistenceEnabled = settings.persistenceEnabled
        theme = settings.theme
        recentFiles = settings.recentFiles
    }
}

final class PersistenceStore {
    private static let maxRecentFiles = 10

    private let fileManager: FileManager
    private let settingsURL: URL

    init(fileManager: FileManager = .default, settingsURL: URL? = nil) {
        self.fileManager = fileManager
        self.settingsURL = settingsURL ?? Self.defaultSettingsURL(fileManager: fileManager)
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

    func recordRecentFile(url: URL, now: Date = Date()) throws -> PersistenceSettings {
        var settings = load()
        guard settings.persistenceEnabled else {
            return .disabled
        }

        let standardizedPath = Self.standardPath(for: url)
        let recentFile = RecentFile(
            path: standardizedPath,
            displayName: URL(fileURLWithPath: standardizedPath).lastPathComponent,
            lastOpenedAt: Self.timestamp(from: now)
        )

        settings.recentFiles = [recentFile] + settings.recentFiles.filter {
            $0.path != standardizedPath
        }

        if settings.recentFiles.count > Self.maxRecentFiles {
            settings.recentFiles = Array(settings.recentFiles.prefix(Self.maxRecentFiles))
        }

        try write(settings)
        return settings
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
