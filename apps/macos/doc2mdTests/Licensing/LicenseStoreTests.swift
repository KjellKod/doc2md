import Foundation
import Security
import XCTest

final class LicenseStoreTests: XCTestCase {
    func testKeychainQueryUsesNonSyncingAttribute() {
        let query = KeychainLicenseStore().queryAttributesForTesting()

        let synchronizable = query[kSecAttrSynchronizable as String] as AnyObject
        XCTAssertTrue(synchronizable === kCFBooleanFalse)
    }

    func testValidKeychainInvalidFallbackReturnsKeychainAndRemovesInvalidFallback() throws {
        let fixture = LicenseFixtureFactory()
        let validToken = try fixture.token()
        let keychain = InMemoryLicenseTokenStorage(candidate: .available(validToken))
        let fallback = InMemoryLicenseTokenStorage(candidate: .available("invalid"))
        let store = LicenseStore(keychainStore: keychain, fallbackStore: fallback, verifier: fixture.verifier())

        let result = store.loadToken()

        XCTAssertEqual(result.token, validToken)
        XCTAssertEqual(fallback.clearCount, 1)
    }

    func testValidKeychainDisagreeingValidFallbackReturnsKeychainAndRemovesFallback() throws {
        let fixture = LicenseFixtureFactory()
        let keychainToken = try fixture.token(purchaser: "keychain@example.com")
        let fallbackToken = try fixture.token(purchaser: "fallback@example.com")
        let keychain = InMemoryLicenseTokenStorage(candidate: .available(keychainToken))
        let fallback = InMemoryLicenseTokenStorage(candidate: .available(fallbackToken))
        let store = LicenseStore(keychainStore: keychain, fallbackStore: fallback, verifier: fixture.verifier())

        let result = store.loadToken()

        XCTAssertEqual(result.token, keychainToken)
        XCTAssertEqual(fallback.clearCount, 1)
    }

    func testInvalidKeychainValidFallbackRepairsKeychainWithoutDeletingFallback() throws {
        let fixture = LicenseFixtureFactory()
        let fallbackToken = try fixture.token()
        let keychain = InMemoryLicenseTokenStorage(candidate: .available("invalid"))
        let fallback = InMemoryLicenseTokenStorage(candidate: .available(fallbackToken))
        let store = LicenseStore(keychainStore: keychain, fallbackStore: fallback, verifier: fixture.verifier())

        let result = store.loadToken()

        XCTAssertEqual(result.token, fallbackToken)
        XCTAssertEqual(keychain.savedTokens, [fallbackToken])
        XCTAssertEqual(fallback.clearCount, 0)
    }

    func testUnavailableKeychainValidFallbackReturnsFallback() throws {
        let fixture = LicenseFixtureFactory()
        let fallbackToken = try fixture.token()
        let keychain = InMemoryLicenseTokenStorage(candidate: .unavailable("no keychain"))
        let fallback = InMemoryLicenseTokenStorage(candidate: .available(fallbackToken))
        let store = LicenseStore(keychainStore: keychain, fallbackStore: fallback, verifier: fixture.verifier())

        let result = store.loadToken()

        XCTAssertEqual(result.token, fallbackToken)
        XCTAssertFalse(result.state.allowsReminders)
    }

    func testInvalidOnlyStoresProduceInvalidStateWithoutDataLoss() {
        let fixture = LicenseFixtureFactory()
        let keychain = InMemoryLicenseTokenStorage(candidate: .available("invalid-keychain"))
        let fallback = InMemoryLicenseTokenStorage(candidate: .available("invalid-fallback"))
        let store = LicenseStore(keychainStore: keychain, fallbackStore: fallback, verifier: fixture.verifier())

        let result = store.loadToken()

        if case .invalid = result.state {
            XCTAssertEqual(keychain.clearCount, 0)
            XCTAssertEqual(fallback.clearCount, 0)
        } else {
            XCTFail("expected invalid state")
        }
    }
}
