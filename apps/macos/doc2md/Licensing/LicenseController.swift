import Combine
import Foundation

struct PolarLicenseConfiguration: Equatable {
    static let bundleKey = "DOC2MDPolarOrganizationID"
    static let recoveryURL = URL(string: "https://polar.sh/purchases")!
    static let supportURL = URL(string: "mailto:support@doc2md.dev")!

    let organizationID: UUID?

    init(organizationID: UUID?) {
        self.organizationID = organizationID
    }

    init(rawValue: String?) {
        organizationID = rawValue.flatMap {
            UUID(uuidString: $0.trimmingCharacters(in: .whitespacesAndNewlines))
        }
    }

    init(bundle: Bundle = .main) {
        self.init(rawValue: bundle.object(forInfoDictionaryKey: Self.bundleKey) as? String)
    }
}

enum PolarLicenseOperation: Equatable {
    case idle
    case activating
    case replacing
    case removing

    var progressText: String? {
        switch self {
        case .idle: return nil
        case .activating: return "Activating license..."
        case .replacing: return "Replacing license..."
        case .removing: return "Removing license..."
        }
    }

    var disablesControls: Bool {
        self != .idle
    }
}

enum PolarLicenseEntryAction: Equatable {
    case activate
    case restore
    case replace

    var title: String {
        switch self {
        case .activate: return "Activate License"
        case .restore: return "Restore License"
        case .replace: return "Replace License"
        }
    }

    var requiresReplacementConfirmation: Bool {
        self == .replace
    }
}

private enum PolarRecoveryIssue: Equatable {
    case activationLimit
    case configurationMissing
    case invalidKey
    case providerUnavailable
    case localStorage
}

struct PolarRecoveryNotice: Equatable {
    private let issue: PolarRecoveryIssue?
    private let slotMayBeOccupied: Bool

    static let activationLimit = Self(issue: .activationLimit, slotMayBeOccupied: false)
    static let occupiedSlot = Self(issue: nil, slotMayBeOccupied: true)
    static let configurationMissing = Self(issue: .configurationMissing, slotMayBeOccupied: false)
    static let invalidKey = Self(issue: .invalidKey, slotMayBeOccupied: false)
    static let providerUnavailable = Self(issue: .providerUnavailable, slotMayBeOccupied: false)
    static let localStorage = Self(issue: .localStorage, slotMayBeOccupied: false)

    var message: String {
        var parts: [String] = []
        switch issue {
        case .activationLimit:
            parts.append("This key has no available activation slots. Deactivate an old device in Polar, or contact support@doc2md.dev for help.")
        case .configurationMissing:
            parts.append("This build is missing its public Polar organization ID. Document features remain available.")
        case .invalidKey:
            parts.append("Polar could not validate this license key. Check the key and try again.")
        case .providerUnavailable:
            parts.append("Polar could not be reached. Check your connection and try again.")
        case .localStorage:
            parts.append("The license could not be saved or cleared locally. Document features remain available.")
        case nil:
            break
        }
        if slotMayBeOccupied {
            parts.append("The prior license's Polar activation slot may still be occupied. Deactivate the old device in Polar if you need that slot.")
        }
        return parts.joined(separator: " ")
    }

    var offersSlotRecovery: Bool {
        issue == .activationLimit || slotMayBeOccupied
    }

    func preserving(_ previous: PolarRecoveryNotice?) -> PolarRecoveryNotice {
        PolarRecoveryNotice(
            issue: issue,
            slotMayBeOccupied: slotMayBeOccupied || previous?.slotMayBeOccupied == true
        )
    }
}

final class LicenseController: ObservableObject {
    @Published private var fallbackState: LicenseState
    @Published private var cachedSnapshot: CachedLicenseSnapshot?
    @Published private(set) var operation: PolarLicenseOperation = .idle
    @Published private(set) var recoveryNotice: PolarRecoveryNotice?
    @Published private(set) var credentialsNeedReentry = false

