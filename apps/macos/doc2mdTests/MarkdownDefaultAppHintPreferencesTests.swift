import XCTest

final class MarkdownDefaultAppHintPreferencesTests: XCTestCase {
    private var suiteName = ""
    private var defaults: UserDefaults!

    override func setUpWithError() throws {
        try super.setUpWithError()
        suiteName = "MarkdownDefaultAppHintPreferencesTests-\(UUID().uuidString)"
        defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
    }

    override func tearDownWithError() throws {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        try super.tearDownWithError()
    }

    func testDefaultsToNotDismissed() {
        let preferences = MarkdownDefaultAppHintPreferences(defaults: defaults)
        XCTAssertFalse(preferences.hasDismissedHint)
    }

    func testDontShowAgainPersists() {
        let preferences = MarkdownDefaultAppHintPreferences(defaults: defaults)
        preferences.hasDismissedHint = true

        let reloaded = MarkdownDefaultAppHintPreferences(defaults: defaults)
        XCTAssertTrue(reloaded.hasDismissedHint)
        XCTAssertTrue(
            defaults.bool(forKey: MarkdownDefaultAppHintPreferences.dismissedKey)
        )
    }
}
