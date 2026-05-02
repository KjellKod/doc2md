import Foundation

struct LicensePublicKey: Equatable {
    let keyID: String
    let publicKeyBase64: String
    let isDevelopmentKey: Bool
}

enum LicensePublicKeys {
    static let developmentKeyID = "doc2md-dev-ed25519-2026-05"

    static let trustedKeys = [
        LicensePublicKey(
            keyID: developmentKeyID,
            publicKeyBase64: "cHVibGljLWRldmVsb3BtZW50LWtleS0zMi1ieXRlcyE",
            isDevelopmentKey: true
        )
    ]
}
