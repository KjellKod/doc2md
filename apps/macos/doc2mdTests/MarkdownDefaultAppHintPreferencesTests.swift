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
        closeHelpWindows()
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

    func testFirstRunHintShowsAtMostOncePerLaunch() {
        let preferences = MarkdownDefaultAppHintPreferences(defaults: defaults)
        let controller = MarkdownDefaultAppHelpController(preferences: preferences)

        // Simulates the main window's onAppear firing on every Finder open: a
        // cold launch plus repeated double-clicks into an already-running app.
        controller.presentFirstRunHintIfNeeded()
        controller.presentFirstRunHintIfNeeded()
        controller.presentFirstRunHintIfNeeded()

        XCTAssertEqual(controller.firstRunHintPresentationCount, 1)
    }

    func testHelpPresentationDoesNotReuseFirstRunCheckbox() throws {
        let preferences = MarkdownDefaultAppHintPreferences(defaults: defaults)
        let controller = MarkdownDefaultAppHelpController(preferences: preferences)

        controller.presentFirstRunHintIfNeeded()
        XCTAssertTrue(controller.currentPresentationShowsDontShowAgain)

        controller.presentHelp()
        XCTAssertFalse(controller.currentPresentationShowsDontShowAgain)
        XCTAssertFalse(preferences.hasDismissedHint)
    }

    private func closeHelpWindows() {
        for window in NSApp.windows where window.title == "Default Markdown App" {
            window.close()
        }
    }
}
