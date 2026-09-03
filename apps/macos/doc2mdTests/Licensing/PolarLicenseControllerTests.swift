import Foundation
import XCTest

@MainActor
final class PolarLicenseControllerTests: XCTestCase {
    private let organizationID = UUID(uuidString: "11111111-2222-3333-4444-555555555555")!
    private let now = Date(timeIntervalSince1970: 1_800_000_000)
    private let day: TimeInterval = 24 * 60 * 60

    func testActivationIsSingleFlightAndPublishesLicensedSnapshot() async {
        let log = OperationLog()
        let client = ScriptedPolarClient(log: log)
        client.activationDelayNanoseconds = 100_000_000
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(30 * day)
                )
            )
        )
        let repository = InMemoryPolarRepository(log: log)
        let controller = makeController(client: client, repository: repository)

        let first = Task { await controller.activate(key: "  polar-test-key  ") }
        await Task.yield()
        let second = await controller.activate(key: "polar-test-key")
        let firstResult = await first.value

        XCTAssertTrue(firstResult)
        XCTAssertFalse(second)
        XCTAssertEqual(client.activateCount, 1)
        XCTAssertEqual(repository.credentials?.key, "polar-test-key")
        XCTAssertEqual(repository.metadata?.installationSuffix, "7Q2F")
        XCTAssertEqual(
            controller.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(30 * day)))
        )
    }

    func testMissingConfigurationSendsNoRequestAndOnlyAffectsLicensing() async {
        let client = ScriptedPolarClient()
        let repository = InMemoryPolarRepository()
        let controller = makeController(
            client: client,
            repository: repository,
            configuration: PolarLicenseConfiguration(organizationID: nil)
        )

        let activated = await controller.activate(key: "polar-test-key")

        XCTAssertFalse(activated)
        XCTAssertEqual(client.activateCount, 0)
        XCTAssertEqual(controller.recoveryNotice, .configurationMissing)
        XCTAssertEqual(controller.state, .unlicensed)
    }

    func testMissingConfigurationReplacementPreservesActiveEntitlement() async {
        let client = ScriptedPolarClient()
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now
        )
        let credentials = repository.credentials
        let metadata = repository.metadata
        let controller = makeController(
            client: client,
            repository: repository,
            configuration: PolarLicenseConfiguration(organizationID: nil)
        )
        let state = controller.state

        let replaced = await controller.replaceLicense(with: "new-polar-key")

        XCTAssertFalse(replaced)
        XCTAssertEqual(client.deactivateCount, 0)
        XCTAssertEqual(client.activateCount, 0)
        XCTAssertEqual(repository.clearCount, 0)
        XCTAssertEqual(repository.credentials, credentials)
        XCTAssertEqual(repository.metadata, metadata)
        XCTAssertEqual(controller.state, state)
        XCTAssertEqual(controller.entryAction, .replace)
        XCTAssertEqual(controller.recoveryNotice, .configurationMissing)
    }

    func testMissingConfigurationReplacementPreservesCredentialsOnlyRecovery() async {
        let client = ScriptedPolarClient()
        let repository = InMemoryPolarRepository()
        repository.credentials = testCredentials
        let controller = makeController(
            client: client,
            repository: repository,
            configuration: PolarLicenseConfiguration(organizationID: nil)
        )

        let replaced = await controller.replaceLicense(with: "new-polar-key")

        XCTAssertFalse(replaced)
        XCTAssertEqual(client.deactivateCount, 0)
        XCTAssertEqual(client.activateCount, 0)
        XCTAssertEqual(repository.clearCount, 0)
        XCTAssertEqual(repository.credentials, testCredentials)
        XCTAssertNil(repository.metadata)
        XCTAssertEqual(controller.state, .unlicensed)
        XCTAssertEqual(controller.entryAction, .replace)
        XCTAssertEqual(controller.recoveryNotice, .configurationMissing)
    }

    func testMissingConfigurationRemovalOfActiveEntitlementShowsOccupiedSlotRecovery() async {
        let client = ScriptedPolarClient()
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now
        )
        let controller = makeController(
            client: client,
            repository: repository,
            configuration: PolarLicenseConfiguration(organizationID: nil)
        )

        await controller.removeLicense()

        XCTAssertEqual(client.deactivateCount, 0)
        XCTAssertEqual(repository.clearCount, 1)
        XCTAssertNil(repository.credentials)
        XCTAssertEqual(controller.state, .unlicensed)
        XCTAssertEqual(controller.recoveryNotice, .occupiedSlot)
        XCTAssertTrue(controller.recoveryNotice?.offersSlotRecovery == true)
    }

    func testMissingConfigurationRemovalOfCredentialsOnlyStateShowsOccupiedSlotRecovery() async {
        let client = ScriptedPolarClient()
        let repository = InMemoryPolarRepository()
        repository.credentials = testCredentials
        let controller = makeController(
            client: client,
            repository: repository,
            configuration: PolarLicenseConfiguration(organizationID: nil)
        )

        await controller.removeLicense()

        XCTAssertEqual(client.deactivateCount, 0)
        XCTAssertEqual(repository.clearCount, 1)
        XCTAssertNil(repository.credentials)
        XCTAssertEqual(controller.state, .unlicensed)
        XCTAssertEqual(controller.recoveryNotice, .occupiedSlot)
        XCTAssertTrue(controller.recoveryNotice?.offersSlotRecovery == true)
    }

    func testConfiguredControllerIsReadyWithoutMakingARequest() {
        let client = ScriptedPolarClient()

        _ = makeController(client: client, repository: InMemoryPolarRepository())

        XCTAssertEqual(client.activateCount, 0)
        XCTAssertEqual(client.validateCount, 0)
        XCTAssertEqual(client.deactivateCount, 0)
    }

    func testProductionConfigurationParserAcceptsOnlyUUIDValues() {
        XCTAssertEqual(
            PolarLicenseConfiguration(rawValue: "  \(organizationID.uuidString)  ").organizationID,
            organizationID
        )
        XCTAssertNil(PolarLicenseConfiguration(rawValue: "merchant-secret").organizationID)
        XCTAssertNil(PolarLicenseConfiguration(rawValue: nil).organizationID)
    }

    func testKeychainLossKeepsCachedStateAndFreshActivationReusesSuffix() async {
        let client = ScriptedPolarClient()
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(30 * day)
                )
            )
        )
        let repository = InMemoryPolarRepository()
        repository.metadata = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: now.addingTimeInterval(10 * day),
            lastValidatedAt: now.addingTimeInterval(-day),
            installationSuffix: "7Q2F"
        )
        let controller = makeController(client: client, repository: repository)

        XCTAssertTrue(controller.credentialsNeedReentry)
        XCTAssertEqual(
            controller.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(10 * day)))
        )
        let activated = await controller.activate(key: "polar-test-key")

        XCTAssertTrue(activated)
        XCTAssertEqual(client.activationLabels, ["Mac14,9 · 7Q2F"])
        XCTAssertFalse(controller.credentialsNeedReentry)
    }

    func testKeychainLossEntryActionIsRestoreAndFailedReentryPreservesCachedState() async {
        let client = ScriptedPolarClient()
        client.activationResult = .failure(.activationLimitReached)
        let repository = InMemoryPolarRepository()
        let metadata = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: now.addingTimeInterval(10 * day),
            lastValidatedAt: now.addingTimeInterval(-day),
            installationSuffix: "7Q2F"
        )
        repository.metadata = metadata
        let controller = makeController(client: client, repository: repository)
        let cachedState = controller.state

        XCTAssertEqual(controller.entryAction, .restore)
        XCTAssertFalse(controller.entryAction.requiresReplacementConfirmation)
        let activated = await controller.activate(key: "polar-test-key")

        XCTAssertFalse(activated)
        XCTAssertEqual(client.deactivateCount, 0)
        XCTAssertEqual(repository.clearCount, 0)
        XCTAssertEqual(repository.metadata, metadata)
        XCTAssertEqual(controller.state, cachedState)
        XCTAssertTrue(controller.credentialsNeedReentry)
    }

    func testKeychainReadFailurePreservesCachedStateAndBlocksReactivation() async {
        let client = ScriptedPolarClient()
        let repository = InMemoryPolarRepository()
        repository.metadata = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: now.addingTimeInterval(10 * day),
            lastValidatedAt: now.addingTimeInterval(-day),
            installationSuffix: "7Q2F"
        )
        repository.credentialsUnavailable = true
        let controller = makeController(client: client, repository: repository)

        XCTAssertEqual(
            controller.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(10 * day)))
        )
        XCTAssertTrue(controller.credentialStorageUnavailable)
        XCTAssertFalse(controller.credentialsNeedReentry)

        let activated = await controller.activate(key: "polar-test-key")

        XCTAssertFalse(activated)
        XCTAssertEqual(client.activateCount, 0)
        XCTAssertNil(repository.credentials)
    }

    func testCredentialsWithoutMetadataRequireReplacementBeforeNewActivation() async throws {
        let log = OperationLog()
        let client = ScriptedPolarClient(log: log)
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(30 * day)
                )
            )
        )
        let repository = InMemoryPolarRepository(log: log)
        repository.credentials = testCredentials
        let controller = makeController(client: client, repository: repository)

        XCTAssertEqual(controller.entryAction, .replace)
        XCTAssertTrue(controller.canRemovePolarLicense)
        let directActivation = await controller.activate(key: "new-polar-key")
        XCTAssertFalse(directActivation)
        XCTAssertEqual(client.activateCount, 0)

        let replaced = await controller.replaceLicense(with: "new-polar-key")

        XCTAssertTrue(replaced)
        XCTAssertEqual(log.values, ["deactivate", "clear", "activate", "saveActivation"])
        XCTAssertEqual(repository.credentials?.key, "new-polar-key")
        let reconstructed = makeController(
            client: ScriptedPolarClient(),
            repository: repository
        )
        XCTAssertEqual(reconstructed.entryAction, .replace)
        XCTAssertEqual(
            reconstructed.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(30 * day)))
        )
        let encodedMetadata = try JSONEncoder().encode(XCTUnwrap(repository.metadata))
        let metadataText = String(decoding: encodedMetadata, as: UTF8.self)
        XCTAssertFalse(metadataText.contains("new-polar-key"))
        XCTAssertFalse(metadataText.contains("bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"))
    }

    func testCorruptMetadataWithCredentialsCanBeRemovedAndRelaunchesUnlicensed() async {
        let log = OperationLog()
        let client = ScriptedPolarClient(log: log)
        let repository = InMemoryPolarRepository(log: log)
        repository.credentials = testCredentials
        repository.storageUnavailable = true
        let controller = makeController(client: client, repository: repository)

        XCTAssertEqual(controller.entryAction, .replace)
        XCTAssertTrue(controller.canRemovePolarLicense)
        guard case .licenseCheckFailed = controller.state else {
            return XCTFail("expected corrupt metadata storage failure")
        }

        await controller.removeLicense()

        XCTAssertEqual(log.values, ["deactivate", "clear"])
        XCTAssertNil(repository.credentials)
        XCTAssertNil(repository.metadata)
        XCTAssertEqual(controller.state, .unlicensed)
        let reconstructed = makeController(
            client: ScriptedPolarClient(),
            repository: repository
        )
        XCTAssertEqual(reconstructed.state, .unlicensed)
        XCTAssertEqual(reconstructed.entryAction, .activate)
        XCTAssertFalse(reconstructed.canRemovePolarLicense)
    }

    func testRestoreSaveFailurePreservesDurableCachedEntitlementForRelaunch() async {
        let cachedMetadata = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: now.addingTimeInterval(10 * day),
            lastValidatedAt: now.addingTimeInterval(-day),
            installationSuffix: "7Q2F"
        )
        let client = ScriptedPolarClient()
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(30 * day)
                )
            )
        )
        let repository = InMemoryPolarRepository()
        repository.metadata = cachedMetadata
        repository.failSaveActivation = true
        let controller = makeController(client: client, repository: repository)
        XCTAssertEqual(controller.entryAction, .restore)

        let restored = await controller.activate(key: "reentered-polar-key")

        XCTAssertFalse(restored)
        XCTAssertEqual(client.deactivateCount, 1, "new remote activation is compensated")
        XCTAssertEqual(repository.clearCredentialsCount, 1)
        XCTAssertEqual(repository.clearCount, 0)
        XCTAssertNil(repository.credentials)
        XCTAssertEqual(repository.metadata, cachedMetadata)
        XCTAssertEqual(
            controller.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(10 * day)))
        )

        repository.failSaveActivation = false
        let reconstructed = makeController(
            client: ScriptedPolarClient(),
            repository: repository
        )
        XCTAssertEqual(
            reconstructed.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(10 * day)))
        )
        XCTAssertEqual(reconstructed.entryAction, .restore)
        XCTAssertTrue(reconstructed.credentialsNeedReentry)
    }

    func testLicenseWindowOperationsDisableAllLicenseControls() {
        XCTAssertFalse(PolarLicenseOperation.idle.disablesControls)
        XCTAssertTrue(PolarLicenseOperation.activating.disablesControls)
        XCTAssertTrue(PolarLicenseOperation.replacing.disablesControls)
        XCTAssertTrue(PolarLicenseOperation.removing.disablesControls)
    }

    func testActivationLimitShowsPortalAndSupportRecoveryWithoutRawError() async {
        let client = ScriptedPolarClient()
        client.activationResult = .failure(.activationLimitReached)
        let controller = makeController(client: client, repository: InMemoryPolarRepository())

        let activated = await controller.activate(key: "polar-test-key")

        XCTAssertFalse(activated)
        XCTAssertEqual(controller.recoveryNotice, .activationLimit)
        XCTAssertTrue(controller.recoveryNotice?.offersSlotRecovery == true)
        XCTAssertTrue(controller.recoveryNotice?.message.contains("support@doc2md.dev") == true)
    }

    func testActivationPersistenceFailureCompensatesRemoteSlotAndClearsPartialData() async {
        let log = OperationLog()
        let client = ScriptedPolarClient(log: log)
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(day)
                )
            )
        )
        let repository = InMemoryPolarRepository(log: log)
        repository.failSaveActivation = true
        let controller = makeController(client: client, repository: repository)

        let activated = await controller.activate(key: "polar-test-key")

        XCTAssertFalse(activated)
        XCTAssertEqual(client.deactivateCount, 1)
        XCTAssertEqual(repository.clearCount, 1)
        XCTAssertEqual(controller.recoveryNotice, .localStorage)
    }

    func testActivationPersistenceAndCompensationFailuresShowOccupiedSlotRecovery() async {
        let client = ScriptedPolarClient()
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(day)
                )
            )
        )
        client.deactivationError = .networkUnavailable
        let repository = InMemoryPolarRepository()
        repository.failSaveActivation = true
        let controller = makeController(client: client, repository: repository)

        let activated = await controller.activate(key: "polar-test-key")

        XCTAssertFalse(activated)
        XCTAssertEqual(client.deactivateCount, 1)
        XCTAssertEqual(repository.clearCount, 1)
        XCTAssertNil(repository.credentials)
        XCTAssertEqual(controller.state, .unlicensed)
        XCTAssertTrue(controller.recoveryNotice?.offersSlotRecovery == true)
        XCTAssertTrue(controller.recoveryNotice?.message.contains("could not be saved") == true)
        XCTAssertTrue(controller.recoveryNotice?.message.contains("may still be occupied") == true)
    }

    func testRestorePersistenceAndCompensationFailuresPreserveCacheAndShowOccupiedSlotRecovery() async {
        let cachedMetadata = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: now.addingTimeInterval(10 * day),
            lastValidatedAt: now.addingTimeInterval(-day),
            installationSuffix: "7Q2F"
        )
        let client = ScriptedPolarClient()
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(30 * day)
                )
            )
        )
        client.deactivationError = .networkUnavailable
        let repository = InMemoryPolarRepository()
        repository.metadata = cachedMetadata
        repository.failSaveActivation = true
        let controller = makeController(client: client, repository: repository)

        let restored = await controller.activate(key: "reentered-polar-key")

        XCTAssertFalse(restored)
        XCTAssertEqual(client.deactivateCount, 1)
        XCTAssertEqual(repository.clearCredentialsCount, 1)
        XCTAssertEqual(repository.clearCount, 0)
        XCTAssertNil(repository.credentials)
        XCTAssertEqual(repository.metadata, cachedMetadata)
        XCTAssertEqual(
            controller.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(10 * day)))
        )
        XCTAssertEqual(controller.entryAction, .restore)
        XCTAssertTrue(controller.recoveryNotice?.offersSlotRecovery == true)
        XCTAssertTrue(controller.recoveryNotice?.message.contains("could not be saved") == true)
        XCTAssertTrue(controller.recoveryNotice?.message.contains("may still be occupied") == true)
    }

    func testRevalidationEligibilityThrottleAndLateRenewalRecovery() async {
        var clock = now
        let client = ScriptedPolarClient()
        client.validationResults = [
            .success(PolarLicenseSnapshot(keyStatus: .granted, expiresAt: now.addingTimeInterval(-day))),
            .success(PolarLicenseSnapshot(keyStatus: .granted, expiresAt: now.addingTimeInterval(30 * day)))
        ]
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(-day),
            lastValidatedAt: now.addingTimeInterval(-2 * day)
        )
        let controller = makeController(
            client: client,
            repository: repository,
            now: { clock }
        )

        await controller.revalidateIfNeeded()
        XCTAssertEqual(controller.state, .expiredReminder(LicenseEntitlement(expiresAt: now.addingTimeInterval(-day))))
        await controller.revalidateIfNeeded()
        XCTAssertEqual(client.validateCount, 1, "same-day lifecycle events are throttled")

        clock = now.addingTimeInterval(day)
        await controller.revalidateIfNeeded()

        XCTAssertEqual(client.validateCount, 2)
        XCTAssertEqual(
            controller.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(30 * day)))
        )
    }

    func testFarFromExpiryAndDefinitiveStatusesDoNotValidate() async {
        for metadata in [
            PolarLicenseMetadata(
                keyStatus: .granted,
                expiresAt: now.addingTimeInterval(8 * day),
                lastValidatedAt: now,
                installationSuffix: "7Q2F"
            ),
            PolarLicenseMetadata(
                keyStatus: .revoked,
                expiresAt: now.addingTimeInterval(-day),
                lastValidatedAt: now,
                installationSuffix: "7Q2F"
            ),
            PolarLicenseMetadata(
                keyStatus: .disabled,
                expiresAt: now.addingTimeInterval(-day),
                lastValidatedAt: now,
                installationSuffix: "7Q2F"
            )
        ] {
            let client = ScriptedPolarClient()
            let repository = InMemoryPolarRepository()
            repository.credentials = testCredentials
            repository.metadata = metadata
            let controller = makeController(client: client, repository: repository)

            await controller.revalidateIfNeeded()

            XCTAssertEqual(client.validateCount, 0)
        }
    }

    func testRevalidationEligibilityUsesExactSevenDayBoundaryAndContinuesAfterExpiry() {
        let expiry = now
        let metadata = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: expiry,
            lastValidatedAt: now.addingTimeInterval(-day),
            installationSuffix: "7Q2F"
        )

        XCTAssertFalse(
            LicenseController.isRevalidationEligible(
                metadata: metadata,
                now: expiry.addingTimeInterval(-7 * day - 0.001)
            )
        )
        XCTAssertTrue(
            LicenseController.isRevalidationEligible(
                metadata: metadata,
                now: expiry.addingTimeInterval(-7 * day)
            )
        )
        XCTAssertTrue(
            LicenseController.isRevalidationEligible(
                metadata: metadata,
                now: expiry.addingTimeInterval(7 * day)
            )
        )
        XCTAssertTrue(
            LicenseController.isRevalidationEligible(
                metadata: metadata,
                now: expiry.addingTimeInterval(30 * day)
            )
        )
    }

    func testDefinitiveValidationStatusStopsLaterAttempts() async {
        for status in [LicenseKeyStatus.revoked, .disabled] {
            var clock = now
            let client = ScriptedPolarClient()
            client.validationResults = [
                .success(
                    PolarLicenseSnapshot(
                        keyStatus: status,
                        expiresAt: now.addingTimeInterval(day)
                    )
                )
            ]
            let repository = activeRepository(
                expiresAt: now.addingTimeInterval(day),
                lastValidatedAt: now.addingTimeInterval(-day)
            )
            let controller = makeController(
                client: client,
                repository: repository,
                now: { clock }
            )

            await controller.revalidateIfNeeded()
            clock = now.addingTimeInterval(day)
            await controller.revalidateIfNeeded()

            XCTAssertEqual(client.validateCount, 1)
            XCTAssertEqual(repository.metadata?.keyStatus, status)
        }
    }

    func testValidationFailuresPreservePriorSnapshotAndMetadata() async {
        for error in [
            PolarLicenseClientError.malformedResponse,
            .networkUnavailable
        ] {
            let client = ScriptedPolarClient()
            client.validationResults = [.failure(error)]
            let repository = activeRepository(
                expiresAt: now.addingTimeInterval(day),
                lastValidatedAt: now.addingTimeInterval(-day)
            )
            let metadata = repository.metadata
            let controller = makeController(client: client, repository: repository)
            let state = controller.state

            await controller.revalidateIfNeeded()

            XCTAssertEqual(controller.state, state)
            XCTAssertEqual(repository.metadata, metadata)
            XCTAssertEqual(repository.saveValidationCount, 0)
            XCTAssertNil(controller.recoveryNotice)
        }
    }

    func testStateRemainsReadableWhileValidationRequestIsSuspended() async {
        let client = ScriptedPolarClient()
        client.validationDelayNanoseconds = 150_000_000
        client.validationResults = [.failure(.networkUnavailable)]
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now.addingTimeInterval(-day)
        )
        let controller = makeController(client: client, repository: repository)

        let validation = Task { await controller.revalidateIfNeeded() }
        await Task.yield()

        XCTAssertEqual(
            controller.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(day)))
        )
        await validation.value
        XCTAssertEqual(
            controller.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(day)))
        )
    }

    func testAllSixStatesRemainImmediatelyReadableWithSuspendedOrOfflineClient() async {
        let polarCases: [(TimeInterval, TimeInterval, LicenseState)] = [
            (
                day,
                -day,
                .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(day)))
            ),
            (
                -day,
                -2 * day,
                .grace(LicenseEntitlement(expiresAt: now.addingTimeInterval(-day)))
            ),
            (
                -8 * day,
                -9 * day,
                .expiredReminder(LicenseEntitlement(expiresAt: now.addingTimeInterval(-8 * day)))
            )
        ]

        for (expiryOffset, validationOffset, expectedState) in polarCases {
            let gate = AsyncTestGate()
            let client = ScriptedPolarClient()
            client.validationGate = gate
            client.validationResults = [.failure(.networkUnavailable)]
            let repository = activeRepository(
                expiresAt: now.addingTimeInterval(expiryOffset),
                lastValidatedAt: now.addingTimeInterval(validationOffset)
            )
            let controller = makeController(client: client, repository: repository)

            let validation = Task { await controller.revalidateIfNeeded() }
            for _ in 0..<100 where client.validateCount == 0 {
                await Task.yield()
            }

            XCTAssertEqual(client.validateCount, 1)
            XCTAssertEqual(controller.state, expectedState)
            await gate.open()
            await validation.value
            XCTAssertEqual(controller.state, expectedState)
        }

        let fallbackCases: [(StoredLicenseCandidate, LicenseState)] = [
            (.missing, .unlicensed),
            (.available("invalid-token"), .invalid(reason: "Stored license data could not be verified.")),
            (.unavailable("offline"), .licenseCheckFailed(reason: "Local license storage could not be checked."))
        ]
        for (candidate, expectedState) in fallbackCases {
            let client = ScriptedPolarClient()
            client.validationResults = [.failure(.networkUnavailable)]
            let store = LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(candidate: candidate),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: LicenseVerifier(publicKeys: [])
            )
            let controller = makeController(
                client: client,
                repository: InMemoryPolarRepository(),
                store: store
            )

            let validation = Task { await controller.revalidateIfNeeded() }
            XCTAssertEqual(controller.state, expectedState)
            await validation.value
            XCTAssertEqual(controller.state, expectedState)
            XCTAssertEqual(client.validateCount, 0)
        }
    }

    func testLateValidationResponseCannotRestoreRemovedEntitlement() async {
        let log = OperationLog()
        let client = ScriptedPolarClient(log: log)
        client.validationDelayNanoseconds = 150_000_000
        client.validationResults = [
            .success(
                PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(30 * day)
                )
            )
        ]
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now.addingTimeInterval(-day),
            log: log
        )
        let controller = makeController(client: client, repository: repository)

        let validation = Task { await controller.revalidateIfNeeded() }
        for _ in 0..<100 where client.validateCount == 0 {
            await Task.yield()
        }
        XCTAssertEqual(client.validateCount, 1)
        await controller.removeLicense()
        await validation.value

        XCTAssertEqual(controller.state, .unlicensed)
        XCTAssertNil(repository.credentials)
        XCTAssertEqual(repository.metadata, PolarLicenseMetadata(installationSuffix: "7Q2F"))
        XCTAssertFalse(log.values.contains("saveValidation"))
    }

    func testOnlineRemovalDeactivatesBeforeBestEffortLocalClear() async {
        let log = OperationLog()
        let client = ScriptedPolarClient(log: log)
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now,
            log: log
        )
        let controller = makeController(client: client, repository: repository)

        await controller.removeLicense()

        XCTAssertEqual(log.values, ["deactivate", "clear"])
        XCTAssertEqual(controller.state, .unlicensed)
        XCTAssertNil(controller.recoveryNotice)
        XCTAssertEqual(repository.metadata, PolarLicenseMetadata(installationSuffix: "7Q2F"))
    }

    func testRemovalWaitsForBoundedDeactivationResultBeforeLocalClear() async {
        let gate = AsyncTestGate()
        let client = ScriptedPolarClient()
        client.deactivationGate = gate
        client.deactivationError = .networkUnavailable
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now
        )
        let controller = makeController(client: client, repository: repository)

        let removal = Task { await controller.removeLicense() }
        for _ in 0..<100 where client.deactivateCount == 0 {
            await Task.yield()
        }

        XCTAssertEqual(client.deactivateCount, 1)
        XCTAssertEqual(repository.clearCount, 0)
        await gate.open()
        await removal.value
        XCTAssertEqual(repository.clearCount, 1)
        XCTAssertEqual(controller.recoveryNotice, .occupiedSlot)
    }

    func testOfflineRemovalClearsLocallyAndShowsOccupiedSlotRecovery() async {
        let client = ScriptedPolarClient()
        client.deactivationError = .networkUnavailable
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now
        )
        let controller = makeController(client: client, repository: repository)

        await controller.removeLicense()

        XCTAssertEqual(repository.clearCount, 1)
        XCTAssertEqual(controller.state, .unlicensed)
        XCTAssertEqual(controller.recoveryNotice, .occupiedSlot)
    }

    func testPolarRemovalClearsLegacyTokenSoRelaunchStaysUnlicensed() async throws {
        let fixture = LicenseFixtureFactory(now: now)
        let legacyToken = try fixture.token()
        let legacyKeychain = InMemoryLicenseTokenStorage(candidate: .available(legacyToken))
        let legacyFallback = InMemoryLicenseTokenStorage(candidate: .available(legacyToken))
        let store = LicenseStore(
            keychainStore: legacyKeychain,
            fallbackStore: legacyFallback,
            verifier: fixture.verifier()
        )
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now
        )
        let controller = makeController(
            client: ScriptedPolarClient(),
            repository: repository,
            store: store
        )

        await controller.removeLicense()

        XCTAssertEqual(legacyKeychain.candidate, .missing)
        XCTAssertEqual(legacyFallback.candidate, .missing)
        let relaunched = makeController(
            client: ScriptedPolarClient(),
            repository: repository,
            store: store
        )
        XCTAssertEqual(relaunched.state, .unlicensed)
    }

    func testReplacementPreservesOccupiedSlotNoticeAndActivatesNewKeyAfterClear() async {
        let log = OperationLog()
        let client = ScriptedPolarClient(log: log)
        client.deactivationError = .networkUnavailable
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(30 * day)
                )
            )
        )
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now,
            log: log
        )
        let controller = makeController(client: client, repository: repository)

        let replaced = await controller.replaceLicense(with: "new-polar-key")

        XCTAssertTrue(replaced)
        XCTAssertEqual(log.values, ["deactivate", "clear", "activate", "saveActivation"])
        XCTAssertEqual(repository.credentials?.key, "new-polar-key")
        XCTAssertEqual(controller.recoveryNotice, .occupiedSlot)
    }

    func testReplacementActivationFailureKeepsOccupiedSlotGuidance() async {
        let client = ScriptedPolarClient()
        client.deactivationError = .networkUnavailable
        client.activationResult = .failure(.invalidLicense)
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now
        )
        let controller = makeController(client: client, repository: repository)

        let replaced = await controller.replaceLicense(with: "invalid-new-key")

        XCTAssertFalse(replaced)
        XCTAssertTrue(controller.recoveryNotice?.offersSlotRecovery == true)
        XCTAssertTrue(controller.recoveryNotice?.message.contains("may still be occupied") == true)
        XCTAssertTrue(controller.recoveryNotice?.message.contains("could not validate") == true)
    }

    func testPartialLocalClearFailureIsSanitizedAndKeepsCleanupRetryAvailable() async {
        let client = ScriptedPolarClient()
        let repository = activeRepository(
            expiresAt: now.addingTimeInterval(day),
            lastValidatedAt: now
        )
        repository.failClear = true
        repository.failClearReason = "raw-key polar-secret-key"
        let controller = makeController(client: client, repository: repository)

        await controller.removeLicense()

        XCTAssertEqual(controller.recoveryNotice, .localStorage)
        guard case .licenseCheckFailed(let reason) = controller.state else {
            return XCTFail("expected sanitized local storage failure")
        }
        XCTAssertEqual(reason, "The Polar license could not be cleared locally.")
        XCTAssertFalse(reason.contains("polar-secret-key"))
        XCTAssertEqual(repository.credentials, testCredentials)
        XCTAssertTrue(controller.canRemovePolarLicense)

        repository.failClear = false
        await controller.removeLicense()

        XCTAssertNil(repository.credentials)
        XCTAssertFalse(controller.canRemovePolarLicense)
        XCTAssertEqual(controller.state, .unlicensed)
    }

    func testControllerReconstructionLoadsPersistedActivationWithoutNetwork() async {
        let client = ScriptedPolarClient()
        client.activationResult = .success(
            PolarActivationResult(
                activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                snapshot: PolarLicenseSnapshot(
                    keyStatus: .granted,
                    expiresAt: now.addingTimeInterval(30 * day)
                )
            )
        )
        let repository = InMemoryPolarRepository()
        let first = makeController(client: client, repository: repository)
        let activated = await first.activate(key: "polar-secret-key")
        XCTAssertTrue(activated)

        let reconstructedClient = ScriptedPolarClient()
        let reconstructed = makeController(
            client: reconstructedClient,
            repository: repository
        )

        XCTAssertEqual(reconstructed.entryAction, .replace)
        XCTAssertEqual(
            reconstructed.state,
            .licensed(LicenseEntitlement(expiresAt: now.addingTimeInterval(30 * day)))
        )
        XCTAssertEqual(repository.credentials?.key, "polar-secret-key")
        XCTAssertEqual(
            repository.credentials?.activationID,
            "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        )
        XCTAssertEqual(reconstructedClient.activateCount, 0)
        XCTAssertEqual(reconstructedClient.validateCount, 0)
    }

    private var testCredentials: PolarLicenseCredentials {
        PolarLicenseCredentials(
            key: "polar-test-key",
            activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        )
    }

    private func activeRepository(
        expiresAt: Date,
        lastValidatedAt: Date,
        log: OperationLog = OperationLog()
    ) -> InMemoryPolarRepository {
        let repository = InMemoryPolarRepository(log: log)
        repository.credentials = testCredentials
        repository.metadata = PolarLicenseMetadata(
            keyStatus: .granted,
            expiresAt: expiresAt,
            lastValidatedAt: lastValidatedAt,
            installationSuffix: "7Q2F"
        )
        return repository
    }

    private func makeController(
        client: ScriptedPolarClient,
        repository: InMemoryPolarRepository,
        configuration: PolarLicenseConfiguration? = nil,
        store: LicenseStore? = nil,
        now: @escaping () -> Date = { Date(timeIntervalSince1970: 1_800_000_000) }
    ) -> LicenseController {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return LicenseController(
            store: store ?? LicenseStore(
                keychainStore: InMemoryLicenseTokenStorage(),
                fallbackStore: InMemoryLicenseTokenStorage(),
                verifier: LicenseVerifier(publicKeys: [])
            ),
            polarClient: client,
            polarRepository: repository,
            configuration: configuration ?? PolarLicenseConfiguration(organizationID: organizationID),
            deviceLabel: PolarDeviceLabel(modelProvider: ControllerHardwareModel()),
            now: now,
            calendar: calendar
        )
    }
}

