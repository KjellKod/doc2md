import CryptoKit
import Foundation

final class InMemoryLicenseTokenStorage: LicenseTokenStorage {
    var candidate: StoredLicenseCandidate
    private(set) var savedTokens: [String] = []
    private(set) var clearCount = 0
    var failSave = false

    init(candidate: StoredLicenseCandidate = .missing) {
        self.candidate = candidate
    }

    func loadToken() throws -> StoredLicenseCandidate {
        candidate
    }

    func saveToken(_ token: String) throws {
        if failSave {
            throw LicenseStorageError.failed("save failed")
        }
        savedTokens.append(token)
        candidate = .available(token)
    }

    func clearToken() throws {
        clearCount += 1
        candidate = .missing
    }
}

struct LicenseFixtureFactory {
    let privateKey: Curve25519.Signing.PrivateKey
    let publicKey: LicensePublicKey
    let now: Date

    init(now: Date = Date(timeIntervalSince1970: 1_800_000_000)) {
        privateKey = Curve25519.Signing.PrivateKey()
        publicKey = LicensePublicKey(
            keyID: "test-key",
            publicKeyBase64: LicenseToken.base64URLEncode(privateKey.publicKey.rawRepresentation),
            isDevelopmentKey: true
        )
        self.now = now
    }

    func token(
        keyID: String? = nil,
        issuedAt: Date? = nil,
        expiresAt: Date? = nil,
        purchaser: String = "dev@example.com"
    ) throws -> String {
        let claims = LicenseClaims(
            version: 1,
            keyID: keyID ?? publicKey.keyID,
            licenseID: UUID().uuidString,
            purchaser: purchaser,
            tier: "individual",
            issuedAt: issuedAt ?? now,
            expiresAt: expiresAt,
            merchantCustomerID: "cus_test",
            merchantOrderID: "ord_test"
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        let claimsData = try encoder.encode(claims)
        let claimsSegment = LicenseToken.base64URLEncode(claimsData)
        let signedString = "\(LicenseToken.prefix).\(claimsSegment)"
        let signature = try privateKey.signature(for: Data(signedString.utf8))
        return "\(signedString).\(LicenseToken.base64URLEncode(signature))"
    }

    func verifier(now: Date? = nil) -> LicenseVerifier {
        LicenseVerifier(publicKeys: [publicKey], now: { now ?? self.now })
    }
}

