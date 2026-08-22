import Foundation
import XCTest

final class PolarLicensePresentationTests: XCTestCase {
    private let expiry = Date(timeIntervalSince1970: 1_800_000_000)

    func testPolarLicensedAndGraceCopyUsesExpiryWithoutEmptyClaims() {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        let entitlement = LicenseEntitlement(expiresAt: expiry)

        XCTAssertEqual(
            LicensePresentation.details(for: .licensed(entitlement), dateFormatter: formatter),
            "Your Polar license is active through 2027-01-15."
        )
        XCTAssertEqual(
            LicensePresentation.details(for: .grace(entitlement), dateFormatter: formatter),
            "Your Polar license expired on 2027-01-15. doc2md remains fully usable during the grace period."
        )
    }

    func testLegacyCopyIsUnchanged() throws {
        let claims = try LicenseFixtureFactory().verifiedLicense().claims

        XCTAssertEqual(
            LicensePresentation.details(for: .licensed(claims)),
            "Licensed to dev@example.com for individual."
        )
        XCTAssertEqual(
            LicensePresentation.details(for: .grace(claims)),
            "Licensed to dev@example.com for individual. The app remains fully usable during the grace period."
        )
    }
}
