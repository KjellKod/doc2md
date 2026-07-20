import Combine
import Foundation
import XCTest

final class LicenseStateTests: XCTestCase {
    private let day: TimeInterval = 24 * 60 * 60
    private let expiry = Date(timeIntervalSince1970: 1_800_000_000)

    func testGrantedBoundariesFollowLifecycleWindow() {
        let claims = makeClaims(expiresAt: expiry)
        let cases: [(offset: TimeInterval, expected: LicenseState)] = [
            (-8 * day, .licensed(claims)),
            (-7 * day, .licensed(claims)),
            (-1 * day, .licensed(claims)),
            (0, .grace(claims)),
            (1 * day, .grace(claims)),
            (7 * day - 1, .grace(claims)),
            (7 * day, .expiredReminder(claims)),
            (8 * day, .expiredReminder(claims))
        ]

        for testCase in cases {
            XCTAssertEqual(
                LicenseState.evaluate(
                    claims: claims,
                    keyStatus: .granted,
                    now: expiry.addingTimeInterval(testCase.offset),
                    lastValidatedAt: expiry.addingTimeInterval(-8 * day)
                ),
                testCase.expected,
                "unexpected state at offset \(testCase.offset)"
            )
        }
    }

    func testRevokedAndDisabledHonorPaidPeriodThenSkipGrace() {
        let claims = makeClaims(expiresAt: expiry)

        for status in [LicenseKeyStatus.revoked, .disabled] {
            XCTAssertEqual(
                LicenseState.evaluate(
                    claims: claims,
                    keyStatus: status,
                    now: expiry.addingTimeInterval(-1),
                    lastValidatedAt: expiry.addingTimeInterval(-day)
                ),
                .licensed(claims)
            )
            XCTAssertEqual(
                LicenseState.evaluate(
                    claims: claims,
                    keyStatus: status,
                    now: expiry,
                    lastValidatedAt: expiry
                ),
                .expiredReminder(claims)
            )
            XCTAssertEqual(
                LicenseState.evaluate(
                    claims: claims,
                    keyStatus: status,
                    now: expiry.addingTimeInterval(day),
                    lastValidatedAt: expiry
                ),
                .expiredReminder(claims)
            )
        }
    }

    func testValidationRecencyDoesNotExtendPastCachedExpiry() {
        let claims = makeClaims(expiresAt: expiry)

        XCTAssertEqual(
            LicenseState.evaluate(
                claims: claims,
                keyStatus: .granted,
                now: expiry,
                lastValidatedAt: expiry.addingTimeInterval(-1)
            ),
            .grace(claims)
        )
        XCTAssertEqual(
            LicenseState.evaluate(
                claims: claims,
                keyStatus: .granted,
                now: expiry.addingTimeInterval(day),
                lastValidatedAt: expiry.addingTimeInterval(1)
            ),
            .expiredReminder(claims)
        )
        XCTAssertEqual(
            LicenseState.evaluate(
                claims: claims,
                keyStatus: .granted,
                now: expiry,
                lastValidatedAt: expiry
            ),
            .grace(claims),
            "validation at expiry is not a post-expiry definitive answer"
        )
    }

    func testNoExpiryAndRefreshedExpiryStates() {
        let nonExpiringClaims = makeClaims(expiresAt: nil)
        XCTAssertEqual(
            LicenseState.evaluate(
                claims: nonExpiringClaims,
                keyStatus: .granted,
                now: expiry,
                lastValidatedAt: nil
            ),
            .licensed(nonExpiringClaims)
        )

        for status in [LicenseKeyStatus.revoked, .disabled] {
            XCTAssertEqual(
                LicenseState.evaluate(
                    claims: nonExpiringClaims,
                    keyStatus: status,
                    now: expiry,
                    lastValidatedAt: expiry
                ),
                .expiredReminder(nonExpiringClaims)
            )
        }

        let refreshedClaims = makeClaims(expiresAt: expiry.addingTimeInterval(30 * day))
        XCTAssertEqual(
            LicenseState.evaluate(
                claims: refreshedClaims,
                keyStatus: .granted,
                now: expiry.addingTimeInterval(8 * day),
                lastValidatedAt: expiry.addingTimeInterval(8 * day)
            ),
            .licensed(refreshedClaims)
        )
    }

    func testPolicySignalsAreStateSpecific() {
        let claims = makeClaims(expiresAt: expiry)

        XCTAssertFalse(LicenseState.licensed(claims).allowsReminders)
        XCTAssertFalse(LicenseState.grace(claims).allowsReminders)
        XCTAssertTrue(LicenseState.expiredReminder(claims).allowsReminders)

        XCTAssertFalse(LicenseState.licensed(claims).licensedConveniencesPaused)
        XCTAssertFalse(LicenseState.grace(claims).licensedConveniencesPaused)
        XCTAssertTrue(LicenseState.expiredReminder(claims).licensedConveniencesPaused)
        XCTAssertFalse(LicenseState.unlicensed.licensedConveniencesPaused)
        XCTAssertFalse(LicenseState.invalid(reason: "invalid").licensedConveniencesPaused)
        XCTAssertFalse(LicenseState.licenseCheckFailed(reason: "unavailable").licensedConveniencesPaused)

        // Future convenience eligibility must match licensed/grace explicitly,
        // never infer eligibility by negating licensedConveniencesPaused.
    }

