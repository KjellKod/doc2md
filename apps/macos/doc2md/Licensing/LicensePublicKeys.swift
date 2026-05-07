import Foundation

struct LicensePublicKey: Equatable {
    let keyID: String
    let publicKeyBase64: String
    let isDevelopmentKey: Bool
}

enum LicensePublicKeys {
    static let trustedKeys: [LicensePublicKey] = []
}
