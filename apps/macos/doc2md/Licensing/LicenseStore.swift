import Foundation

enum LicenseStorageError: Error {
    case unavailable
    case failed(String)
}

enum StoredLicenseCandidate: Equatable {
    case missing
    case available(String)
    case unavailable(String)
}

protocol LicenseTokenStorage {
    func loadToken() throws -> StoredLicenseCandidate
    func saveToken(_ token: String) throws
    func clearToken() throws
}

struct LicenseStoreLoadResult: Equatable {
    let state: LicenseState
    let token: String?
}

final class LicenseStore {
    private let keychainStore: LicenseTokenStorage
    private let fallbackStore: LicenseTokenStorage
    private let verifier: LicenseVerifier

    init(
        keychainStore: LicenseTokenStorage = KeychainLicenseStore(),
        fallbackStore: LicenseTokenStorage = ApplicationSupportLicenseStore(),
        verifier: LicenseVerifier = LicenseVerifier()
    ) {
        self.keychainStore = keychainStore
        self.fallbackStore = fallbackStore
        self.verifier = verifier
    }

    func loadToken() -> LicenseStoreLoadResult {
        let keychain = readCandidate(from: keychainStore)
        let fallback = readCandidate(from: fallbackStore)

        let keychainClassification = classify(keychain)
        let fallbackClassification = classify(fallback)

        if case .valid(let verified) = keychainClassification {
            cleanupInvalidFallbackIfNeeded(fallbackClassification)
            if case .valid(let fallbackVerified) = fallbackClassification,
               fallbackVerified.token != verified.token {
                try? fallbackStore.clearToken()
            }
            return LicenseStoreLoadResult(state: .licensed(verified), token: verified.token)
        }

        if case .valid(let verified) = fallbackClassification {
            do {
                try keychainStore.saveToken(verified.token)
            } catch {
                return LicenseStoreLoadResult(state: .licensed(verified), token: verified.token)
            }
            return LicenseStoreLoadResult(state: .licensed(verified), token: verified.token)
        }

        if keychainClassification.isUnavailable || fallbackClassification.isUnavailable {
            return LicenseStoreLoadResult(
                state: .licenseCheckFailed(reason: "Local license storage could not be checked."),
                token: nil
            )
        }

        if keychainClassification.isInvalid || fallbackClassification.isInvalid {
            return LicenseStoreLoadResult(
                state: .invalid(reason: "Stored license data could not be verified."),
                token: nil
            )
        }

        return LicenseStoreLoadResult(state: .unlicensed, token: nil)
    }

    func saveToken(_ token: String) throws -> VerifiedLicense {
        switch verifier.verify(token) {
        case .success(let verified):
            try keychainStore.saveToken(token)
            try? fallbackStore.clearToken()
            return verified
        case .failure(let error):
            throw error
        }
    }

    func clearToken() throws {
        var clearError: Error?

        do {
            try keychainStore.clearToken()
        } catch {
            clearError = error
        }

        do {
            try fallbackStore.clearToken()
        } catch {
            if clearError == nil {
                clearError = error
            }
        }

        if let clearError {
            throw clearError
        }
    }

    private func readCandidate(from store: LicenseTokenStorage) -> StoredLicenseCandidate {
        do {
            return try store.loadToken()
        } catch {
            return .unavailable(error.localizedDescription)
        }
    }

    private func classify(_ candidate: StoredLicenseCandidate) -> CandidateClassification {
        switch candidate {
        case .missing:
            return .missing
        case .unavailable(let reason):
            return .unavailable(reason)
        case .available(let token):
            switch verifier.verify(token) {
            case .success(let verified):
                return .valid(verified)
            case .failure(let error):
                return .invalid(error.localizedDescription)
            }
        }
    }

    private func cleanupInvalidFallbackIfNeeded(_ fallback: CandidateClassification) {
        if fallback.isInvalid {
            try? fallbackStore.clearToken()
        }
    }
}

private enum CandidateClassification {
    case missing
    case valid(VerifiedLicense)
    case invalid(String)
    case unavailable(String)

    var isInvalid: Bool {
        if case .invalid = self {
            return true
        }
        return false
    }

    var isUnavailable: Bool {
        if case .unavailable = self {
            return true
        }
        return false
    }
}
