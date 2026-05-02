import Foundation
import XCTest

final class LicenseReminderControllerTests: XCTestCase {
    func testReminderShowsOnSaveTenAndThirtyFiveOnlyForUnlicensedState() {
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
        XCTAssertFalse(reminder.shouldShowReminder(afterSuccessfulSaveCount: 34))
        XCTAssertTrue(reminder.shouldShowReminder(afterSuccessfulSaveCount: 35))
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
}