    private let store: LicenseStore
    private let polarClient: PolarLicenseClientProtocol
    private let polarRepository: PolarLicenseRepositoryProtocol
    private let configuration: PolarLicenseConfiguration
    private let deviceLabel: PolarDeviceLabel
    private let now: () -> Date
    private let calendar: Calendar

    private var polarCredentials: PolarLicenseCredentials?
    private var polarMetadata: PolarLicenseMetadata?
    private var attemptedEligibleValidationThisLaunch = false
    private var lastValidationAttemptAt: Date?
    private var entitlementGeneration = 0

    var entryAction: PolarLicenseEntryAction {
        if credentialsNeedReentry {
            return .restore
        }
        if polarCredentials != nil {
            return .replace
        }
        return .activate
    }

    var canRemovePolarLicense: Bool {
        polarCredentials != nil || polarMetadata?.keyStatus != nil
    }

    var state: LicenseState {
        guard let cachedSnapshot else {
            return fallbackState
        }
        return LicenseState.evaluate(
            entitlement: cachedSnapshot.entitlement,
            keyStatus: cachedSnapshot.keyStatus,
            now: now(),
            lastValidatedAt: cachedSnapshot.lastValidatedAt
        )
    }

    init(
        store: LicenseStore = LicenseStore(),
        polarClient: PolarLicenseClientProtocol = PolarLicenseClient(),
        polarRepository: PolarLicenseRepositoryProtocol = PolarLicenseRepository(),
        configuration: PolarLicenseConfiguration = PolarLicenseConfiguration(),
        deviceLabel: PolarDeviceLabel = PolarDeviceLabel(),
        now: @escaping () -> Date = Date.init,
        calendar: Calendar = .current
    ) {
        self.store = store
        self.polarClient = polarClient
        self.polarRepository = polarRepository
        self.configuration = configuration
        self.deviceLabel = deviceLabel
        self.now = now
        self.calendar = calendar

        let polar = polarRepository.load()
        polarCredentials = polar.credentials
        polarMetadata = polar.metadata

        if let snapshot = Self.snapshot(from: polar.metadata) {
            fallbackState = .unlicensed
            cachedSnapshot = snapshot
            credentialsNeedReentry = polar.credentials == nil
        } else {
            let legacy = store.loadToken()
            fallbackState = legacy.state
            cachedSnapshot = legacy.snapshot
            if polar.storageUnavailable, legacy.state == .unlicensed {
                fallbackState = .licenseCheckFailed(
                    reason: "Local Polar license storage could not be checked."
                )
            }
        }
    }

    @MainActor
    func reload() {
        let polar = polarRepository.load()
        polarCredentials = polar.credentials
        polarMetadata = polar.metadata
        if let snapshot = Self.snapshot(from: polar.metadata) {
            fallbackState = .unlicensed
            cachedSnapshot = snapshot
            credentialsNeedReentry = polar.credentials == nil
            return
        }

        credentialsNeedReentry = false
        let legacy = store.loadToken()
        fallbackState = legacy.state
        cachedSnapshot = legacy.snapshot
    }

    @MainActor
    func applyCachedLicenseSnapshot(_ snapshot: CachedLicenseSnapshot) {
        cachedSnapshot = snapshot
    }

