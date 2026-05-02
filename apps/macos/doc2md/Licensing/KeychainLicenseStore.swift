import Foundation
import Security

final class KeychainLicenseStore: LicenseTokenStorage {
    private let service = "com.kjellkod.doc2md.license"
    private let account = "doc2md-license-token"

    func loadToken() throws -> StoredLicenseCandidate {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return .missing
        }
        guard status == errSecSuccess else {
            throw LicenseStorageError.failed("Keychain read failed.")
        }
        guard let data = item as? Data,
              let token = String(data: data, encoding: .utf8)
        else {
            return .available("")
        }
        return .available(token)
    }

    func saveToken(_ token: String) throws {
        try clearToken()

        var attributes = baseQuery()
        attributes[kSecValueData as String] = Data(token.utf8)
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw LicenseStorageError.failed("Keychain write failed.")
        }
    }

    func clearToken() throws {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw LicenseStorageError.failed("Keychain delete failed.")
        }
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any
        ]
    }

    func queryAttributesForTesting() -> [String: Any] {
        baseQuery()
    }
}
