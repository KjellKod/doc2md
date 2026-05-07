import CryptoKit
import Foundation

final class InMemoryLicenseTokenStorage: LicenseTokenStorage {
    var candidate: StoredLicenseCandidate
    private(set) var savedTokens: [String] = []
    private(set) var clearCount = 0
    var candidateAfterSave: StoredLicenseCandidate?
    var failSave = false
    var failClear = false

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
        candidate = candidateAfterSave ?? .available(token)
    }

    func clearToken() throws {
        clearCount += 1
        if failClear {
            throw LicenseStorageError.failed("clear failed")
        }
        candidate = .missing
    }
}

struct LicenseFixtureFactory {
    let signingIdentity: Curve25519.Signing.PrivateKey
    let publicKey: LicensePublicKey
    let now: Date

    init(
        keyID: String = "test-key",
        now: Date = Date(timeIntervalSince1970: 1_800_000_000)
    ) {
        signingIdentity = Curve25519.Signing.PrivateKey()
        publicKey = LicensePublicKey(
            keyID: keyID,
            publicKeyBase64: LicenseToken.base64URLEncode(signingIdentity.publicKey.rawRepresentation),
            isDevelopmentKey: true
        )
        self.now = now
    }

    func token(
        keyID: String? = nil,
        issuedAt: Date? = nil,
        expiresAt: Date? = nil,
        supportThrough: Date? = nil,
        updatesThrough: Date? = nil,
        majorVersionLimit: Int? = nil,
        purchaser: String = "dev@example.com",
        displayName: String? = nil,
        entitlement: String = "perpetual",
        merchantProvider: String = "test_merchant"
    ) throws -> String {
        let claims = LicenseClaims(
            version: 1,
            keyID: keyID ?? publicKey.keyID,
            licenseID: UUID().uuidString,
            purchaser: LicensePurchaser(email: purchaser, displayName: displayName),
            tier: "individual",
            issuedAt: issuedAt ?? now,
            entitlement: entitlement,
            merchant: LicenseMerchant(
                provider: merchantProvider,
                customerID: "test-only-customer-id",
                orderID: "test-only-order-id"
            ),
            expiresAt: expiresAt,
            supportThrough: supportThrough,
            updatesThrough: updatesThrough,
            majorVersionLimit: majorVersionLimit
        )
        return try token(claims: claims)
    }

    func token(claims: LicenseClaims) throws -> String {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        return try token(claimsData: encoder.encode(claims))
    }

    func token(jsonObject: [String: Any]) throws -> String {
        let claimsData = try JSONSerialization.data(
            withJSONObject: jsonObject,
            options: [.sortedKeys]
        )
        return try token(claimsData: claimsData)
    }

    func claimsJSON(
        keyID: String? = nil,
        issuedAt: Date? = nil,
        expiresAt: Date? = nil,
        supportThrough: Date? = nil,
        updatesThrough: Date? = nil,
        majorVersionLimit: Int? = nil,
        purchaser: [String: Any]? = ["email": "dev@example.com"],
        entitlement: String? = "perpetual",
        merchant: [String: Any]? = [
            "provider": "test_merchant",
            "customer_id": "test-only-customer-id",
            "order_id": "test-only-order-id"
        ]
    ) -> [String: Any] {
        var claims: [String: Any] = [
            "version": 1,
            "key_id": keyID ?? publicKey.keyID,
            "license_id": UUID().uuidString,
            "tier": "individual",
            "issued_at": Int((issuedAt ?? now).timeIntervalSince1970)
        ]
        if let purchaser {
            claims["purchaser"] = purchaser
        }
        if let entitlement {
            claims["entitlement"] = entitlement
        }
        if let merchant {
            claims["merchant"] = merchant
        }
        if let expiresAt {
            claims["expires_at"] = Int(expiresAt.timeIntervalSince1970)
        }
        if let supportThrough {
            claims["support_through"] = Int(supportThrough.timeIntervalSince1970)
        }
        if let updatesThrough {
            claims["updates_through"] = Int(updatesThrough.timeIntervalSince1970)
        }
        if let majorVersionLimit {
            claims["major_version_limit"] = majorVersionLimit
        }
        return claims
    }

    private func token(claimsData: Data) throws -> String {
        let claimsSegment = LicenseToken.base64URLEncode(claimsData)
        let signedString = "\(LicenseToken.prefix).\(claimsSegment)"
        let signature = try signingIdentity.signature(for: Data(signedString.utf8))
        return "\(signedString).\(LicenseToken.base64URLEncode(signature))"
    }

    func verifier(now: Date? = nil) -> LicenseVerifier {
        LicenseVerifier(publicKeys: [publicKey], now: { now ?? self.now })
    }

    func verifiedLicense() throws -> VerifiedLicense {
        let token = try token()
        switch verifier().verify(token) {
        case .success(let verified):
            return verified
        case .failure(let error):
            throw error
        }
    }
}
