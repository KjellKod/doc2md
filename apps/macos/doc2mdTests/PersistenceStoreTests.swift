import Foundation
import XCTest

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
        let store = PersistenceStore(settingsURL: settingsURL)
        let sourceURL = try makeFile(name: "notes.md")

        var settings = try store.setPersistenceEnabled(true)
        XCTAssertTrue(settings.persistenceEnabled)

        settings = try store.setTheme(.light)
        XCTAssertEqual(settings.theme, .light)

        settings = try store.recordRecentFile(
            url: sourceURL,
            now: Date(timeIntervalSince1970: 1)
        )
        XCTAssertEqual(settings.recentFiles.count, 1)

        settings = try store.setPersistenceEnabled(false)

        XCTAssertEqual(settings, .disabled)
        XCTAssertEqual(store.load(), .disabled)
        XCTAssertFalse(FileManager.default.fileExists(atPath: settingsURL.path))
    }

    func testSetThemeAndRecordRecentNoopWhenPersistenceDisabled() throws {
        let settingsURL = try makeSettingsURL()
        let store = PersistenceStore(settingsURL: settingsURL)
        let sourceURL = try makeFile(name: "disabled.md")

        XCTAssertEqual(try store.setTheme(.dark), .disabled)
        XCTAssertEqual(try store.recordRecentFile(url: sourceURL), .disabled)
        XCTAssertFalse(FileManager.default.fileExists(atPath: settingsURL.path))
    }

    func testRecordRecentFilesDedupesNewestFirstAndCapsAtTen() throws {
        let settingsURL = try makeSettingsURL()
        let directory = try makeDirectory()
        let nestedDirectory = directory.appendingPathComponent("nested", isDirectory: true)
        try FileManager.default.createDirectory(
            at: nestedDirectory,
            withIntermediateDirectories: true
        )
        let store = PersistenceStore(settingsURL: settingsURL)
        _ = try store.setPersistenceEnabled(true)

        let canonicalURL = directory.appendingPathComponent("dedupe.md")
        let variantURL = nestedDirectory
            .appendingPathComponent("..", isDirectory: true)
            .appendingPathComponent("dedupe.md")
        _ = try store.recordRecentFile(
            url: canonicalURL,
            now: Date(timeIntervalSince1970: 1)
        )
        var settings = try store.recordRecentFile(
            url: variantURL,
            now: Date(timeIntervalSince1970: 2)
        )

        XCTAssertEqual(settings.recentFiles.count, 1)
        XCTAssertEqual(
            settings.recentFiles.first?.path,
            PersistenceStore.standardPath(for: canonicalURL)
        )
        XCTAssertEqual(settings.recentFiles.first?.displayName, "dedupe.md")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        XCTAssertNotNil(formatter.date(from: try XCTUnwrap(settings.recentFiles.first?.lastOpenedAt)))

        for index in 0..<10 {
            settings = try store.recordRecentFile(
                url: directory.appendingPathComponent("recent-\(index).md"),
                now: Date(timeIntervalSince1970: TimeInterval(10 + index))
            )
        }

        XCTAssertEqual(settings.recentFiles.count, 10)
        XCTAssertEqual(settings.recentFiles.first?.displayName, "recent-9.md")
        XCTAssertEqual(settings.recentFiles.last?.displayName, "recent-0.md")
        XCTAssertFalse(settings.recentFiles.contains { $0.displayName == "dedupe.md" })
    }

    func testSettingsFileStoresMetadataOnly() throws {
        let settingsURL = try makeSettingsURL()
        let store = PersistenceStore(settingsURL: settingsURL)
        let sourceURL = try makeFile(name: "metadata.md")

        _ = try store.setPersistenceEnabled(true)
        _ = try store.setTheme(.dark)
        _ = try store.recordRecentFile(url: sourceURL)

        let data = try Data(contentsOf: settingsURL)
        let rawJSON = try XCTUnwrap(String(data: data, encoding: .utf8))

        XCTAssertTrue(rawJSON.contains("\"persistenceEnabled\""))
        XCTAssertTrue(rawJSON.contains("\"theme\""))
        XCTAssertTrue(rawJSON.contains("\"recentFiles\""))
        XCTAssertFalse(rawJSON.contains("content"))
        XCTAssertFalse(rawJSON.contains("markdown"))
        XCTAssertFalse(rawJSON.contains("credential"))
        XCTAssertFalse(rawJSON.contains("license"))
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
