import Foundation
import XCTest

final class SparkleUpdatePreferenceTests: XCTestCase {
    func testLicensedMonthlyUpdateChecksDefaultOffAndPersist() {
        let suiteName = "doc2md.update.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferences = UpdateCheckPreferences(defaults: defaults)

        XCTAssertFalse(preferences.licensedMonthlyChecksEnabled)

        preferences.licensedMonthlyChecksEnabled = true

        XCTAssertTrue(UpdateCheckPreferences(defaults: defaults).licensedMonthlyChecksEnabled)
    }

    func testUnlicensedAutomaticChecksHaveNoOptOutFromLicensedToggle() {
        let suiteName = "doc2md.update.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferences = UpdateCheckPreferences(defaults: defaults)
        preferences.licensedMonthlyChecksEnabled = false
        let controller = LicenseController(
            store: LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: LicenseVerifier(publicKeys: [])
            )
        )
        let policy = UpdateCheckPolicy(
            preferences: preferences,
            now: { Date(timeIntervalSince1970: 1_800_000_000) }
        )

        XCTAssertTrue(policy.shouldRunAutomaticCheck(for: controller.state))
    }

    func testLicensedMonthlyToggleDoesNotMutateLicenseState() throws {
        let fixture = LicenseFixtureFactory()
        let token = try fixture.token()
        let controller = LicenseController(
            store: LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(candidate: .available(token)),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: fixture.verifier()
            )
        )
        let originalState = controller.state
        let suiteName = "doc2md.update.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferences = UpdateCheckPreferences(defaults: defaults)

        preferences.licensedMonthlyChecksEnabled = true
        preferences.licensedMonthlyChecksEnabled = false

        XCTAssertEqual(controller.state, originalState)
    }
}
