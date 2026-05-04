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
        preferences.licensedMonthlyChecksEnabled = true
        preferences.lastLicensedMonthlyCheck = Date(timeIntervalSince1970: 1_799_999_999)
        let policy = UpdateCheckPolicy(
            preferences: preferences,
            now: { Date(timeIntervalSince1970: 1_800_000_000) }
        )

        XCTAssertTrue(policy.shouldRunAutomaticCheck(for: .unlicensed))
        XCTAssertTrue(policy.shouldRunAutomaticCheck(for: .invalid(reason: "bad token")))
        XCTAssertTrue(policy.shouldRunAutomaticCheck(for: .licenseCheckFailed(reason: "storage unavailable")))
    }

    func testLicensedAutomaticChecksRunByDefaultWhenMonthlyToggleIsOff() throws {
        let suiteName = "doc2md.update.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferences = UpdateCheckPreferences(defaults: defaults)
        preferences.licensedMonthlyChecksEnabled = false
        preferences.lastLicensedMonthlyCheck = Date(timeIntervalSince1970: 1_799_999_999)
        let policy = UpdateCheckPolicy(
            preferences: preferences,
            now: { Date(timeIntervalSince1970: 1_800_000_000) }
        )

        XCTAssertTrue(policy.shouldRunAutomaticCheck(for: .licensed(try LicenseFixtureFactory().verifiedLicense())))
    }

    func testLicensedMonthlyToggleUsesMonthlyCadence() throws {
        let suiteName = "doc2md.update.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferences = UpdateCheckPreferences(defaults: defaults)
        preferences.licensedMonthlyChecksEnabled = true
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let policy = UpdateCheckPolicy(preferences: preferences, now: { now })
        let licenseState = LicenseState.licensed(try LicenseFixtureFactory().verifiedLicense())

        XCTAssertTrue(policy.shouldRunAutomaticCheck(for: licenseState))

        preferences.lastLicensedMonthlyCheck = now.addingTimeInterval(-29 * 24 * 60 * 60)
        XCTAssertFalse(policy.shouldRunAutomaticCheck(for: licenseState))

        preferences.lastLicensedMonthlyCheck = now.addingTimeInterval(-31 * 24 * 60 * 60)
        XCTAssertTrue(policy.shouldRunAutomaticCheck(for: licenseState))
    }

    func testRecordAutomaticCheckDoesNotWriteMonthlyTimestampWhenToggleIsOff() throws {
        let suiteName = "doc2md.update.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferences = UpdateCheckPreferences(defaults: defaults)
        preferences.licensedMonthlyChecksEnabled = false
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let policy = UpdateCheckPolicy(preferences: preferences, now: { now })

        policy.recordAutomaticCheck(for: .licensed(try LicenseFixtureFactory().verifiedLicense()))

        XCTAssertNil(preferences.lastLicensedMonthlyCheck)
    }

    func testRecordAutomaticCheckWritesMonthlyTimestampWhenToggleIsOn() throws {
        let suiteName = "doc2md.update.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let preferences = UpdateCheckPreferences(defaults: defaults)
        preferences.licensedMonthlyChecksEnabled = true
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let policy = UpdateCheckPolicy(preferences: preferences, now: { now })

        policy.recordAutomaticCheck(for: .licensed(try LicenseFixtureFactory().verifiedLicense()))

        XCTAssertEqual(preferences.lastLicensedMonthlyCheck, now)
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