private final class ScriptedPolarClient: PolarLicenseClientProtocol {
    var activationResult: Result<PolarActivationResult, PolarLicenseClientError> = .failure(.invalidLicense)
    var validationResults: [Result<PolarLicenseSnapshot, PolarLicenseClientError>] = []
    var deactivationError: PolarLicenseClientError?
    var activationDelayNanoseconds: UInt64 = 0
    var validationDelayNanoseconds: UInt64 = 0
    var validationGate: AsyncTestGate?
    var deactivationGate: AsyncTestGate?
    private(set) var activateCount = 0
    private(set) var validateCount = 0
    private(set) var deactivateCount = 0
    private(set) var activationLabels: [String] = []
    private let log: OperationLog

    init(log: OperationLog = OperationLog()) {
        self.log = log
    }

    func activate(
        key: String,
        organizationID: UUID,
        label: String
    ) async throws -> PolarActivationResult {
        activateCount += 1
        activationLabels.append(label)
        log.values.append("activate")
        if activationDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: activationDelayNanoseconds)
        }
        return try activationResult.get()
    }

    func validate(
        key: String,
        organizationID: UUID,
        activationID: String
    ) async throws -> PolarLicenseSnapshot {
        validateCount += 1
        if let validationGate {
            await validationGate.wait()
        }
        if validationDelayNanoseconds > 0 {
            try? await Task.sleep(nanoseconds: validationDelayNanoseconds)
        }
        guard !validationResults.isEmpty else {
            throw PolarLicenseClientError.networkUnavailable
        }
        return try validationResults.removeFirst().get()
    }

    func deactivate(
        key: String,
        organizationID: UUID,
        activationID: String
    ) async throws {
        deactivateCount += 1
        log.values.append("deactivate")
        if let deactivationGate {
            await deactivationGate.wait()
        }
        if let deactivationError {
            throw deactivationError
        }
    }
}

