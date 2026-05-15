import Foundation
import XCTest

private final class TestRecentDocumentController: RecentDocumentControlling {
    private(set) var recentDocumentURLs: [URL] = []
    private(set) var clearCallCount = 0

    func noteNewRecentDocumentURL(_ url: URL) {
        recentDocumentURLs = [url] + recentDocumentURLs.filter {
            $0.standardizedFileURL.path != url.standardizedFileURL.path
        }
    }

    func clearRecentDocuments(_ sender: Any?) {
        clearCallCount += 1
        recentDocumentURLs = []
    }
}

final class PersistenceStoreTests: XCTestCase {
    private var tempDirectories: [URL] = []

    override func tearDownWithError() throws {
        for url in tempDirectories {
            try? FileManager.default.removeItem(at: url)
        }
        tempDirectories = []
        try super.tearDownWithError()
    }

    func testLoadReturnsDisabledDefaultWhenMissingOrUnreadable() throws {
        let settingsURL = try makeSettingsURL()
        let store = PersistenceStore(settingsURL: settingsURL)

        XCTAssertEqual(store.load(), .disabled)

        try FileManager.default.createDirectory(
            at: settingsURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data("{".utf8).write(to: settingsURL)

        XCTAssertEqual(store.load(), .disabled)
    }

    func testDisablePersistenceClearsThemeAndRecentFiles() throws {
        let settingsURL = try makeSettingsURL()
        let recentController = TestRecentDocumentController()
        let store = PersistenceStore(
            settingsURL: settingsURL,
            recentDocumentController: recentController
        )
        let sourceURL = try makeFile(name: "notes.md")

        var settings = try store.setPersistenceEnabled(true)
        XCTAssertTrue(settings.persistenceEnabled)

        settings = try store.setTheme(.light)
        XCTAssertEqual(settings.theme, .light)

        settings = try store.recordRecentDocument(url: sourceURL)
        XCTAssertEqual(recentController.recentDocumentURLs.count, 1)

        settings = try store.setPersistenceEnabled(false)

        XCTAssertEqual(settings, .disabled)
        XCTAssertEqual(store.load(), .disabled)
        XCTAssertEqual(recentController.clearCallCount, 1)
        XCTAssertTrue(recentController.recentDocumentURLs.isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: settingsURL.path))
    }

    func testSetThemeAndRecordRecentNoopWhenPersistenceDisabled() throws {
        let settingsURL = try makeSettingsURL()
        let recentController = TestRecentDocumentController()
        let store = PersistenceStore(
            settingsURL: settingsURL,
            recentDocumentController: recentController
        )
        let sourceURL = try makeFile(name: "disabled.md")

        XCTAssertEqual(try store.setTheme(.dark), .disabled)
        XCTAssertEqual(try store.recordRecentDocument(url: sourceURL), .disabled)
        XCTAssertTrue(recentController.recentDocumentURLs.isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: settingsURL.path))
    }

    func testRecentDocumentsDedupesNewestFirstAndCapsAtTen() throws {
        let settingsURL = try makeSettingsURL()
        let directory = try makeDirectory()
        let nestedDirectory = directory.appendingPathComponent("nested", isDirectory: true)
        try FileManager.default.createDirectory(
            at: nestedDirectory,
            withIntermediateDirectories: true
        )
        let recentController = TestRecentDocumentController()
        let store = PersistenceStore(
            settingsURL: settingsURL,
            recentDocumentController: recentController
        )
        _ = try store.setPersistenceEnabled(true)

        let canonicalURL = directory.appendingPathComponent("dedupe.md")
        let variantURL = nestedDirectory
            .appendingPathComponent("..", isDirectory: true)
            .appendingPathComponent("dedupe.md")
        _ = try store.recordRecentDocument(url: canonicalURL)
        _ = try store.recordRecentDocument(url: variantURL)

        var recentFiles = store.recentFiles(now: Date(timeIntervalSince1970: 2))
        XCTAssertEqual(recentFiles.count, 1)
        XCTAssertEqual(
            recentFiles.first?.path,
            PersistenceStore.standardPath(for: canonicalURL)
        )
        XCTAssertEqual(recentFiles.first?.displayName, "dedupe.md")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        XCTAssertNotNil(formatter.date(from: try XCTUnwrap(recentFiles.first?.lastOpenedAt)))

        for index in 0..<10 {
            _ = try store.recordRecentDocument(
                url: directory.appendingPathComponent("recent-\(index).md")
            )
        }

        recentFiles = store.recentFiles(now: Date(timeIntervalSince1970: 12))
        XCTAssertEqual(recentFiles.count, 10)
        XCTAssertEqual(recentFiles.first?.displayName, "recent-9.md")
        XCTAssertEqual(recentFiles.last?.displayName, "recent-0.md")
        XCTAssertFalse(recentFiles.contains { $0.displayName == "dedupe.md" })
    }

    func testSettingsFileStoresMetadataOnly() throws {
        let settingsURL = try makeSettingsURL()
        let store = PersistenceStore(
            settingsURL: settingsURL,
            recentDocumentController: TestRecentDocumentController()
        )
        let sourceURL = try makeFile(name: "metadata.md")

        _ = try store.setPersistenceEnabled(true)
        _ = try store.setTheme(.dark)
        _ = try store.recordRecentDocument(url: sourceURL)

        let data = try Data(contentsOf: settingsURL)
        let rawJSON = try XCTUnwrap(String(data: data, encoding: .utf8))

        XCTAssertTrue(rawJSON.contains("\"persistenceEnabled\""))
        XCTAssertTrue(rawJSON.contains("\"theme\""))
        XCTAssertFalse(rawJSON.contains("\"recentFiles\""))
        XCTAssertFalse(rawJSON.contains("content"))
        XCTAssertFalse(rawJSON.contains("markdown"))
        XCTAssertFalse(rawJSON.contains("credential"))
        XCTAssertFalse(rawJSON.contains("license"))
    }

    func testLegacyRecentFilesDecodeButAreNotPersistedAgain() throws {
        let settingsURL = try makeSettingsURL()
        try FileManager.default.createDirectory(
            at: settingsURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(
            """
            {"persistenceEnabled":true,"theme":"dark","recentFiles":[{"path":"/tmp/legacy.md","displayName":"legacy.md","lastOpenedAt":"2026-05-12T22:10:00.000Z"}]}
            """.utf8
        ).write(to: settingsURL)
        let store = PersistenceStore(
            settingsURL: settingsURL,
            recentDocumentController: TestRecentDocumentController()
        )

        let loaded = store.load()
        XCTAssertTrue(loaded.persistenceEnabled)
        XCTAssertEqual(loaded.recentFiles.count, 1)

        _ = try store.setTheme(.light)
        let rawJSON = try XCTUnwrap(String(data: Data(contentsOf: settingsURL), encoding: .utf8))
        XCTAssertFalse(rawJSON.contains("\"recentFiles\""))
    }

    private func makeSettingsURL() throws -> URL {
        let directory = try makeDirectory()
        return directory.appendingPathComponent("settings.json")
    }

    private func makeFile(name: String) throws -> URL {
        let directory = try makeDirectory()
        let fileURL = directory.appendingPathComponent(name)
        try Data("test".utf8).write(to: fileURL)
        return fileURL
    }

    private func makeDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("doc2md-persistence-store-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        tempDirectories.append(directory)
        return directory
    }
}
