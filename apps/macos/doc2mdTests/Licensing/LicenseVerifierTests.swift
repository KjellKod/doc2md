import CryptoKit
import Foundation
import XCTest

final class LicenseVerifierTests: XCTestCase {
    func testTrustedPublicKeysAreDecodableForDefaultVerifier() throws {
        for publicKey in LicensePublicKeys.trustedKeys {
            let decoded = try LicenseToken.base64URLDecode(publicKey.publicKeyBase64)

            XCTAssertNoThrow(try Curve25519.Signing.PublicKey(rawRepresentation: decoded))
        }
    }

    func testDefaultVerifierUsesTrustedPublicKeyForSignatureValidation() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(keyID: LicensePublicKeys.developmentKeyID)

        let result = LicenseVerifier(now: { fixture.now }).verify(token)

        XCTAssertEqual(result, .failure(.invalidSignature))
    }

    func testValidTokenVerifiesWithMatchingPublicKey() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token()

        let result = fixture.verifier().verify(token)

        guard case .success(let verified) = result else {
            XCTFail("expected valid token")
            return
        }
        XCTAssertEqual(verified.token, token)
        XCTAssertEqual(verified.claims.keyID, fixture.publicKey.keyID)
    }

    func testMalformedSegmentCountIsRejected() {
        let result = LicenseVerifier(publicKeys: []).verify("doc2md-license-v1.only-two")

        XCTAssertEqual(result, .failure(.malformedToken))
    }

    func testInvalidBase64URLIsRejected() {
        let result = LicenseVerifier(publicKeys: []).verify("doc2md-license-v1.%%%.abc")

        XCTAssertEqual(result, .failure(.invalidBase64URL))
    }

    func testWrongPrefixVersionIsRejectedBeforeSignatureAcceptance() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token().replacingOccurrences(
            of: "doc2md-license-v1",
            with: "doc2md-license-v2"
        )

        XCTAssertEqual(fixture.verifier().verify(token), .failure(.unsupportedVersion))
    }

    func testModifiedClaimsAreRejected() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(purchaser: "first@example.com")
        let parts = token.split(separator: ".").map(String.init)
        let replacementClaims = LicenseClaims(
            version: 1,
            keyID: fixture.publicKey.keyID,
            licenseID: "tampered",
            purchaser: "second@example.com",
            tier: "individual",
            issuedAt: fixture.now,
            expiresAt: nil,
            merchantCustomerID: nil,
            merchantOrderID: nil
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        let replacementSegment = LicenseToken.base64URLEncode(try encoder.encode(replacementClaims))
        let tampered = "\(parts[0]).\(replacementSegment).\(parts[2])"

        XCTAssertEqual(fixture.verifier().verify(tampered), .failure(.invalidSignature))
    }

    func testUnknownKeyIDIsRejected() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(keyID: "unknown-key")

        XCTAssertEqual(fixture.verifier().verify(token), .failure(.unknownKeyID))
    }

    func testExpiredAndNotYetValidTokensRespectFiveMinuteTolerance() throws {
        let fixture = LicenseFixtureFactory()
        let expiredOutsideTolerance = try fixture.token(
            expiresAt: fixture.now.addingTimeInterval(-301)
        )
        let notYetValidOutsideTolerance = try fixture.token(
            issuedAt: fixture.now.addingTimeInterval(301)
        )
        let expiredInsideTolerance = try fixture.token(
            expiresAt: fixture.now.addingTimeInterval(-299)
        )

        XCTAssertEqual(fixture.verifier().verify(expiredOutsideTolerance), .failure(.expired))
        XCTAssertEqual(fixture.verifier().verify(notYetValidOutsideTolerance), .failure(.notYetValid))
        if case .failure(let error) = fixture.verifier().verify(expiredInsideTolerance) {
            XCTFail("expected token inside clock skew to verify, got \(error)")
        }
    }
}
