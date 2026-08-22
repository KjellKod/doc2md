import Foundation
import Security

struct PolarLicenseCredentials: Codable, Equatable {
    let key: String
    let activationID: String

    enum CodingKeys: String, CodingKey {
        case key
        case activationID = "activation_id"
    }
}

struct PolarLicenseMetadata: Codable, Equatable {
    static let currentSchemaVersion = 1

    let schemaVersion: Int
    var keyStatus: LicenseKeyStatus?
    var expiresAt: Date?
    var lastValidatedAt: Date?
    let installationSuffix: String

    init(
        schemaVersion: Int = Self.currentSchemaVersion,
        keyStatus: LicenseKeyStatus? = nil,
        expiresAt: Date? = nil,
        lastValidatedAt: Date? = nil,
        installationSuffix: String
    ) {
        self.schemaVersion = schemaVersion
        self.keyStatus = keyStatus
        self.expiresAt = expiresAt
        self.lastValidatedAt = lastValidatedAt
        self.installationSuffix = installationSuffix
    }

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "schema_version"
        case keyStatus = "key_status"
        case expiresAt = "expires_at"
        case lastValidatedAt = "last_validated_at"
        case installationSuffix = "installation_suffix"
    }
}

extension LicenseKeyStatus: Codable {
    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        guard let status = LicenseKeyStatus(rawProviderValue: value) else {
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Unknown Polar license status."
            )
        }
        self = status
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .granted: try container.encode("granted")
        case .revoked: try container.encode("revoked")
        case .disabled: try container.encode("disabled")
        }
    }
}

protocol PolarLicenseCredentialStorage {
    func loadCredentials() throws -> PolarLicenseCredentials?
    func saveCredentials(_ credentials: PolarLicenseCredentials) throws
    func clearCredentials() throws
}

protocol PolarLicenseMetadataStorage {
    func loadMetadata() throws -> PolarLicenseMetadata?
    func saveMetadata(_ metadata: PolarLicenseMetadata) throws
    func clearMetadata() throws
}

final class KeychainPolarLicenseCredentialStore: PolarLicenseCredentialStorage {
    private let service = "com.kjellkod.doc2md.polar-license"
    private let account = "doc2md-polar-license-credentials"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    func loadCredentials() throws -> PolarLicenseCredentials? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess, let data = item as? Data else {
            throw LicenseStorageError.failed("Polar Keychain read failed.")
        }
        do {
            return try decoder.decode(PolarLicenseCredentials.self, from: data)
        } catch {
            throw LicenseStorageError.failed("Polar Keychain data is invalid.")
        }
    }

    func saveCredentials(_ credentials: PolarLicenseCredentials) throws {
        let data = try encoder.encode(credentials)
        let query = baseQuery()
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw LicenseStorageError.failed("Polar Keychain write failed.")
        }

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess else {
            throw LicenseStorageError.failed("Polar Keychain write failed.")
        }
    }

    func clearCredentials() throws {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw LicenseStorageError.failed("Polar Keychain delete failed.")
        }
    }

    func queryAttributesForTesting() -> [String: Any] {
        baseQuery()
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
    }
}

final class ApplicationSupportPolarLicenseMetadataStore: PolarLicenseMetadataStorage {
    private let fileManager: FileManager
    private let metadataURL: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(fileManager: FileManager = .default, metadataURL: URL? = nil) {
        self.fileManager = fileManager
        self.metadataURL = metadataURL ?? Self.defaultMetadataURL(fileManager: fileManager)
        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }

    func loadMetadata() throws -> PolarLicenseMetadata? {
        guard fileManager.fileExists(atPath: metadataURL.path) else {
            return nil
        }
        let metadata: PolarLicenseMetadata
        do {
            metadata = try decoder.decode(
                PolarLicenseMetadata.self,
                from: Data(contentsOf: metadataURL)
            )
        } catch {
            throw LicenseStorageError.failed("Polar license metadata is invalid.")
        }
        guard metadata.schemaVersion == PolarLicenseMetadata.currentSchemaVersion,
              Self.isValidSuffix(metadata.installationSuffix)
        else {
            throw LicenseStorageError.failed("Polar license metadata is invalid.")
        }
        return metadata
    }

    func saveMetadata(_ metadata: PolarLicenseMetadata) throws {
        guard metadata.schemaVersion == PolarLicenseMetadata.currentSchemaVersion,
              Self.isValidSuffix(metadata.installationSuffix)
        else {
            throw LicenseStorageError.failed("Polar license metadata is invalid.")
        }
        try fileManager.createDirectory(
            at: metadataURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let encoded = try encoder.encode(metadata)
        try encoded.write(to: metadataURL, options: [.atomic])
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableURL = metadataURL
        try? mutableURL.setResourceValues(values)
    }

    func clearMetadata() throws {
        guard fileManager.fileExists(atPath: metadataURL.path) else {
            return
        }
        try fileManager.removeItem(at: metadataURL)
    }

    private static func isValidSuffix(_ suffix: String) -> Bool {
        suffix.count == 4 && suffix.unicodeScalars.allSatisfy {
            CharacterSet(charactersIn: "23456789ABCDEFGHJKLMNPQRSTUVWXYZ").contains($0)
        }
    }

    private static func defaultMetadataURL(fileManager: FileManager) -> URL {
        let applicationSupportURL = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)
        return applicationSupportURL
            .appendingPathComponent("doc2md", isDirectory: true)
            .appendingPathComponent("polar-license-metadata.json")
    }
}

