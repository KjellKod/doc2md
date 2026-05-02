import Foundation

enum LicenseState: Equatable {
    case unlicensed
    case licensed(VerifiedLicense)
    case invalid(reason: String)
    case licenseCheckFailed(reason: String)

    var allowsReminders: Bool {
        switch self {
        case .licensed:
            return false
        case .unlicensed, .invalid, .licenseCheckFailed:
            return true
        }
    }

    var displayTitle: String {
        switch self {
        case .licensed:
            return "Licensed"
        case .unlicensed:
            return "Free Unlicensed"
        case .invalid:
            return "Invalid License"
        case .licenseCheckFailed:
            return "License Check Failed"
        }
    }
}

