import Foundation

enum PolarLicenseClientError: Error, Equatable {
    case activationLimitReached
    case invalidLicense
    case networkUnavailable
    case malformedResponse
    case providerRejectedRequest
}

struct PolarLicenseSnapshot: Equatable {
    let keyStatus: LicenseKeyStatus
    let expiresAt: Date?
}

struct PolarActivationResult: Equatable {
    let activationID: String
    let snapshot: PolarLicenseSnapshot
}

protocol PolarLicenseClientProtocol {
    func activate(
        key: String,
        organizationID: UUID,
        label: String
    ) async throws -> PolarActivationResult

    func validate(
        key: String,
        organizationID: UUID,
        activationID: String
    ) async throws -> PolarLicenseSnapshot

    func deactivate(
        key: String,
        organizationID: UUID,
        activationID: String
    ) async throws
}

struct PolarLicenseClient: PolarLicenseClientProtocol {
    static let requestTimeout: TimeInterval = 15
    static let productionBaseURL = URL(string: "https://api.polar.sh")!

    private let session: URLSession
    private let baseURL: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(session: URLSession? = nil, baseURL: URL = Self.productionBaseURL) {
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            configuration.urlCache = nil
            configuration.httpShouldSetCookies = false
            configuration.httpCookieStorage = nil
            self.session = URLSession(configuration: configuration)
        }
        self.baseURL = baseURL
    }

    func activate(
        key: String,
        organizationID: UUID,
        label: String
    ) async throws -> PolarActivationResult {
        let body = ActivateRequest(
            key: key,
            organizationID: organizationID.uuidString.lowercased(),
            label: label
        )
        let data = try await post(path: "activate", body: body, successStatus: 200)

        let response: ActivateResponse
        do {
            response = try decoder.decode(ActivateResponse.self, from: data)
        } catch {
            throw PolarLicenseClientError.malformedResponse
        }
        guard UUID(uuidString: response.id) != nil,
              let status = LicenseKeyStatus(rawProviderValue: response.licenseKey.status)
        else {
            throw PolarLicenseClientError.malformedResponse
        }
        let expiresAt = try parseOptionalDate(response.licenseKey.expiresAt)
        return PolarActivationResult(
            activationID: response.id,
            snapshot: PolarLicenseSnapshot(keyStatus: status, expiresAt: expiresAt)
        )
    }

    func validate(
        key: String,
        organizationID: UUID,
        activationID: String
    ) async throws -> PolarLicenseSnapshot {
        let body = ActivationRequest(
            key: key,
            organizationID: organizationID.uuidString.lowercased(),
            activationID: activationID
        )
        let data = try await post(path: "validate", body: body, successStatus: 200)

        let response: ValidateResponse
        do {
            response = try decoder.decode(ValidateResponse.self, from: data)
        } catch {
            throw PolarLicenseClientError.malformedResponse
        }
        guard let status = LicenseKeyStatus(rawProviderValue: response.status) else {
            throw PolarLicenseClientError.malformedResponse
        }
        let expiresAt = try parseOptionalDate(response.expiresAt)
        return PolarLicenseSnapshot(keyStatus: status, expiresAt: expiresAt)
    }

    func deactivate(
        key: String,
        organizationID: UUID,
        activationID: String
    ) async throws {
        let body = ActivationRequest(
            key: key,
            organizationID: organizationID.uuidString.lowercased(),
            activationID: activationID
        )
        _ = try await post(path: "deactivate", body: body, successStatus: 204)
    }

    private func post<Body: Encodable>(
        path: String,
        body: Body,
        successStatus: Int
    ) async throws -> Data {
        let endpoint = baseURL
            .appendingPathComponent("v1")
            .appendingPathComponent("customer-portal")
            .appendingPathComponent("license-keys")
            .appendingPathComponent(path)
        guard endpoint.scheme == "https" else {
            throw PolarLicenseClientError.providerRejectedRequest
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = Self.requestTimeout
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where Self.isNetworkUnavailable(error) {
            throw PolarLicenseClientError.networkUnavailable
        } catch {
            throw PolarLicenseClientError.networkUnavailable
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw PolarLicenseClientError.malformedResponse
        }
        if httpResponse.statusCode == successStatus {
            return data
        }
        switch httpResponse.statusCode {
        case 403 where path == "activate":
            throw PolarLicenseClientError.activationLimitReached
        case 404, 422:
            throw PolarLicenseClientError.invalidLicense
        case 500...599:
            throw PolarLicenseClientError.networkUnavailable
        default:
            throw PolarLicenseClientError.providerRejectedRequest
        }
    }

    private static func isNetworkUnavailable(_ error: URLError) -> Bool {
        switch error.code {
        case .timedOut,
             .cannotFindHost,
             .cannotConnectToHost,
             .networkConnectionLost,
             .dnsLookupFailed,
             .notConnectedToInternet,
             .internationalRoamingOff,
             .callIsActive,
             .dataNotAllowed:
            return true
        default:
            return false
        }
    }

    private func parseOptionalDate(_ value: String?) throws -> Date? {
        guard let value else {
            return nil
        }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) {
            return date
        }
        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        guard let date = standard.date(from: value) else {
            throw PolarLicenseClientError.malformedResponse
        }
        return date
    }
}

extension LicenseKeyStatus {
    init?(rawProviderValue: String) {
        switch rawProviderValue {
        case "granted": self = .granted
        case "revoked": self = .revoked
        case "disabled": self = .disabled
        default: return nil
        }
    }
}

private struct ActivateRequest: Encodable {
    let key: String
    let organizationID: String
    let label: String

    enum CodingKeys: String, CodingKey {
        case key
        case organizationID = "organization_id"
        case label
    }
}

private struct ActivationRequest: Encodable {
    let key: String
    let organizationID: String
    let activationID: String

    enum CodingKeys: String, CodingKey {
        case key
        case organizationID = "organization_id"
        case activationID = "activation_id"
    }
}

private struct ActivateResponse: Decodable {
    let id: String
    let licenseKey: ProviderLicenseKey

    enum CodingKeys: String, CodingKey {
        case id
        case licenseKey = "license_key"
    }
}

private struct ValidateResponse: Decodable {
    let status: String
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case status
        case expiresAt = "expires_at"
    }
}

private struct ProviderLicenseKey: Decodable {
    let status: String
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case status
        case expiresAt = "expires_at"
    }
}
