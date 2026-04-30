import Foundation
import XCTest

final class FileStoreTests: XCTestCase {
    private var tempDirectories: [URL] = []

    override func tearDownWithError() throws {
        for url in tempDirectories {
            try? FileManager.default.removeItem(at: url)
        }
        tempDirectories = []
        try super.tearDownWithError()
    }

    func testOpenDetectsCRLFAndMtime() throws {
        let fileURL = try makeFile(name: "crlf.md", data: Data("one\r\ntwo\r\n".utf8))
        let store = FileStore()

        let opened = try store.open(url: fileURL)

        XCTAssertEqual(opened.ok, true)
        XCTAssertEqual(opened.path, fileURL.standardizedFileURL.path)
        XCTAssertEqual(opened.content, "one\r\ntwo\r\n")
        XCTAssertEqual(opened.lineEnding, .crlf)
        XCTAssertGreaterThan(opened.mtimeMs, 0)
    }

    func testSaveRejectsMtimeConflict() throws {
        let fileURL = try makeFile(name: "conflict.md", data: Data("old\n".utf8))
        let store = FileStore()
        let actualMtimeMs = try store.modificationTimeMs(for: fileURL)

        XCTAssertThrowsError(
            try store.save(
                args: SaveFileArgs(
                    path: fileURL.path,
                    content: "new\n",
                    expectedMtimeMs: actualMtimeMs - 1,
                    lineEnding: .lf
                ),
                knownURL: fileURL
            )
        ) { error in
            XCTAssertEqual(
                error as? FileStoreError,
                .conflict(path: fileURL.standardizedFileURL.path, actualMtimeMs: actualMtimeMs)
            )
        }
    }

    func testSaveRejectsExternalEditWhenRememberedURLHasStaleResourceValues() throws {
        var fileURL = try makeFile(name: "cached-conflict.md", data: Data("old\n".utf8))
        let store = FileStore()
        let expectedMtimeMs = try store.modificationTimeMs(for: fileURL)
        let staleDate = Date(timeIntervalSince1970: Double(expectedMtimeMs) / 1000)
        let externalEditDate = Date(timeIntervalSince1970: Double(expectedMtimeMs + 5_000) / 1000)

        fileURL.setTemporaryResourceValue(
            staleDate,
            forKey: .contentModificationDateKey
        )
        try Data("external edit\n".utf8).write(to: fileURL)
        try FileManager.default.setAttributes(
            [.modificationDate: externalEditDate],
            ofItemAtPath: fileURL.path
        )

        XCTAssertThrowsError(
            try store.save(
                args: SaveFileArgs(
                    path: fileURL.path,
                    content: "doc2md edit\n",
                    expectedMtimeMs: expectedMtimeMs,
                    lineEnding: .lf
                ),
                knownURL: fileURL
            )
        ) { error in
            XCTAssertEqual(
                error as? FileStoreError,
                .conflict(
                    path: fileURL.standardizedFileURL.path,
                    actualMtimeMs: FileStore.mtimeMs(from: externalEditDate)
                )
            )
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), Data("external edit\n".utf8))
    }

    func testSaveWritesWithAtomicReplaceAndReturnsNewMtime() throws {
        let fileURL = try makeFile(name: "save.md", data: Data("old\n".utf8))
        let store = FileStore()
        let expectedMtimeMs = try store.modificationTimeMs(for: fileURL)

        let saved = try store.save(
            args: SaveFileArgs(
                path: fileURL.path,
                content: "one\ntwo",
                expectedMtimeMs: expectedMtimeMs,
                lineEnding: .crlf
            ),
            knownURL: fileURL
        )

        XCTAssertEqual(saved.ok, true)
        XCTAssertEqual(saved.path, fileURL.standardizedFileURL.path)
        XCTAssertGreaterThan(saved.mtimeMs, 0)
        XCTAssertEqual(try Data(contentsOf: fileURL), Data("one\r\ntwo".utf8))
        let siblingNames = try FileManager.default.contentsOfDirectory(
            atPath: fileURL.deletingLastPathComponent().path
        )
        XCTAssertFalse(siblingNames.contains { $0.contains(".doc2md-") })
    }

    func testMtimeRoundingIsStableAcrossOpenConflictAndPostSave() throws {
        let date = Date(timeIntervalSince1970: 1.2345)

        XCTAssertEqual(FileStore.mtimeMs(from: date), 1235)
    }

    func testPermissionDeniedMapsToPermissionNeeded() {
        let mapped = FileStore.map(
            error: NSError(domain: NSPOSIXErrorDomain, code: Int(EACCES)),
            path: "/tmp/protected.md"
        )

        XCTAssertEqual(
            mapped,
            .permissionNeeded(
                path: "/tmp/protected.md",
                message: "Permission is needed to access this file. Open or save it again."
            )
        )
    }

    func testSaveAsWritePathPermissionFailureMapsToPermissionNeeded() throws {
        let directory = try makeDirectory()
        let protectedDirectory = directory.appendingPathComponent("protected", isDirectory: true)
        try FileManager.default.createDirectory(at: protectedDirectory, withIntermediateDirectories: true)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o500],
            ofItemAtPath: protectedDirectory.path
        )
        defer {
            try? FileManager.default.setAttributes(
                [.posixPermissions: 0o700],
                ofItemAtPath: protectedDirectory.path
            )
        }
        let fileURL = protectedDirectory.appendingPathComponent("blocked.md")
        let store = FileStore()

        XCTAssertThrowsError(
            try store.saveAs(url: fileURL, content: "blocked", lineEnding: .lf)
        ) { error in
            XCTAssertEqual(
                error as? FileStoreError,
                .permissionNeeded(
                    path: fileURL.standardizedFileURL.path,
                    message: "Permission is needed to access this file. Open or save it again."
                )
            )
        }
    }

    func testSaveAsTempFileCreationFailureSurfacesGenericError() throws {
        let directory = try makeDirectory()
        let fileURL = directory.appendingPathComponent("blocked.md")
        let store = FileStore(fileManager: CreateFileFailureFileManager())

        XCTAssertThrowsError(
            try store.saveAs(url: fileURL, content: "blocked", lineEnding: .lf)
        ) { error in
            XCTAssertEqual(
                error as? FileStoreError,
                .error(message: "Could not create a temporary file while saving.")
            )
        }
    }

    func testCancelMapsToCancelled() {
        XCTAssertThrowsError(try FileStore.selectedURL(from: nil)) { error in
            XCTAssertEqual(error as? FileStoreError, .cancelled)
        }
    }

    private func makeFile(name: String, data: Data) throws -> URL {
        let directory = try makeDirectory()
        let fileURL = directory.appendingPathComponent(name)
        try data.write(to: fileURL)
        return fileURL
    }

    private func makeDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("doc2md-file-store-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        tempDirectories.append(directory)
        return directory
    }
}

private final class CreateFileFailureFileManager: FileManager {
    override func createFile(
        atPath path: String,
        contents data: Data?,
        attributes attr: [FileAttributeKey : Any]? = nil
    ) -> Bool {
        false
    }

    override func isWritableFile(atPath path: String) -> Bool {
        true
    }
}
