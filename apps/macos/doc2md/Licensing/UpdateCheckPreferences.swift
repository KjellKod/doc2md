import Foundation

final class UpdateCheckPreferences {
    private let defaults: UserDefaults
    private let monthlyChecksEnabledKey = "doc2md.licensedMonthlyUpdateChecksEnabled"
    private let lastMonthlyCheckKey = "doc2md.licensedMonthlyUpdateLastCheckedAt"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var licensedMonthlyChecksEnabled: Bool {
        get {
            defaults.bool(forKey: monthlyChecksEnabledKey)
        }
        set {
            defaults.set(newValue, forKey: monthlyChecksEnabledKey)
        }
    }

    var lastLicensedMonthlyCheck: Date? {
        get {
            let interval = defaults.double(forKey: lastMonthlyCheckKey)
            guard interval > 0 else {
                return nil
            }
            return Date(timeIntervalSince1970: interval)
        }
        set {
            if let newValue {
                defaults.set(newValue.timeIntervalSince1970, forKey: lastMonthlyCheckKey)
            } else {
                defaults.removeObject(forKey: lastMonthlyCheckKey)
            }
        }
    }
}

struct UpdateCheckPolicy {
    private static let monthlyInterval: TimeInterval = 30 * 24 * 60 * 60

    let preferences: UpdateCheckPreferences
    let now: () -> Date

    func shouldRunAutomaticCheck(for state: LicenseState) -> Bool {
        switch state {
        case .licensed:
            guard preferences.licensedMonthlyChecksEnabled else {
                return false
            }
            guard let lastCheck = preferences.lastLicensedMonthlyCheck else {
                return true
            }
            return now().timeIntervalSince(lastCheck) >= Self.monthlyInterval
        case .unlicensed, .invalid, .licenseCheckFailed:
            return true
        }
    }

    func recordAutomaticCheck(for state: LicenseState) {
        if case .licensed = state {
            preferences.lastLicensedMonthlyCheck = now()
        }
    }
}
