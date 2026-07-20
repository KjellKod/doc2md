import Combine
import Foundation

final class LicenseController: ObservableObject {
    @Published private var fallbackState: LicenseState
    @Published private var cachedSnapshot: CachedLicenseSnapshot?

    private let store: LicenseStore
    private let now: () -> Date

    var state: LicenseState {
        guard let cachedSnapshot else {
            return fallbackState
        }
        return LicenseState.evaluate(
            claims: cachedSnapshot.claims,
            keyStatus: cachedSnapshot.keyStatus,
            now: now(),
            lastValidatedAt: cachedSnapshot.lastValidatedAt
        )
    }

    init(
        store: LicenseStore = LicenseStore(),
        now: @escaping () -> Date = Date.init
    ) {
        self.store = store
        self.now = now
        let loaded = store.loadToken()
        fallbackState = loaded.state
        cachedSnapshot = loaded.snapshot
    }

    func reload() {
        let loaded = store.loadToken()
        fallbackState = loaded.state
        cachedSnapshot = loaded.snapshot
    }

    func applyCachedLicenseSnapshot(_ snapshot: CachedLicenseSnapshot) {
        cachedSnapshot = snapshot
    }

    @discardableResult
    func enterLicense(_ token: String) -> LicenseState {
        cachedSnapshot = nil
        do {
            let verified = try store.saveToken(token)
            fallbackState = .licensed(verified.claims)
            cachedSnapshot = CachedLicenseSnapshot(
                claims: verified.claims,
                keyStatus: .granted,
                lastValidatedAt: nil
            )
        } catch let error as LicenseVerificationError {
            fallbackState = .invalid(reason: error.localizedDescription)
        } catch {
            fallbackState = .licenseCheckFailed(reason: "The license could not be saved locally.")
        }
        return state
    }

    func clearLicense() {
        cachedSnapshot = nil
        do {
            try store.clearToken()
            fallbackState = .unlicensed
        } catch {
            fallbackState = .licenseCheckFailed(reason: "The license could not be cleared locally.")
        }
    }
}