    @discardableResult
    @MainActor
    func enterLicense(_ token: String) -> LicenseState {
        cachedSnapshot = nil
        do {
            let verified = try store.saveToken(token)
            let entitlement = LicenseEntitlement(legacyClaims: verified.claims)
            fallbackState = .licensed(entitlement)
            cachedSnapshot = CachedLicenseSnapshot(
                entitlement: entitlement,
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

    @MainActor
    func clearLicense() {
        cachedSnapshot = nil
        do {
            try store.clearToken()
            fallbackState = .unlicensed
        } catch {
            fallbackState = .licenseCheckFailed(reason: "The license could not be cleared locally.")
        }
    }

    @MainActor
    func activate(key rawKey: String) async -> Bool {
        guard operation == .idle, polarCredentials == nil else {
            return false
        }
        let preserveCachedEntitlementOnFailure = credentialsNeedReentry && cachedSnapshot != nil
        entitlementGeneration &+= 1
        operation = .activating
        defer { operation = .idle }
        return await activateCore(
            key: rawKey,
            preservedNotice: nil,
            preserveCachedEntitlementOnFailure: preserveCachedEntitlementOnFailure
        )
    }

    @MainActor
    func replaceLicense(with rawKey: String) async -> Bool {
        guard operation == .idle else {
            return false
        }
        guard configuration.organizationID != nil else {
            recoveryNotice = .configurationMissing
            return false
        }
        entitlementGeneration &+= 1
        operation = .replacing
        defer { operation = .idle }

        let occupiedNotice = await deactivateAndClearExisting()
        return await activateCore(
            key: rawKey,
            preservedNotice: occupiedNotice,
            preserveCachedEntitlementOnFailure: false
        )
    }

    @MainActor
    func removeLicense() async {
        guard operation == .idle else {
            return
        }
        entitlementGeneration &+= 1
        operation = .removing
        defer { operation = .idle }
        recoveryNotice = await deactivateAndClearExisting()
    }

    @MainActor
    func revalidateIfNeeded() async {
        guard operation == .idle,
              let credentials = polarCredentials,
              let metadata = polarMetadata,
              Self.isRevalidationEligible(metadata: metadata, now: now())
        else {
            return
        }

        let attemptTime = now()
        if attemptedEligibleValidationThisLaunch {
            guard let lastValidationAttemptAt,
                  !calendar.isDate(lastValidationAttemptAt, inSameDayAs: attemptTime)
            else {
                return
            }
        }
        attemptedEligibleValidationThisLaunch = true
        lastValidationAttemptAt = attemptTime
        let validationGeneration = entitlementGeneration

        guard let organizationID = configuration.organizationID else {
            return
        }

        do {
            let refreshed = try await polarClient.validate(
                key: credentials.key,
                organizationID: organizationID,
                activationID: credentials.activationID
            )
            guard entitlementGeneration == validationGeneration,
                  polarCredentials == credentials,
                  polarMetadata == metadata
            else {
                return
            }
            try polarRepository.saveValidation(snapshot: refreshed, validatedAt: attemptTime)
            let updatedMetadata = PolarLicenseMetadata(
                keyStatus: refreshed.keyStatus,
                expiresAt: refreshed.expiresAt,
                lastValidatedAt: attemptTime,
                installationSuffix: metadata.installationSuffix
            )
            polarMetadata = updatedMetadata
            cachedSnapshot = Self.snapshot(from: updatedMetadata)
        } catch {
            // Lifecycle validation is deliberately quiet. The cached snapshot stays authoritative.
        }
    }

    static func isRevalidationEligible(metadata: PolarLicenseMetadata, now: Date) -> Bool {
        guard metadata.keyStatus == .granted, let expiresAt = metadata.expiresAt else {
            return false
        }
        return now >= expiresAt.addingTimeInterval(-7 * 24 * 60 * 60)
    }

    @MainActor
    private func activateCore(
        key rawKey: String,
        preservedNotice: PolarRecoveryNotice?,
        preserveCachedEntitlementOnFailure: Bool
    ) async -> Bool {
        let key = rawKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else {
            recoveryNotice = PolarRecoveryNotice.invalidKey.preserving(preservedNotice)
            return false
        }
        guard let organizationID = configuration.organizationID else {
            recoveryNotice = PolarRecoveryNotice.configurationMissing.preserving(preservedNotice)
            return false
        }

        let suffix: String
        do {
            suffix = try polarRepository.installationSuffix()
        } catch {
            recoveryNotice = PolarRecoveryNotice.localStorage.preserving(preservedNotice)
            return false
        }

        do {
            let activation = try await polarClient.activate(
                key: key,
                organizationID: organizationID,
                label: deviceLabel.makeLabel(suffix: suffix)
            )
            let credentials = PolarLicenseCredentials(
                key: key,
                activationID: activation.activationID
            )
            let validatedAt = now()
            do {
                try polarRepository.saveActivation(
                    credentials: credentials,
                    snapshot: activation.snapshot,
                    suffix: suffix,
                    validatedAt: validatedAt
                )
            } catch {
                let compensationFailed: Bool
                do {
                    try await polarClient.deactivate(
                        key: key,
                        organizationID: organizationID,
                        activationID: activation.activationID
                    )
                    compensationFailed = false
                } catch {
                    compensationFailed = true
                }
                if preserveCachedEntitlementOnFailure {
                    try? polarRepository.clearCredentials()
                } else {
                    try? polarRepository.clearEntitlement()
                }
                recoveryNotice = PolarRecoveryNotice.localStorage.preserving(
                    compensationFailed ? .occupiedSlot : preservedNotice
                )
                return false
            }

            let metadata = PolarLicenseMetadata(
                keyStatus: activation.snapshot.keyStatus,
                expiresAt: activation.snapshot.expiresAt,
                lastValidatedAt: validatedAt,
                installationSuffix: suffix
            )
            polarCredentials = credentials
            polarMetadata = metadata
            credentialsNeedReentry = false
            fallbackState = .unlicensed
            cachedSnapshot = Self.snapshot(from: metadata)
            recoveryNotice = preservedNotice
            return true
        } catch let error as PolarLicenseClientError {
            switch error {
            case .activationLimitReached:
                recoveryNotice = PolarRecoveryNotice.activationLimit.preserving(preservedNotice)
            case .invalidLicense, .malformedResponse, .providerRejectedRequest:
                recoveryNotice = PolarRecoveryNotice.invalidKey.preserving(preservedNotice)
            case .networkUnavailable:
                recoveryNotice = PolarRecoveryNotice.providerUnavailable.preserving(preservedNotice)
            }
            return false
        } catch {
            recoveryNotice = PolarRecoveryNotice.providerUnavailable.preserving(preservedNotice)
            return false
        }
    }

    @MainActor
    private func deactivateAndClearExisting() async -> PolarRecoveryNotice? {
        var remoteFailed = false
        if let credentials = polarCredentials {
            if let organizationID = configuration.organizationID {
                do {
                    try await polarClient.deactivate(
                        key: credentials.key,
                        organizationID: organizationID,
                        activationID: credentials.activationID
                    )
                } catch {
                    remoteFailed = true
                }
            } else {
                remoteFailed = true
            }
        } else if polarMetadata?.keyStatus != nil {
            remoteFailed = true
        }

        let localFailed: Bool
        do {
            try polarRepository.clearEntitlement()
            localFailed = false
        } catch {
            localFailed = true
        }

        polarCredentials = nil
        polarMetadata = polarMetadata.map {
            PolarLicenseMetadata(installationSuffix: $0.installationSuffix)
        }
        cachedSnapshot = nil
        credentialsNeedReentry = false
        fallbackState = localFailed
            ? .licenseCheckFailed(reason: "The Polar license could not be cleared locally.")
            : .unlicensed

        if localFailed {
            return PolarRecoveryNotice.localStorage.preserving(
                remoteFailed ? .occupiedSlot : nil
            )
        }
        return remoteFailed ? .occupiedSlot : nil
    }

    private static func snapshot(from metadata: PolarLicenseMetadata?) -> CachedLicenseSnapshot? {
        guard let metadata, let keyStatus = metadata.keyStatus else {
            return nil
        }
        return CachedLicenseSnapshot(
            entitlement: LicenseEntitlement(expiresAt: metadata.expiresAt),
            keyStatus: keyStatus,
            lastValidatedAt: metadata.lastValidatedAt
        )
    }
}
