import Combine
import Foundation

final class LicenseController: ObservableObject {
    @Published private(set) var state: LicenseState

    private let store: LicenseStore

    init(store: LicenseStore = LicenseStore()) {
        self.store = store
        state = store.loadToken().state
    }

    func reload() {
        state = store.loadToken().state
    }

    @discardableResult
    func enterLicense(_ token: String) -> LicenseState {
        do {
            let verified = try store.saveToken(token)
            state = .licensed(verified)
        } catch let error as LicenseVerificationError {
            state = .invalid(reason: error.localizedDescription)
        } catch {
            state = .licenseCheckFailed(reason: "The license could not be saved locally.")
        }
        return state
    }

    func clearLicense() {
        do {
            try store.clearToken()
            state = .unlicensed
        } catch {
            state = .licenseCheckFailed(reason: "The license could not be cleared locally.")
        }
    }
}
