import Foundation

final class ApplicationSupportLicenseStore: LicenseTokenStorage {
    private let fileManager: FileManager
    private let tokenURL: URL

    init(fileManager: FileManager = .default, tokenURL: URL? = nil) {
        self.fileManager = fileManager
        self.tokenURL = tokenURL ?? Self.defaultTokenURL(fileManager: fileManager)
    }

    func loadToken() throws -> StoredLicenseCandidate {
        guard fileManager.fileExists(atPath: tokenURL.path) else {
            return .missing
        }

        let data = try Data(contentsOf: tokenURL)
        guard let token = String(data: data, encoding: .utf8) else {
            return .available("")
        }
        return .available(token.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    func saveToken(_ token: String) throws {
        let directory = tokenURL.deletingLastPathComponent()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data((token + "\n").utf8).write(to: tokenURL, options: [.atomic])
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableURL = tokenURL
        try? mutableURL.setResourceValues(values)
    }

    func clearToken() throws {
        guard fileManager.fileExists(atPath: tokenURL.path) else {
            return
        }
        try fileManager.removeItem(at: tokenURL)
    }

    private static func defaultTokenURL(fileManager: FileManager) -> URL {
        let applicationSupportURL = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)

        return applicationSupportURL
            .appendingPathComponent("doc2md", isDirectory: true)
            .appendingPathComponent("license.doc2md")
    }
}

