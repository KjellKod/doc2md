import Foundation

struct LicenseClaims: Codable, Equatable {
    let version: Int
    let keyID: String
    let licenseID: String
    let purchaser: String
    let tier: String
    let issuedAt: Date
    let expiresAt: Date?
    let merchantCustomerID: String?
    let merchantOrderID: String?

    enum CodingKeys: String, CodingKey {
        case version
        case keyID = "key_id"
        case licenseID = "license_id"
        case purchaser
        case tier
        case issuedAt = "issued_at"
        case expiresAt = "expires_at"
        case merchantCustomerID = "merchant_customer_id"
        case merchantOrderID = "merchant_order_id"
    }
}

