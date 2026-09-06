// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import XCTest

final class DocumentLibraryStoreTests: XCTestCase {
    private var directory: URL!
    private var storeURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("doc2md-library-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        storeURL = directory.appendingPathComponent("document-library.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    func testRecordDeduplicatesStandardizedPathAndMovesNewestFirst() throws {
        let store = makeStore()
        let first = directory.appendingPathComponent("folder/../Alpha.md")
        try store.record(url: first, now: Date(timeIntervalSince1970: 1))
        try store.record(url: directory.appendingPathComponent("Beta.md"), now: Date(timeIntervalSince1970: 2))
        let entries = try store.record(url: directory.appendingPathComponent("Alpha.md"), now: Date(timeIntervalSince1970: 3))
        XCTAssertEqual(entries.count, 2)
        XCTAssertEqual(entries[0].path, directory.appendingPathComponent("Alpha.md").path)
        XCTAssertEqual(entries[1].path, directory.appendingPathComponent("Beta.md").path)
    }

    func testEqualTimestampsSortByStandardizedPath() throws {
        let store = makeStore()
        let now = Date(timeIntervalSince1970: 10)
        try store.record(url: directory.appendingPathComponent("Zulu.md"), now: now)
        let entries = try store.record(url: directory.appendingPathComponent("Alpha.md"), now: now)
        XCTAssertEqual(entries.map(\.displayName), ["Alpha.md", "Zulu.md"])
    }

    func testRecordDoesNotCapOrPruneHistory() throws {
        let store = makeStore()
        for index in 0..<15 {
            try store.record(
                url: directory.appendingPathComponent("\(index).md"),
                now: Date(timeIntervalSince1970: TimeInterval(index))
            )
        }
        XCTAssertEqual(try store.load().count, 15)
    }

    func testSearchMatchesNameAndPathCaseAndDiacriticInsensitive() throws {
        let store = makeStore()
        let entries = try store.record(url: directory.appendingPathComponent("Résumé.md"))
        XCTAssertEqual(store.search(entries, query: "RESUME").count, 1)
        XCTAssertEqual(store.search(entries, query: directory.lastPathComponent.uppercased()).count, 1)
    }

    func testEntriesSurviveStoreReconstruction() throws {
        try makeStore().record(url: directory.appendingPathComponent("Saved.md"))
        XCTAssertEqual(try makeStore().load().map(\.displayName), ["Saved.md"])
    }

    func testFirstWriteDoesNotCreateEmptyDestinationPlaceholder() throws {
        let fileManager = RecordingFileManager()
        let store = DocumentLibraryStore(fileManager: fileManager, storeURL: storeURL)

        try store.record(url: directory.appendingPathComponent("Saved.md"))

        XCTAssertFalse(
            fileManager.createdFilePaths.contains(storeURL.path)
        )
        XCTAssertEqual(try store.load().map(\.displayName), ["Saved.md"])
    }

    func testDecodeFailurePreservesOriginalBytes() throws {
        let bytes = Data("not-json".utf8)
        XCTAssertTrue(FileManager.default.createFile(atPath: storeURL.path, contents: bytes))
        let store = makeStore()
        XCTAssertThrowsError(try store.record(url: directory.appendingPathComponent("New.md")))
        XCTAssertEqual(try Data(contentsOf: storeURL), bytes)
    }

    private func makeStore() -> DocumentLibraryStore {
        DocumentLibraryStore(storeURL: storeURL)
    }
}

private final class RecordingFileManager: FileManager {
    private(set) var createdFilePaths: [String] = []

    override func createFile(
        atPath path: String,
        contents data: Data?,
        attributes attr: [FileAttributeKey: Any]? = nil
    ) -> Bool {
        createdFilePaths.append(path)
        return super.createFile(atPath: path, contents: data, attributes: attr)
    }
}