    func testControllerEvaluatesCachedSnapshotWheneverStateIsRead() {
        var now = expiry.addingTimeInterval(-day)
        let controller = makeUnlicensedController(now: { now })
        let claims = makeClaims(expiresAt: expiry)
        controller.applyCachedLicenseSnapshot(
            CachedLicenseSnapshot(
                claims: claims,
                keyStatus: .granted,
                lastValidatedAt: expiry.addingTimeInterval(-8 * day)
            )
        )

        XCTAssertEqual(controller.state, .licensed(claims))

        now = expiry
        XCTAssertEqual(controller.state, .grace(claims))

        now = expiry.addingTimeInterval(7 * day)
        XCTAssertEqual(controller.state, .expiredReminder(claims))
    }

    func testControllerEvaluatesStoredLicenseWheneverStateIsRead() throws {
        let initialNow = expiry.addingTimeInterval(-day)
        let fixture = LicenseFixtureFactory(now: initialNow)
        let token = try fixture.token(
            issuedAt: expiry.addingTimeInterval(-30 * day),
            expiresAt: expiry,
            entitlement: "subscription",
            merchantProvider: "polar"
        )
        let claims = try LicenseToken(rawValue: token).claims
        var now = initialNow
        let controller = LicenseController(
            store: LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(candidate: .available(token)),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: fixture.verifier()
            ),
            now: { now }
        )

        XCTAssertEqual(controller.state, .licensed(claims))

        now = expiry
        XCTAssertEqual(controller.state, .grace(claims))

        now = expiry.addingTimeInterval(7 * day)
        XCTAssertEqual(controller.state, .expiredReminder(claims))
    }

    func testControllerEvaluatesEnteredLicenseWheneverStateIsRead() throws {
        let initialNow = expiry.addingTimeInterval(-day)
        let fixture = LicenseFixtureFactory(now: initialNow)
        let token = try fixture.token(
            issuedAt: expiry.addingTimeInterval(-30 * day),
            expiresAt: expiry,
            entitlement: "subscription",
            merchantProvider: "polar"
        )
        let claims = try LicenseToken(rawValue: token).claims
        var now = initialNow
        let controller = LicenseController(
            store: LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: fixture.verifier()
            ),
            now: { now }
        )

        XCTAssertEqual(controller.enterLicense(token), .licensed(claims))

        now = expiry
        XCTAssertEqual(controller.state, .grace(claims))

        now = expiry.addingTimeInterval(7 * day)
        XCTAssertEqual(controller.state, .expiredReminder(claims))
    }

    func testApplyingRefreshedSnapshotPublishesAndRecoversLicensedState() {
        let now = expiry.addingTimeInterval(8 * day)
        let controller = makeUnlicensedController(now: { now })
        let expiredClaims = makeClaims(expiresAt: expiry)
        controller.applyCachedLicenseSnapshot(
            CachedLicenseSnapshot(
                claims: expiredClaims,
                keyStatus: .granted,
                lastValidatedAt: expiry.addingTimeInterval(-day)
            )
        )
        XCTAssertEqual(controller.state, .expiredReminder(expiredClaims))

        let published = expectation(description: "snapshot application publishes controller change")
        let cancellable = controller.objectWillChange.sink { _ in
            published.fulfill()
        }
        let refreshedClaims = makeClaims(expiresAt: expiry.addingTimeInterval(30 * day))

        controller.applyCachedLicenseSnapshot(
            CachedLicenseSnapshot(
                claims: refreshedClaims,
                keyStatus: .granted,
                lastValidatedAt: now
            )
        )

        wait(for: [published], timeout: 1)
        XCTAssertEqual(controller.state, .licensed(refreshedClaims))
        withExtendedLifetime(cancellable) {}
    }

    func testLocalLicenseActionsClearCachedSnapshot() throws {
        let fixture = LicenseFixtureFactory(now: expiry)
        let keychain = InMemoryLicenseTokenStorage()
        let controller = LicenseController(
            store: LicenseStore(
                keychainStore: keychain,
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: fixture.verifier()
            ),
            now: { self.expiry }
        )
        let expiredClaims = makeClaims(expiresAt: expiry.addingTimeInterval(-8 * day))
        controller.applyCachedLicenseSnapshot(
            CachedLicenseSnapshot(
                claims: expiredClaims,
                keyStatus: .granted,
                lastValidatedAt: expiry.addingTimeInterval(-9 * day)
            )
        )
        XCTAssertEqual(controller.state, .expiredReminder(expiredClaims))

        let verified = try fixture.verifiedLicense()
        XCTAssertEqual(controller.enterLicense(verified.token), .licensed(verified.claims))

        controller.applyCachedLicenseSnapshot(
            CachedLicenseSnapshot(
                claims: expiredClaims,
                keyStatus: .granted,
                lastValidatedAt: expiry.addingTimeInterval(-9 * day)
            )
        )
        controller.clearLicense()
        XCTAssertEqual(controller.state, .unlicensed)
    }

    private func makeUnlicensedController(now: @escaping () -> Date) -> LicenseController {
        LicenseController(
            store: LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: LicenseVerifier(publicKeys: [])
            ),
            now: now
        )
    }

    private func makeClaims(expiresAt: Date?) -> LicenseClaims {
        LicenseClaims(
            version: 1,
            keyID: "cached-polar-snapshot",
            licenseID: "license-id",
            purchaser: LicensePurchaser(email: "dev@example.com", displayName: "Dev Tester"),
            tier: "individual",
            issuedAt: expiry.addingTimeInterval(-30 * day),
            entitlement: "subscription",
            merchant: LicenseMerchant(provider: "polar", customerID: nil, orderID: nil),
            expiresAt: expiresAt,
            supportThrough: nil,
            updatesThrough: nil,
            majorVersionLimit: nil
        )
    }
}
