import Foundation

enum LicenseKeyStatus: Equatable {
    case granted
    case revoked
    case disabled
}

struct CachedLicenseSnapshot: Equatable {
    let claims: LicenseClaims
    let keyStatus: LicenseKeyStatus
    let lastValidatedAt: Date?
}

enum LicenseState: Equatable {
    case unlicensed
    case licensed(LicenseClaims)
    case grace(LicenseClaims)
    case expiredReminder(LicenseClaims)
    case invalid(reason: String)
    case licenseCheckFailed(reason: String)

    private static let gracePeriod: TimeInterval = 7 * 24 * 60 * 60

    static func evaluate(
        claims: LicenseClaims,
        keyStatus: LicenseKeyStatus,
        now: Date,
        lastValidatedAt: Date?
    ) -> LicenseState {
        guard let expiresAt = claims.expiresAt else {
            switch keyStatus {
            case .granted:
                return .licensed(claims)
            case .revoked, .disabled:
                return .expiredReminder(claims)
            }
        }

        guard now >= expiresAt else {
            return .licensed(claims)
        }

        switch keyStatus {
        case .revoked, .disabled:
            return .expiredReminder(claims)
        case .granted:
            break
        }

        if let lastValidatedAt, lastValidatedAt > expiresAt {
            return .expiredReminder(claims)
        }

        let graceEndsAt = expiresAt.addingTimeInterval(Self.gracePeriod)
        if now < graceEndsAt {
            return .grace(claims)
        }
        return .expiredReminder(claims)
    }

    var allowsReminders: Bool {
        switch self {
        case .licensed, .grace:
            return false
        case .expiredReminder, .unlicensed, .invalid, .licenseCheckFailed:
            return true
        }
    }

    var licensedConveniencesPaused: Bool {
        if case .expiredReminder = self {
            return true
        }
        return false
    }

    var displayTitle: String {
        switch self {
        case .licensed:
            return "Licensed"
        case .grace:
            return "License Grace Period"
        case .expiredReminder:
            return "License Expired"
        case .unlicensed:
            return "Free Unlicensed"
        case .invalid:
            return "Invalid License"
        case .licenseCheckFailed:
            return "License Check Failed"
        }
    }
}