private final class InMemoryPolarRepository: PolarLicenseRepositoryProtocol {
    var credentials: PolarLicenseCredentials?
    var metadata: PolarLicenseMetadata?
    var storageUnavailable = false
    var credentialsUnavailable = false
    var failSaveActivation = false
    var failClear = false
    var failClearReason = "clear failed"
    private(set) var clearCount = 0
    private(set) var clearCredentialsCount = 0
    private(set) var saveValidationCount = 0
    private let log: OperationLog

    init(log: OperationLog = OperationLog()) {
        self.log = log
    }

    func load() -> PolarLicenseLoadResult {
        PolarLicenseLoadResult(
            credentials: credentials,
            metadata: metadata,
            storageUnavailable: storageUnavailable || credentialsUnavailable,
            credentialsUnavailable: credentialsUnavailable
        )
    }

    func installationSuffix() throws -> String {
        if let metadata { return metadata.installationSuffix }
        metadata = PolarLicenseMetadata(installationSuffix: "7Q2F")
        return "7Q2F"
    }

    func saveActivation(
        credentials: PolarLicenseCredentials,
        snapshot: PolarLicenseSnapshot,
        suffix: String,
        validatedAt: Date
    ) throws {
        log.values.append("saveActivation")
        self.credentials = credentials
        if failSaveActivation {
            throw LicenseStorageError.failed("save failed")
        }
        metadata = PolarLicenseMetadata(
            keyStatus: snapshot.keyStatus,
            expiresAt: snapshot.expiresAt,
            lastValidatedAt: validatedAt,
            installationSuffix: suffix
        )
    }

