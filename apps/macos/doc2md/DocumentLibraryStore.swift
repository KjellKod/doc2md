// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import Foundation

struct DocumentLibraryEntry: Codable, Equatable, Identifiable {
    let path: String
    let displayName: String
    let lastTouchedAt: String

    var id: String { path }
}

enum DocumentLibraryStoreError: Error, Equatable {
    case unreadable
    case unwritable
}

final class DocumentLibraryStore {
    private struct Envelope: Codable {
        let version: Int
        var entries: [DocumentLibraryEntry]
    }

    private let fileManager: FileManager
    private let storeURL: URL
    private let now: () -> Date

    init(
        fileManager: FileManager = .default,
        storeURL: URL? = nil,
        now: @escaping () -> Date = Date.init
    ) {
        self.fileManager = fileManager
        self.storeURL = storeURL ?? Self.defaultStoreURL(fileManager: fileManager)
        self.now = now
    }

    func load() throws -> [DocumentLibraryEntry] {
        guard fileManager.fileExists(atPath: storeURL.path) else {
            return []
        }

        do {
            let data = try Data(contentsOf: storeURL)
            let envelope = try JSONDecoder().decode(Envelope.self, from: data)
            guard envelope.version == 1 else {
                throw DocumentLibraryStoreError.unreadable
            }
            return Self.sorted(envelope.entries)
        } catch {
            throw DocumentLibraryStoreError.unreadable
        }
    }

    @discardableResult
    func record(url: URL, now explicitNow: Date? = nil) throws -> [DocumentLibraryEntry] {
        let standardizedURL = url.standardizedFileURL
        let path = standardizedURL.path
        var entries = try load()
        entries.removeAll { $0.path == path }
        entries.append(
            DocumentLibraryEntry(
                path: path,
                displayName: standardizedURL.lastPathComponent,
                lastTouchedAt: Self.timestamp(from: explicitNow ?? now())
            )
        )
        entries = Self.sorted(entries)
        try write(entries)
        return entries
    }

    func search(_ entries: [DocumentLibraryEntry], query: String) -> [DocumentLibraryEntry] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return entries
        }

        return entries.filter { entry in
            entry.displayName.localizedStandardContains(trimmed)
                || entry.path.localizedStandardContains(trimmed)
        }
    }

    private func write(_ entries: [DocumentLibraryEntry]) throws {
        let directory = storeURL.deletingLastPathComponent()
        let tempURL = directory.appendingPathComponent(
            ".\(storeURL.lastPathComponent).doc2md-\(UUID().uuidString).tmp"
        )
        do {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(Envelope(version: 1, entries: entries))
            guard fileManager.createFile(atPath: tempURL.path, contents: data) else {
                throw DocumentLibraryStoreError.unwritable
            }

            do {
                if fileManager.fileExists(atPath: storeURL.path) {
                    _ = try fileManager.replaceItemAt(
                        storeURL,
                        withItemAt: tempURL,
                        backupItemName: nil,
                        options: []
                    )
                } else {
                    try fileManager.moveItem(at: tempURL, to: storeURL)
                }
            } catch {
                try? fileManager.removeItem(at: tempURL)
                throw error
            }
        } catch {
            try? fileManager.removeItem(at: tempURL)
            throw DocumentLibraryStoreError.unwritable
        }
    }

    private static func sorted(_ entries: [DocumentLibraryEntry]) -> [DocumentLibraryEntry] {
        entries.sorted {
            if $0.lastTouchedAt != $1.lastTouchedAt {
                return $0.lastTouchedAt > $1.lastTouchedAt
            }
            return $0.path < $1.path
        }
    }

    private static func timestamp(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private static func defaultStoreURL(fileManager: FileManager) -> URL {
        let applicationSupportURL = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)

        return applicationSupportURL
            .appendingPathComponent("doc2md", isDirectory: true)
            .appendingPathComponent("document-library.json")
    }
}
