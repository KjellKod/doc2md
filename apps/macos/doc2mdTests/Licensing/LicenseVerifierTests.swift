import CryptoKit
import Foundation
import XCTest

final class LicenseVerifierTests: XCTestCase {
    func testTrustedPublicKeysAreReleaseSafeAndDecodable() throws {
        for publicKey in LicensePublicKeys.trustedKeys {
            XCTAssertFalse(publicKey.isDevelopmentKey)
            let decoded = try LicenseToken.base64URLDecode(publicKey.publicKeyBase64)

            XCTAssertNoThrow(try Curve25519.Signing.PublicKey(rawRepresentation: decoded))
        }
    }

    func testDefaultVerifierDoesNotTrustTestOnlyFixtureKeys() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token()

        let result = LicenseVerifier(now: { fixture.now }).verify(token)

        XCTAssertEqual(result, .failure(.unknownKeyID))
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
        XCTAssertEqual(verified.claims.purchaser.email, "dev@example.com")
        XCTAssertEqual(verified.claims.entitlement, "perpetual")
        XCTAssertEqual(verified.claims.merchant.provider, "test_merchant")
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
            purchaser: LicensePurchaser(email: "second@example.com", displayName: nil),
            tier: "individual",
            issuedAt: fixture.now,
            entitlement: "perpetual",
            merchant: LicenseMerchant(
                provider: "test_merchant",
                customerID: nil,
                orderID: nil
            ),
            expiresAt: nil,
            supportThrough: nil,
            updatesThrough: nil,
            majorVersionLimit: nil
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        let replacementSegment = LicenseToken.base64URLEncode(try encoder.encode(replacementClaims))
        let tampered = "\(parts[0]).\(replacementSegment).\(parts[2])"

        XCTAssertEqual(fixture.verifier().verify(tampered), .failure(.invalidSignature))
    }

    func testKeyRotationVerifiesTokensFromMultiplePublicKeys() throws {
        let firstFixture = LicenseFixtureFactory(keyID: "test-key-1")
        let secondFixture = LicenseFixtureFactory(keyID: "test-key-2")
        let verifier = LicenseVerifier(
            publicKeys: [firstFixture.publicKey, secondFixture.publicKey],
            now: { firstFixture.now }
        )

        XCTAssertSuccess(verifier.verify(try firstFixture.token()))
        XCTAssertSuccess(verifier.verify(try secondFixture.token()))
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

    func testOptionalLifecycleFieldsAreAccepted() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(
            supportThrough: fixture.now.addingTimeInterval(86_400),
            updatesThrough: fixture.now.addingTimeInterval(172_800),
            majorVersionLimit: 2,
            displayName: "Dev Tester"
        )

        let result = fixture.verifier().verify(token)

        guard case .success(let verified) = result else {
            XCTFail("expected lifecycle token to verify")
            return
        }
        XCTAssertEqual(verified.claims.supportThrough, fixture.now.addingTimeInterval(86_400))
        XCTAssertEqual(verified.claims.updatesThrough, fixture.now.addingTimeInterval(172_800))
        XCTAssertEqual(verified.claims.majorVersionLimit, 2)
        XCTAssertEqual(verified.claims.purchaser.displayName, "Dev Tester")
    }

    func testMissingPurchaserIsMalformed() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(jsonObject: fixture.claimsJSON(purchaser: nil))

        XCTAssertEqual(fixture.verifier().verify(token), .failure(.malformedClaims))
    }

    func testMissingPurchaserEmailIsMalformed() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(jsonObject: fixture.claimsJSON(purchaser: [:]))

        XCTAssertEqual(fixture.verifier().verify(token), .failure(.malformedClaims))
    }

    func testMissingMerchantIsMalformed() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(jsonObject: fixture.claimsJSON(merchant: nil))

        XCTAssertEqual(fixture.verifier().verify(token), .failure(.malformedClaims))
    }

    func testMissingMerchantProviderIsMalformed() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(jsonObject: fixture.claimsJSON(merchant: [:]))

        XCTAssertEqual(fixture.verifier().verify(token), .failure(.malformedClaims))
    }

    func testMissingEntitlementIsMalformed() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token(jsonObject: fixture.claimsJSON(entitlement: nil))

        XCTAssertEqual(fixture.verifier().verify(token), .failure(.malformedClaims))
    }

    func testNonNumericDateClaimIsMalformed() throws {
        let fixture = LicenseFixtureFactory()
        var claims = fixture.claimsJSON()
        claims["issued_at"] = "2026-05-07T00:00:00Z"
        let token = try fixture.token(jsonObject: claims)

        XCTAssertEqual(fixture.verifier().verify(token), .failure(.malformedClaims))
    }

    func testFractionalDateClaimsAreMalformed() throws {
        let dateClaimNames = [
            "issued_at",
            "expires_at",
            "support_through",
            "updates_through"
        ]
        for claimName in dateClaimNames {
            let fixture = LicenseFixtureFactory()
            var claims = fixture.claimsJSON()
            claims[claimName] = fixture.now.timeIntervalSince1970 + 0.5
            let token = try fixture.token(jsonObject: claims)

            XCTAssertEqual(
                fixture.verifier().verify(token),
                .failure(.malformedClaims),
                "\(claimName) should require integer Unix seconds"
            )
        }
    }

    private func XCTAssertSuccess(
        _ result: Result<VerifiedLicense, LicenseVerificationError>,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        if case .failure(let error) = result {
            XCTFail("expected successful verification, got \(error)", file: file, line: line)
        }
    }
}
