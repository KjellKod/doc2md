import Foundation
import Security
import XCTest

final class PolarLicensePersistenceTests: XCTestCase {
    private let expiry = Date(timeIntervalSince1970: 1_800_000_000)

    func testPolarKeychainQueryIsNonSyncingAndSeparateFromLegacyAccount() {
        let attributes = KeychainPolarLicenseCredentialStore().queryAttributesForTesting()

        XCTAssertTrue((attributes[kSecAttrSynchronizable as String] as AnyObject) === kCFBooleanFalse)
        XCTAssertEqual(
            attributes[kSecAttrAccessible as String] as? String,
            kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String
        )
        XCTAssertEqual(attributes[kSecAttrService as String] as? String, "com.kjellkod.doc2md.polar-license")
        XCTAssertEqual(attributes[kSecAttrAccount as String] as? String, "doc2md-polar-license-credentials")
    }

    func testMetadataRoundTripUsesExactNonSecretWhitelist() throws {
        let temporary = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let url = temporary.appendingPathComponent("polar-license-metadata.json")
        defer { try? FileManager.default.removeItem(at: temporary) }
        let store = ApplicationSupportPolarLicenseMetadataStore(metadataURL: url)
        let metadata = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: expiry,
            lastValidatedAt: expiry.addingTimeInterval(-60),
            installationSuffix: "7Q2F"
        )

        try store.saveMetadata(metadata)