struct PolarLicenseLoadResult {
    let credentials: PolarLicenseCredentials?
    let metadata: PolarLicenseMetadata?
    let storageUnavailable: Bool
}

protocol PolarLicenseRepositoryProtocol {
    func load() -> PolarLicenseLoadResult
    func installationSuffix() throws -> String
    func saveActivation(
        credentials: PolarLicenseCredentials,
        snapshot: PolarLicenseSnapshot,
        suffix: String,
        validatedAt: Date
    ) throws
    func saveValidation(snapshot: PolarLicenseSnapshot, validatedAt: Date) throws
    func clearCredentials() throws
    func clearEntitlement() throws
}

final class PolarLicenseRepository: PolarLicenseRepositoryProtocol {
    private let credentialStore: PolarLicenseCredentialStorage
    private let metadataStore: PolarLicenseMetadataStorage
    private let suffixGenerator: PolarInstallationSuffixGenerating

    init(
        credentialStore: PolarLicenseCredentialStorage = KeychainPolarLicenseCredentialStore(),
        metadataStore: PolarLicenseMetadataStorage = ApplicationSupportPolarLicenseMetadataStore(),
        suffixGenerator: PolarInstallationSuffixGenerating = RandomPolarInstallationSuffixGenerator()
    ) {
        self.credentialStore = credentialStore
        self.metadataStore = metadataStore
        self.suffixGenerator = suffixGenerator
    }

    func load() -> PolarLicenseLoadResult {
        var unavailable = false
        let credentials: PolarLicenseCredentials?
        let metadata: PolarLicenseMetadata?
        do {
            credentials = try credentialStore.loadCredentials()
        } catch {
            credentials = nil
            unavailable = true
        }
        do {
            metadata = try metadataStore.loadMetadata()
        } catch {
            metadata = nil
            unavailable = true
        }
        return PolarLicenseLoadResult(
            credentials: credentials,
            metadata: metadata,
            storageUnavailable: unavailable
        )
    }

    func installationSuffix() throws -> String {
        if let metadata = try metadataStore.loadMetadata() {
            return metadata.installationSuffix
        }
        let suffix = suffixGenerator.generateSuffix()
        let metadata = PolarLicenseMetadata(installationSuffix: suffix)
        try metadataStore.saveMetadata(metadata)
        return suffix
    }

    func saveActivation(
        credentials: PolarLicenseCredentials,
        snapshot: PolarLicenseSnapshot,
        suffix: String,
        validatedAt: Date
    ) throws {
        try credentialStore.saveCredentials(credentials)
        do {
            try metadataStore.saveMetadata(
                PolarLicenseMetadata(
                    keyStatus: snapshot.keyStatus,
                    expiresAt: snapshot.expiresAt,
                    lastValidatedAt: validatedAt,
                    installationSuffix: suffix
                )
            )
        } catch {
            try? credentialStore.clearCredentials()
            throw error
        }
    }

    func saveValidation(snapshot: PolarLicenseSnapshot, validatedAt: Date) throws {
        guard let existing = try metadataStore.loadMetadata() else {
            throw LicenseStorageError.failed("Polar license metadata is missing.")
        }
        try metadataStore.saveMetadata(
            PolarLicenseMetadata(
                keyStatus: snapshot.keyStatus,
                expiresAt: snapshot.expiresAt,
                lastValidatedAt: validatedAt,
                installationSuffix: existing.installationSuffix
            )
        )
    }

    func clearCredentials() throws {
        try credentialStore.clearCredentials()
    }

    func clearEntitlement() throws {
        var firstError: Error?
        do {
            try credentialStore.clearCredentials()
        } catch {
            firstError = error
        }

        let existing: PolarLicenseMetadata?
        do {
            existing = try metadataStore.loadMetadata()
        } catch {
            do {
                try metadataStore.clearMetadata()
            } catch {
                if firstError == nil {
                    firstError = error
                }
            }
            if let firstError {
                throw firstError
            }
            return
        }

        if let existing {
            do {
                try metadataStore.saveMetadata(
                    PolarLicenseMetadata(installationSuffix: existing.installationSuffix)
                )
            } catch {
                if firstError == nil {
                    firstError = error
                }
                try? metadataStore.clearMetadata()
            }
        }
        if let firstError {
            throw firstError
        }
    }
}
