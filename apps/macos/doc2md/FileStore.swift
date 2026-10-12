import AppKit
import Darwin
import Foundation

enum ShellLineEnding: String, Codable {
    case lf
    case crlf
}

struct ShellOpenMarkdownOk: Codable {
    let ok: Bool
    let kind: String
    let path: String
    let mtimeMs: Int64
    let content: String
    let lineEnding: ShellLineEnding
}

struct ShellOpenImportOk: Codable {
    let ok: Bool
    let kind: String
    let path: String
    let name: String
    let format: String
    let mtimeMs: Int64
    let importUrl: String
    let mimeType: String?
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

struct ShellStatOk: Codable {
    let ok: Bool
    let path: String
    let mtimeMs: Int64
}

struct RenameFileArgs: Codable {
    let path: String
    let name: String
    let expectedMtimeMs: Int64
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
    static let markdownSaveExtension = "md"
    static let htmlSaveExtension = "html"

    private let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    func open(url: URL) throws -> ShellOpenMarkdownOk {
        do {
            let data = try Data(contentsOf: url)
            guard let content = String(data: data, encoding: .utf8) else {
                throw FileStoreError.error(message: "The selected file is not valid UTF-8 text.")
            }

            return ShellOpenMarkdownOk(
                ok: true,
                kind: "markdown",
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

    func rename(args: RenameFileArgs, knownURL: URL) throws -> ShellSaveOk {
        guard ["md", "markdown"].contains(knownURL.pathExtension.lowercased()) else {
            throw FileStoreError.error(message: "Only Markdown documents can be renamed.")
        }
        let name = args.name
        let forbidden = CharacterSet.controlCharacters.union(CharacterSet(charactersIn: "/\\:"))
        guard !name.unicodeScalars.contains(where: { forbidden.contains($0) }),
              name == name.trimmingCharacters(in: .whitespacesAndNewlines),
              name.lowercased().hasSuffix(".md"), name.count > 3,
              name.utf8.count <= 255 else {
            throw FileStoreError.error(message: "Choose a valid Markdown filename.")
        }
        let actualMtime: Int64
        do {
            actualMtime = try modificationTimeMs(for: knownURL)
        } catch let error as FileStoreError {
            throw error
        } catch {
            throw Self.map(error: error, path: knownURL.path)
        }
        guard actualMtime == args.expectedMtimeMs else {
            throw FileStoreError.conflict(path: knownURL.path, actualMtimeMs: actualMtime)
        }
        let target = knownURL.deletingLastPathComponent().appendingPathComponent(name)
        if target.path != knownURL.path {
            // RENAME_EXCL guarantees that a racing creator cannot be overwritten.
            let result = knownURL.path.withCString { source in
                target.path.withCString { destination in
                    renamex_np(source, destination, UInt32(RENAME_EXCL))
                }
            }
            if result != 0 {
                if errno == EEXIST {
                    throw FileStoreError.error(message: "A file with that name already exists.")
                }
                throw Self.map(error: NSError(domain: NSPOSIXErrorDomain, code: Int(errno)), path: knownURL.path)
            }
        }
        // A rename preserves content and mtime, including unsaved editor changes.
        return ShellSaveOk(ok: true, path: target.standardizedFileURL.path, mtimeMs: actualMtime)
    }

    func save(args: SaveFileArgs, knownURL: URL) throws -> ShellSaveOk {
        let url = knownURL
        do {
            try Self.validateMarkdownSaveTarget(url: url)
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

    func saveAs(
        url: URL,
        content: String,
        lineEnding: ShellLineEnding,
        validate: (URL) throws -> Void = FileStore.validateMarkdownSaveTarget
    ) throws -> ShellSaveOk {
        do {
            try validate(url)
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

    func stat(url: URL) throws -> ShellStatOk {
        let standardizedURL = url.standardizedFileURL

        guard fileManager.fileExists(atPath: standardizedURL.path) else {
            throw FileStoreError.error(message: "The file no longer exists.")
        }

        return ShellStatOk(
            ok: true,
            path: standardizedURL.path,
            mtimeMs: try modificationTimeMs(for: standardizedURL)
        )
    }

    func modificationTimeMs(for url: URL) throws -> Int64 {
        let attributes = try fileManager.attributesOfItem(atPath: url.standardizedFileURL.path)
        guard let date = attributes[.modificationDate] as? Date else {
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

    static func validateMarkdownSaveTarget(url: URL) throws {
        let normalizedURL = url.standardizedFileURL
        guard normalizedURL.pathExtension.lowercased() == markdownSaveExtension else {
            throw FileStoreError.error(message: "Save target must use the .md extension.")
        }
    }

    static func validateHtmlSaveTarget(url: URL) throws {
        let normalizedURL = url.standardizedFileURL
        guard normalizedURL.pathExtension.lowercased() == htmlSaveExtension else {
            throw FileStoreError.error(message: "HTML export target must use the .html extension.")
        }
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
