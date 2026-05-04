import Foundation

struct LicenseToken: Equatable {
    static let prefix = "doc2md-license-v1"

    let rawValue: String
    let claimsSegment: String
    let signature: Data
    let signedBytes: Data
    let claims: LicenseClaims

    init(rawValue: String) throws {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let segments = trimmed.split(separator: ".", omittingEmptySubsequences: false)

        guard segments.count == 3 else {
            throw LicenseVerificationError.malformedToken
        }

        guard String(segments[0]) == Self.prefix else {
            throw LicenseVerificationError.unsupportedVersion
        }

        let claimsSegment = String(segments[1])
        let signatureSegment = String(segments[2])
        let claimsData = try Self.base64URLDecode(claimsSegment)
        let signature = try Self.base64URLDecode(signatureSegment)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970

        let claims: LicenseClaims
        do {
            claims = try decoder.decode(LicenseClaims.self, from: claimsData)
        } catch {
            throw LicenseVerificationError.malformedClaims
        }

        guard claims.version == 1 else {
            throw LicenseVerificationError.unsupportedVersion
        }

        guard let signedBytes = "\(Self.prefix).\(claimsSegment)".data(using: .utf8) else {
            throw LicenseVerificationError.malformedToken
        }

        self.rawValue = trimmed
        self.claimsSegment = claimsSegment
        self.signature = signature
        self.signedBytes = signedBytes
        self.claims = claims
    }

    static func base64URLEncode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func base64URLDecode(_ string: String) throws -> Data {
        guard !string.isEmpty else {
            throw LicenseVerificationError.invalidBase64URL
        }
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
        guard string.unicodeScalars.allSatisfy({ allowed.contains($0) }) else {
            throw LicenseVerificationError.invalidBase64URL
        }

        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padding = base64.count % 4
        if padding > 0 {
            base64 += String(repeating: "=", count: 4 - padding)
        }

        guard let data = Data(base64Encoded: base64) else {
            throw LicenseVerificationError.invalidBase64URL
        }

        return data
    }
}