    func saveValidation(snapshot: PolarLicenseSnapshot, validatedAt: Date) throws {
        saveValidationCount += 1
        log.values.append("saveValidation")
        guard let suffix = metadata?.installationSuffix else {
            throw LicenseStorageError.failed("missing metadata")
        }
        metadata = PolarLicenseMetadata(
            keyStatus: snapshot.keyStatus,
            expiresAt: snapshot.expiresAt,
            lastValidatedAt: validatedAt,
            installationSuffix: suffix
        )
    }

    func clearCredentials() throws {
        clearCredentialsCount += 1
        credentials = nil
    }

    func clearEntitlement() throws {
        clearCount += 1
        log.values.append("clear")
        if failClear {
            throw LicenseStorageError.failed(failClearReason)
        }
        credentials = nil
        if let suffix = metadata?.installationSuffix {
            metadata = PolarLicenseMetadata(installationSuffix: suffix)
        }
        storageUnavailable = false
    }
}

private actor AsyncTestGate {
    private var isOpen = false
    private var continuations: [CheckedContinuation<Void, Never>] = []

    func wait() async {
        if isOpen {
            return
        }
        await withCheckedContinuation { continuation in
            continuations.append(continuation)
        }
    }

    func open() {
        isOpen = true
        let waiting = continuations
        continuations.removeAll()
        for continuation in waiting {
            continuation.resume()
        }
    }
}

private final class OperationLog {
    var values: [String] = []
}

private struct ControllerHardwareModel: PolarHardwareModelProviding {
    func hardwareModel() -> String? { "Mac14,9" }
}