        XCTAssertEqual(try store.loadMetadata(), metadata)
        let data = try Data(contentsOf: url)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(
            Set(object.keys),
            ["schema_version", "key_status", "expires_at", "last_validated_at", "installation_suffix"]
        )
        let text = String(decoding: data, as: UTF8.self)
        XCTAssertFalse(text.contains("polar-secret-key"))
        XCTAssertFalse(text.contains("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"))
    }

    func testRepositorySurvivesRelaunchAndKeychainLossWithoutChangingSuffix() throws {
        let credentials = MemoryPolarCredentialStore()
        let metadata = MemoryPolarMetadataStore()
        let repository = PolarLicenseRepository(
            credentialStore: credentials,
            metadataStore: metadata,
            suffixGenerator: FixedSuffixGenerator(value: "7Q2F")
        )
        let suffix = try repository.installationSuffix()
        try repository.saveActivation(
            credentials: PolarLicenseCredentials(
                key: "polar-secret-key",
                activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
            ),
            snapshot: PolarLicenseSnapshot(keyStatus: .granted, expiresAt: expiry),
            suffix: suffix,
            validatedAt: expiry.addingTimeInterval(-60)
        )

        let relaunched = repository.load()
        XCTAssertEqual(relaunched.credentials?.key, "polar-secret-key")
        XCTAssertEqual(
            relaunched.credentials?.activationID,
            "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        )
        XCTAssertEqual(relaunched.metadata?.keyStatus, .granted)
        XCTAssertEqual(relaunched.metadata?.expiresAt, expiry)
        XCTAssertEqual(relaunched.metadata?.lastValidatedAt, expiry.addingTimeInterval(-60))
        XCTAssertEqual(relaunched.metadata?.installationSuffix, "7Q2F")

        credentials.value = nil
        let keychainLoss = repository.load()
        XCTAssertNil(keychainLoss.credentials)
        XCTAssertEqual(keychainLoss.metadata?.keyStatus, .granted)
        XCTAssertEqual(try repository.installationSuffix(), "7Q2F")
    }

    func testMetadataNeverContainsSecretsAcrossValidationRemovalAndReplacement() throws {
        let credentials = MemoryPolarCredentialStore()
        let metadata = MemoryPolarMetadataStore()
        let repository = PolarLicenseRepository(
            credentialStore: credentials,
            metadataStore: metadata,
            suffixGenerator: FixedSuffixGenerator(value: "7Q2F")
        )
        let rawKey = "polar-secret-key"
        let activationID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        let replacementKey = "replacement-secret-key"
        let replacementActivationID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"

        try repository.saveActivation(
            credentials: PolarLicenseCredentials(key: rawKey, activationID: activationID),
            snapshot: PolarLicenseSnapshot(keyStatus: .granted, expiresAt: expiry),
            suffix: "7Q2F",
            validatedAt: expiry.addingTimeInterval(-60)
        )
        try assertMetadataExcludesSecrets(
            metadata.value,
            secrets: [rawKey, activationID, replacementKey, replacementActivationID]
        )

        try repository.saveValidation(
            snapshot: PolarLicenseSnapshot(
                keyStatus: .granted,
                expiresAt: expiry.addingTimeInterval(30 * 24 * 60 * 60)
            ),
            validatedAt: expiry
        )
        try assertMetadataExcludesSecrets(
            metadata.value,
            secrets: [rawKey, activationID, replacementKey, replacementActivationID]
        )

        try repository.clearEntitlement()
        try assertMetadataExcludesSecrets(
            metadata.value,
            secrets: [rawKey, activationID, replacementKey, replacementActivationID]
        )

        try repository.saveActivation(
            credentials: PolarLicenseCredentials(
                key: replacementKey,
                activationID: replacementActivationID
            ),
            snapshot: PolarLicenseSnapshot(keyStatus: .granted, expiresAt: expiry),
            suffix: "7Q2F",
            validatedAt: expiry
        )
        try assertMetadataExcludesSecrets(
            metadata.value,
            secrets: [rawKey, activationID, replacementKey, replacementActivationID]
        )
    }

    func testClearAttemptsBothStoresAndPreservesInstallationSuffix() throws {
        let credentials = MemoryPolarCredentialStore()
        let metadata = MemoryPolarMetadataStore()
        credentials.value = PolarLicenseCredentials(key: "secret", activationID: "activation")
        metadata.value = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: expiry,
            lastValidatedAt: expiry,
            installationSuffix: "7Q2F"
        )
        credentials.failClear = true
        let repository = PolarLicenseRepository(
            credentialStore: credentials,
            metadataStore: metadata,
            suffixGenerator: FixedSuffixGenerator(value: "XXXX")
        )

        XCTAssertThrowsError(try repository.clearEntitlement())

        XCTAssertEqual(credentials.clearCount, 1)
        XCTAssertEqual(metadata.value, PolarLicenseMetadata(installationSuffix: "7Q2F"))
    }

    func testClearPropagatesSuffixPreservationFailureAfterFallbackDelete() throws {
        let credentials = MemoryPolarCredentialStore()
        credentials.value = PolarLicenseCredentials(key: "secret", activationID: "activation")
        let metadata = MemoryPolarMetadataStore()
        metadata.value = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: expiry,
            lastValidatedAt: expiry,
            installationSuffix: "7Q2F"
        )
        metadata.failSave = true
        let repository = PolarLicenseRepository(
            credentialStore: credentials,
            metadataStore: metadata,
            suffixGenerator: FixedSuffixGenerator(value: "XXXX")
        )

        XCTAssertThrowsError(try repository.clearEntitlement()) { error in
            guard case LicenseStorageError.failed(let message) = error else {
                return XCTFail("expected metadata save failure")
            }
            XCTAssertEqual(message, "metadata save failed")
        }

        XCTAssertNil(credentials.value)
        XCTAssertNil(metadata.value)
        XCTAssertEqual(metadata.clearCount, 1)
    }

    func testCorruptMetadataIsRejectedWithoutClearingCredentials() throws {
        let temporary = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let url = temporary.appendingPathComponent("polar-license-metadata.json")
        defer { try? FileManager.default.removeItem(at: temporary) }
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        try Data("{\"schema_version\":99}".utf8).write(to: url)
        let metadataStore = ApplicationSupportPolarLicenseMetadataStore(metadataURL: url)

        XCTAssertThrowsError(try metadataStore.loadMetadata())
    }

    func testExplicitClearRetiresCorruptMetadataAndCredentials() throws {
        let temporary = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let url = temporary.appendingPathComponent("polar-license-metadata.json")
        defer { try? FileManager.default.removeItem(at: temporary) }
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        try Data("{\"schema_version\":99}".utf8).write(to: url)
        let credentials = MemoryPolarCredentialStore()
        credentials.value = PolarLicenseCredentials(
            key: "polar-secret-key",
            activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        )
        let repository = PolarLicenseRepository(
            credentialStore: credentials,
            metadataStore: ApplicationSupportPolarLicenseMetadataStore(metadataURL: url),
            suffixGenerator: FixedSuffixGenerator(value: "7Q2F")
        )

        try repository.clearEntitlement()

        XCTAssertNil(credentials.value)
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        let relaunched = repository.load()
        XCTAssertNil(relaunched.credentials)
        XCTAssertNil(relaunched.metadata)
        XCTAssertFalse(relaunched.storageUnavailable)
    }

    func testTwoRepositoriesGenerateDistinctSameModelLabels() throws {
        let first = PolarLicenseRepository(
            credentialStore: MemoryPolarCredentialStore(),
            metadataStore: MemoryPolarMetadataStore(),
            suffixGenerator: FixedSuffixGenerator(value: "7Q2F")
        )
        let second = PolarLicenseRepository(
            credentialStore: MemoryPolarCredentialStore(),
            metadataStore: MemoryPolarMetadataStore(),
            suffixGenerator: FixedSuffixGenerator(value: "9R3G")
        )
        let label = PolarDeviceLabel(modelProvider: StubPersistenceHardwareModel())

        XCTAssertNotEqual(
            label.makeLabel(suffix: try first.installationSuffix()),
            label.makeLabel(suffix: try second.installationSuffix())
        )
    }

    private func assertMetadataExcludesSecrets(
        _ metadata: PolarLicenseMetadata?,
        secrets: [String]
    ) throws {
        let metadata = try XCTUnwrap(metadata)
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let text = String(decoding: try encoder.encode(metadata), as: UTF8.self)
        for secret in secrets {
            XCTAssertFalse(text.contains(secret))
        }
    }
}

private final class MemoryPolarCredentialStore: PolarLicenseCredentialStorage {
    var value: PolarLicenseCredentials?
    var failClear = false
    private(set) var clearCount = 0

    func loadCredentials() throws -> PolarLicenseCredentials? { value }
    func saveCredentials(_ credentials: PolarLicenseCredentials) throws { value = credentials }
    func clearCredentials() throws {
        clearCount += 1
        if failClear { throw LicenseStorageError.failed("clear failed") }
        value = nil
    }
}

private final class MemoryPolarMetadataStore: PolarLicenseMetadataStorage {
    var value: PolarLicenseMetadata?
    var failSave = false
    private(set) var clearCount = 0
    func loadMetadata() throws -> PolarLicenseMetadata? { value }
    func saveMetadata(_ metadata: PolarLicenseMetadata) throws {
        if failSave { throw LicenseStorageError.failed("metadata save failed") }
        value = metadata
    }
    func clearMetadata() throws {
        clearCount += 1
        value = nil
    }
}

struct FixedSuffixGenerator: PolarInstallationSuffixGenerating {
    let value: String
    func generateSuffix() -> String { value }
}

private struct StubPersistenceHardwareModel: PolarHardwareModelProviding {
    func hardwareModel() -> String? { "Mac14,9" }
}
