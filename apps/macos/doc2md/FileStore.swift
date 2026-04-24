import AppKit
import Darwin
import Foundation

enum ShellLineEnding: String, Codable {
    case lf
    case crlf
}

struct ShellOpenOk: Codable {
    let ok: Bool
    let path: String
    let mtimeMs: Int64
    let content: String
    let lineEnding: ShellLineEnding
}

struct ShellSaveOk: Codable {
    let ok: Bool
    let path: String
    let mtimeMs: Int64
}

struct ShellRevealOk: Codable {
    let ok: Bool
    let path: String
}

struct SaveFileArgs: Codable {
    let path: String
    let content: String
    let expectedMtimeMs: Int64
    let lineEnding: ShellLineEnding
}

enum FileStoreError: Error, Equatable {
    case cancelled
    case conflict(path: String, actualMtimeMs: Int64)
    case permissionNeeded(path: String?, message: String)
    case error(message: String)
}

final class FileStore {
    private let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    func open(url: URL) throws -> ShellOpenOk {
        do {
            let data = try Data(contentsOf: url)
            guard let content = String(data: data, encoding: .utf8) else {
                throw FileStoreError.error(message: "The selected file is not valid UTF-8 text.")
            }

            return ShellOpenOk(
                ok: true,
                path: url.standardizedFileURL.path,
                mtimeMs: try modificationTimeMs(for: url),
                content: content,
                lineEnding: Self.detectLineEnding(in: data)
            )
        } catch let error as FileStoreError {
            throw error
        } catch {
            throw Self.map(error: error, path: url.path)
        }
    }

    func save(args: SaveFileArgs, knownURL: URL) throws -> ShellSaveOk {
        let url = knownURL
        do {
            let actualMtimeMs = try modificationTimeMs(for: url)
            if actualMtimeMs != args.expectedMtimeMs {
                throw FileStoreError.conflict(path: url.standardizedFileURL.path, actualMtimeMs: actualMtimeMs)
            }

            try writeAtomically(content: args.content, lineEnding: args.lineEnding, to: url)

            return ShellSaveOk(
                ok: true,
                path: url.standardizedFileURL.path,
                mtimeMs: try modificationTimeMs(for: url)
            )
        } catch let error as FileStoreError {
            throw error
        } catch {
            throw Self.map(error: error, path: url.path)
        }
    }

    func saveAs(url: URL, content: String, lineEnding: ShellLineEnding) throws -> ShellSaveOk {
        do {
            try writeAtomically(content: content, lineEnding: lineEnding, to: url)

            return ShellSaveOk(
                ok: true,
                path: url.standardizedFileURL.path,
                mtimeMs: try modificationTimeMs(for: url)
            )
        } catch let error as FileStoreError {
            throw error
        } catch {
            throw Self.map(error: error, path: url.path)
        }
    }

    func reveal(path: String) throws -> ShellRevealOk {
        let url = URL(fileURLWithPath: path)

        guard fileManager.fileExists(atPath: url.path) else {
            throw FileStoreError.error(message: "The file no longer exists.")
        }

        NSWorkspace.shared.activateFileViewerSelecting([url])
        return ShellRevealOk(ok: true, path: url.standardizedFileURL.path)
    }

    func modificationTimeMs(for url: URL) throws -> Int64 {
        let values = try url.resourceValues(forKeys: [.contentModificationDateKey])
        guard let date = values.contentModificationDate else {
            throw FileStoreError.error(message: "Could not read the file modification time.")
        }

        return Self.mtimeMs(from: date)
    }

    func writeAtomically(
        content: String,
        lineEnding: ShellLineEnding,
        to url: URL
    ) throws {
        let destination = url.standardizedFileURL
        let parent = destination.deletingLastPathComponent()
        let tempURL = parent.appendingPathComponent(".\(destination.lastPathComponent).doc2md-\(UUID().uuidString).tmp")
        var createdPlaceholder = false

        do {
            guard fileManager.fileExists(atPath: parent.path) else {
                throw FileStoreError.error(message: "The destination folder no longer exists.")
            }

            guard fileManager.isWritableFile(atPath: parent.path) else {
                throw Self.writePermissionError(path: destination.path)
            }

            let bytes = Self.encode(content: content, lineEnding: lineEnding)
            guard fileManager.createFile(atPath: tempURL.path, contents: bytes) else {
                throw FileStoreError.error(message: "Could not create a temporary file while saving.")
            }

            if !fileManager.fileExists(atPath: destination.path) {
                guard fileManager.createFile(atPath: destination.path, contents: Data()) else {
                    throw FileStoreError.error(message: "Could not prepare the destination file for saving.")
                }
                createdPlaceholder = true
            }

            _ = try fileManager.replaceItemAt(
                destination,
                withItemAt: tempURL,
                backupItemName: nil,
                options: []
            )
        } catch {
            if createdPlaceholder {
                try? fileManager.removeItem(at: destination)
            }
            try? fileManager.removeItem(at: tempURL)
            throw error
        }
    }

    static func selectedURL(from url: URL?) throws -> URL {
        guard let url else {
            throw FileStoreError.cancelled
        }

        return url
    }

    static func detectLineEnding(in data: Data) -> ShellLineEnding {
        let sample = data.prefix(4096)
        var previousWasCR = false

        for byte in sample {
            if previousWasCR && byte == 10 {
                return .crlf
            }
            previousWasCR = byte == 13
        }

        return .lf
    }

    static func encode(content: String, lineEnding: ShellLineEnding) -> Data {
        let lfContent = content.replacingOccurrences(of: "\r\n", with: "\n")
        let output = lineEnding == .crlf
            ? lfContent.replacingOccurrences(of: "\n", with: "\r\n")
            : lfContent

        return Data(output.utf8)
    }

    static func mtimeMs(from date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1000).rounded())
    }

    static func map(error: Error, path: String?) -> FileStoreError {
        let nsError = error as NSError

        if isPermissionError(nsError) {
            return .permissionNeeded(
                path: path,
                message: "Permission is needed to access this file. Open or save it again."
            )
        }

        return .error(message: error.localizedDescription)
    }

    private static func writePermissionError(path: String) -> FileStoreError {
        .permissionNeeded(
            path: path,
            message: "Permission is needed to access this file. Open or save it again."
        )
    }

    private static func isPermissionError(_ error: NSError) -> Bool {
        if error.domain == NSCocoaErrorDomain {
            let permissionCodes = [
                NSFileReadNoPermissionError,
                NSFileWriteNoPermissionError
            ]

            if permissionCodes.contains(error.code) {
                return true
            }
        }

        if error.domain == NSPOSIXErrorDomain {
            return error.code == Int(EACCES) || error.code == Int(EPERM)
        }

        if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
            return isPermissionError(underlying)
        }

        return false
    }
}
