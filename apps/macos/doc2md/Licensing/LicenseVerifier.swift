import CryptoKit
import Foundation

enum LicenseVerificationError: Error, Equatable, LocalizedError {
    case malformedToken
    case invalidBase64URL
    case malformedClaims
    case unsupportedVersion
    case unknownKeyID
    case invalidPublicKey
    case invalidSignature
    case notYetValid
    case expired

    var errorDescription: String? {
        switch self {
        case .malformedToken:
            return "The license token is malformed."
        case .invalidBase64URL:
            return "The license token contains invalid encoded data."
        case .malformedClaims:
            return "The license details are malformed."
        case .unsupportedVersion:
            return "This license version is not supported."
        case .unknownKeyID:
            return "This license was signed by an unknown key."
        case .invalidPublicKey:
            return "The configured license verification key is invalid."
        case .invalidSignature:
            return "The license signature is invalid."
        case .notYetValid:
            return "This license is not valid yet."
        case .expired:
            return "This license has expired."
        }
    }
}

struct VerifiedLicense: Equatable {
    let token: String
    let claims: LicenseClaims
}

final class LicenseVerifier {
    private static let clockSkewSeconds: TimeInterval = 5 * 60

    private let publicKeysByID: [String: LicensePublicKey]
    private let now: () -> Date

    init(publicKeys: [LicensePublicKey] = LicensePublicKeys.trustedKeys, now: @escaping () -> Date = Date.init) {
        publicKeysByID = Dictionary(uniqueKeysWithValues: publicKeys.map { ($0.keyID, $0) })
        self.now = now
    }

    func verify(_ rawToken: String) -> Result<VerifiedLicense, LicenseVerificationError> {
        do {
            let token = try LicenseToken(rawValue: rawToken)
            guard let publicKey = publicKeysByID[token.claims.keyID] else {
                return .failure(.unknownKeyID)
            }

            let publicKeyData: Data
            do {
                publicKeyData = try LicenseToken.base64URLDecode(publicKey.publicKeyBase64)
            } catch {
                return .failure(.invalidPublicKey)
            }

            let signingKey: Curve25519.Signing.PublicKey
            do {
                signingKey = try Curve25519.Signing.PublicKey(rawRepresentation: publicKeyData)
            } catch {
                return .failure(.invalidPublicKey)
            }

            guard signingKey.isValidSignature(token.signature, for: token.signedBytes) else {
                return .failure(.invalidSignature)
            }

            let currentDate = now()
            if token.claims.issuedAt > currentDate.addingTimeInterval(Self.clockSkewSeconds) {
                return .failure(.notYetValid)
            }

            if let expiresAt = token.claims.expiresAt,
               expiresAt < currentDate.addingTimeInterval(-Self.clockSkewSeconds) {
                return .failure(.expired)
            }

            return .success(VerifiedLicense(token: token.rawValue, claims: token.claims))
        } catch let error as LicenseVerificationError {
            return .failure(error)
        } catch {
            return .failure(.malformedToken)
        }
    }
}

