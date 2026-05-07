import Foundation

struct LicensePurchaser: Codable, Equatable {
    let email: String
    let displayName: String?

    enum CodingKeys: String, CodingKey {
        case email
        case displayName = "display_name"
    }
}

struct LicenseMerchant: Codable, Equatable {
    let provider: String
    let customerID: String?
    let orderID: String?

    enum CodingKeys: String, CodingKey {
        case provider
        case customerID = "customer_id"
        case orderID = "order_id"
    }
}

struct LicenseClaims: Codable, Equatable {
    let version: Int
    let keyID: String
    let licenseID: String
    let purchaser: LicensePurchaser
    let tier: String
    let issuedAt: Date
    let entitlement: String
    let merchant: LicenseMerchant
    let expiresAt: Date?
    let supportThrough: Date?
    let updatesThrough: Date?
    let majorVersionLimit: Int?

    enum CodingKeys: String, CodingKey {
        case version
        case keyID = "key_id"
        case licenseID = "license_id"
        case purchaser
        case tier
        case issuedAt = "issued_at"
        case entitlement
        case merchant
        case expiresAt = "expires_at"
        case supportThrough = "support_through"
        case updatesThrough = "updates_through"
        case majorVersionLimit = "major_version_limit"
    }

    init(
        version: Int,
        keyID: String,
        licenseID: String,
        purchaser: LicensePurchaser,
        tier: String,
        issuedAt: Date,
        entitlement: String,
        merchant: LicenseMerchant,
        expiresAt: Date?,
        supportThrough: Date?,
        updatesThrough: Date?,
        majorVersionLimit: Int?
    ) {
        self.version = version
        self.keyID = keyID
        self.licenseID = licenseID
        self.purchaser = purchaser
        self.tier = tier
        self.issuedAt = issuedAt
        self.entitlement = entitlement
        self.merchant = merchant
        self.expiresAt = expiresAt
        self.supportThrough = supportThrough
        self.updatesThrough = updatesThrough
        self.majorVersionLimit = majorVersionLimit
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        version = try container.decode(Int.self, forKey: .version)
        keyID = try container.decode(String.self, forKey: .keyID)
        licenseID = try container.decode(String.self, forKey: .licenseID)
        purchaser = try container.decode(LicensePurchaser.self, forKey: .purchaser)
        tier = try container.decode(String.self, forKey: .tier)
        issuedAt = try Self.decodeUnixSeconds(from: container, forKey: .issuedAt)
        entitlement = try container.decode(String.self, forKey: .entitlement)
        merchant = try container.decode(LicenseMerchant.self, forKey: .merchant)
        expiresAt = try Self.decodeOptionalUnixSeconds(from: container, forKey: .expiresAt)
        supportThrough = try Self.decodeOptionalUnixSeconds(from: container, forKey: .supportThrough)
        updatesThrough = try Self.decodeOptionalUnixSeconds(from: container, forKey: .updatesThrough)
        majorVersionLimit = try container.decodeIfPresent(Int.self, forKey: .majorVersionLimit)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        try container.encode(version, forKey: .version)
        try container.encode(keyID, forKey: .keyID)
        try container.encode(licenseID, forKey: .licenseID)
        try container.encode(purchaser, forKey: .purchaser)
        try container.encode(tier, forKey: .tier)
        try container.encode(Self.unixSeconds(from: issuedAt), forKey: .issuedAt)
        try container.encode(entitlement, forKey: .entitlement)
        try container.encode(merchant, forKey: .merchant)
        try container.encodeIfPresent(expiresAt.map(Self.unixSeconds), forKey: .expiresAt)
        try container.encodeIfPresent(supportThrough.map(Self.unixSeconds), forKey: .supportThrough)
        try container.encodeIfPresent(updatesThrough.map(Self.unixSeconds), forKey: .updatesThrough)
        try container.encodeIfPresent(majorVersionLimit, forKey: .majorVersionLimit)
    }

    private static func decodeUnixSeconds(
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys
    ) throws -> Date {
        let seconds = try container.decode(Int.self, forKey: key)
        return Date(timeIntervalSince1970: TimeInterval(seconds))
    }

    private static func decodeOptionalUnixSeconds(
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys
    ) throws -> Date? {
        guard let seconds = try container.decodeIfPresent(Int.self, forKey: key) else {
            return nil
        }
        return Date(timeIntervalSince1970: TimeInterval(seconds))
    }

    private static func unixSeconds(from date: Date) -> Int {
        Int(date.timeIntervalSince1970)
    }
}
