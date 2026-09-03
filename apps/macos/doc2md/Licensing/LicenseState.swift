import Foundation

enum LicenseKeyStatus: Equatable {
    case granted
    case revoked
    case disabled
}

struct LicenseEntitlement: Equatable {
    let expiresAt: Date?
    let legacyClaims: LicenseClaims?

    init(expiresAt: Date?, legacyClaims: LicenseClaims? = nil) {
        self.expiresAt = expiresAt
        self.legacyClaims = legacyClaims
    }

    init(legacyClaims: LicenseClaims) {
        self.init(expiresAt: legacyClaims.expiresAt, legacyClaims: legacyClaims)
    }
}

struct CachedLicenseSnapshot: Equatable {
    let entitlement: LicenseEntitlement
    let keyStatus: LicenseKeyStatus
    let lastValidatedAt: Date?

    init(
        entitlement: LicenseEntitlement,
        keyStatus: LicenseKeyStatus,
        lastValidatedAt: Date?
    ) {
        self.entitlement = entitlement
        self.keyStatus = keyStatus
        self.lastValidatedAt = lastValidatedAt
    }

    init(
        claims: LicenseClaims,
        keyStatus: LicenseKeyStatus,
        lastValidatedAt: Date?
    ) {
        self.init(
            entitlement: LicenseEntitlement(legacyClaims: claims),
            keyStatus: keyStatus,
            lastValidatedAt: lastValidatedAt
        )
    }

    var claims: LicenseClaims? {
        entitlement.legacyClaims
    }
}

enum LicenseState: Equatable {
    case unlicensed
    case licensed(LicenseEntitlement)
    case grace(LicenseEntitlement)
    case expiredReminder(LicenseEntitlement)
    case invalid(reason: String)
    case licenseCheckFailed(reason: String)

    private static let gracePeriod: TimeInterval = 7 * 24 * 60 * 60

    static func evaluate(
        entitlement: LicenseEntitlement,
        keyStatus: LicenseKeyStatus,
        now: Date,
        lastValidatedAt: Date?
    ) -> LicenseState {
        guard let expiresAt = entitlement.expiresAt else {
            switch keyStatus {
            case .granted:
                return .licensed(entitlement)
            case .revoked, .disabled:
                return .expiredReminder(entitlement)
            }
        }

        guard now >= expiresAt else {
            return .licensed(entitlement)
        }

        switch keyStatus {
        case .revoked, .disabled:
            return .expiredReminder(entitlement)
        case .granted:
            break
        }

        if let lastValidatedAt, lastValidatedAt > expiresAt {
            return .expiredReminder(entitlement)
        }

        let graceEndsAt = expiresAt.addingTimeInterval(Self.gracePeriod)
        if now < graceEndsAt {
            return .grace(entitlement)
        }
        return .expiredReminder(entitlement)
    }

    static func evaluate(
        claims: LicenseClaims,
        keyStatus: LicenseKeyStatus,
        now: Date,
        lastValidatedAt: Date?
    ) -> LicenseState {
        evaluate(
            entitlement: LicenseEntitlement(legacyClaims: claims),
            keyStatus: keyStatus,
            now: now,
            lastValidatedAt: lastValidatedAt
        )
    }

    static func licensed(_ claims: LicenseClaims) -> LicenseState {
        .licensed(LicenseEntitlement(legacyClaims: claims))
    }

    static func grace(_ claims: LicenseClaims) -> LicenseState {
        .grace(LicenseEntitlement(legacyClaims: claims))
    }

    static func expiredReminder(_ claims: LicenseClaims) -> LicenseState {
        .expiredReminder(LicenseEntitlement(legacyClaims: claims))
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
