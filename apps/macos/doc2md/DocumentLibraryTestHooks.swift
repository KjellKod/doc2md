// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import Foundation

enum DocumentLibraryTestHooks {
    #if DEBUG
    private static let licenseStateKey = "DOC2MD_TEST_LICENSE_STATE"

    static func licenseState(environment: [String: String] = ProcessInfo.processInfo.environment) -> LicenseState? {
        guard let value = environment[licenseStateKey] else {
            return nil
        }

        let entitlement = LicenseEntitlement(expiresAt: nil)
        switch value {
        case "licensed": return .licensed(entitlement)
        case "grace": return .grace(entitlement)
        case "expired-reminder": return .expiredReminder(entitlement)
        case "unlicensed": return .unlicensed
        case "invalid": return .invalid(reason: "Debug override")
        case "license-check-failed": return .licenseCheckFailed(reason: "Debug override")
        default: return nil
        }
    }
    #else
    static func licenseState(environment: [String: String] = [:]) -> LicenseState? {
        nil
    }
    #endif
}
