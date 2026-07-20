import Foundation
import XCTest

final class LicenseReminderControllerTests: XCTestCase {
    func testReminderUsesShippedCadenceForUnlicensedState() {
        let licenseController = LicenseController(
            store: LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: LicenseVerifier(publicKeys: [])
            )
        )
        let reminder = LicenseReminderController(
            licenseController: licenseController,
            onEnterLicense: {},
            showAlert: { _ in .alertSecondButtonReturn }
        )

        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 9))
        XCTAssertTrue(reminder.shouldShowReminder(afterSuccessfulSaveCount: 10))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 11))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 34))
        XCTAssertTrue(reminder.shouldShowReminder(afterSuccessfulSaveCount: 35))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 36))
        XCTAssertTrue(reminder.shouldShowReminder(afterSuccessfulSaveCount: 60))
    }

    func testLicensedStateSuppressesRemindersAtAllSaveCounts() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token()
        let licenseController = LicenseController(
            store: LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(candidate: .available(token)),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: fixture.verifier()
            )
        )
        let reminder = LicenseReminderController(
            licenseController: licenseController,
            onEnterLicense: {},
            showAlert: { _ in .alertSecondButtonReturn }
        )

        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 10))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 35))
    }

    func testGraceSuppressesReminders() {
        let expiry = Date(timeIntervalSince1970: 1_800_000_000)
        let licenseController = makeController(now: expiry)
        licenseController.applyCachedLicenseSnapshot(
            CachedLicenseSnapshot(
                claims: makeClaims(expiresAt: expiry),
                keyStatus: .granted,
                lastValidatedAt: expiry.addingTimeInterval(-1)
            )
        )
        let reminder = makeReminder(licenseController: licenseController)

        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 10))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 35))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 60))
    }

    func testExpiredReminderReenablesShippedCadence() {
        let expiry = Date(timeIntervalSince1970: 1_800_000_000)
        let licenseController = makeController(now: expiry.addingTimeInterval(8 * 24 * 60 * 60))
        licenseController.applyCachedLicenseSnapshot(
            CachedLicenseSnapshot(
                claims: makeClaims(expiresAt: expiry),
                keyStatus: .granted,
                lastValidatedAt: expiry.addingTimeInterval(-1)
            )
        )
        let reminder = makeReminder(licenseController: licenseController)

        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 9))
        XCTAssertTrue(reminder.shouldShowReminder(afterSuccessfulSaveCount: 10))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 11))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 34))
        XCTAssertTrue(reminder.shouldShowReminder(afterSuccessfulSaveCount: 35))
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 36))
        XCTAssertTrue(reminder.shouldShowReminder(afterSuccessfulSaveCount: 60))
    }

    private func makeController(now: Date) -> LicenseController {
        LicenseController(
            store: LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: LicenseVerifier(publicKeys: [])
            ),
            now: { now }
        )
    }

    private func makeReminder(licenseController: LicenseController) -> LicenseReminderController {
        LicenseReminderController(
            licenseController: licenseController,
            onEnterLicense: {},
            showAlert: { _ in .alertSecondButtonReturn }
        )
    }

    private func makeClaims(expiresAt: Date) -> LicenseClaims {
        LicenseClaims(
            version: 1,
            keyID: "cached-polar-snapshot",
            licenseID: "license-id",
            purchaser: LicensePurchaser(email: "dev@example.com", displayName: nil),
            tier: "individual",
            issuedAt: expiresAt.addingTimeInterval(-30 * 24 * 60 * 60),
            entitlement: "subscription",
            merchant: LicenseMerchant(provider: "polar", customerID: nil, orderID: nil),
            expiresAt: expiresAt,
            supportThrough: nil,
            updatesThrough: nil,
            majorVersionLimit: nil
        )
    }
}
