import Foundation
import XCTest

final class PolarLicenseClientTests: XCTestCase {
    private let organizationID = UUID(uuidString: "11111111-2222-3333-4444-555555555555")!

    override func tearDown() {
        MockPolarURLProtocol.handler = nil
        super.tearDown()
    }

    func testActivateSendsPublicFieldsWithoutCredentialsAndMapsResponse() async throws {
        var capturedRequest: URLRequest?
        MockPolarURLProtocol.handler = { request in
            capturedRequest = request
            return Self.response(
                for: request,
                status: 200,
                body: """
                {
                  "id": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                  "license_key": {
                    "status": "granted",
                    "expires_at": "2026-09-01T12:30:45.123Z"
                  }
                }
                """
            )
        }
        let client = makeClient()

        let result = try await client.activate(
            key: "polar-test-key",
            organizationID: organizationID,
            label: "MacBookPro18,3 · 7Q2F"
        )

        XCTAssertEqual(result.activationID, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
        XCTAssertEqual(result.snapshot.keyStatus, .granted)
        XCTAssertNotNil(result.snapshot.expiresAt)
        let request = try XCTUnwrap(capturedRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/v1/customer-portal/license-keys/activate")
        XCTAssertEqual(request.timeoutInterval, 15)
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
        XCTAssertNil(request.value(forHTTPHeaderField: "Cookie"))
        let body = try requestJSON(request)
        XCTAssertEqual(Set(body.keys), ["key", "organization_id", "label"])
        XCTAssertEqual(body["key"] as? String, "polar-test-key")
        XCTAssertEqual(body["organization_id"] as? String, organizationID.uuidString.lowercased())
        XCTAssertEqual(body["label"] as? String, "MacBookPro18,3 · 7Q2F")
    }

    func testValidateSendsActivationAndMapsRecognizedStatus() async throws {
        var capturedRequest: URLRequest?
        MockPolarURLProtocol.handler = { request in
            capturedRequest = request
            return Self.response(
                for: request,
                status: 200,
                body: "{\"status\":\"revoked\",\"expires_at\":null}"
            )
        }

        let result = try await makeClient().validate(
            key: "polar-test-key",
            organizationID: organizationID,
            activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        )

        XCTAssertEqual(result, PolarLicenseSnapshot(keyStatus: .revoked, expiresAt: nil))
        let request = try XCTUnwrap(capturedRequest)
        XCTAssertEqual(request.url?.path, "/v1/customer-portal/license-keys/validate")
        XCTAssertEqual(request.timeoutInterval, 15)
        XCTAssertEqual(
            try requestJSON(request)["activation_id"] as? String,
            "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        )
    }

    func testDeactivateUsesSharedTimeoutAndAcceptsNoContent() async throws {
        var capturedRequest: URLRequest?
        MockPolarURLProtocol.handler = { request in
            capturedRequest = request
            return Self.response(for: request, status: 204, body: "")
        }

        try await makeClient().deactivate(
            key: "polar-test-key",
            organizationID: organizationID,
            activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        )

        XCTAssertEqual(capturedRequest?.url?.path, "/v1/customer-portal/license-keys/deactivate")
        XCTAssertEqual(capturedRequest?.timeoutInterval, 15)
    }

    func testProviderFailuresAreClassifiedWithoutResponseBodyLeakage() async {
        let cases: [(Int, PolarLicenseClientError)] = [
            (403, .activationLimitReached),
            (404, .invalidLicense),
            (422, .invalidLicense),
            (503, .networkUnavailable)
        ]
        for testCase in cases {
            MockPolarURLProtocol.handler = { request in
                Self.response(
                    for: request,
                    status: testCase.0,
                    body: "{\"detail\":\"private provider payload\"}"
                )
            }
            do {
                _ = try await makeClient().activate(
                    key: "polar-test-key",
                    organizationID: organizationID,
                    label: "Mac · 7Q2F"
                )
                XCTFail("expected failure for status \(testCase.0)")
            } catch let error as PolarLicenseClientError {
                XCTAssertEqual(error, testCase.1)
                XCTAssertFalse(String(describing: error).contains("private provider payload"))
            } catch {
                XCTFail("unexpected error \(error)")
            }
        }
    }

    func testMalformedAndUnknownStatusResponsesStaySanitized() async {
        for body in ["not-json", "{\"status\":\"unknown\",\"expires_at\":null}"] {
            MockPolarURLProtocol.handler = { request in
                Self.response(for: request, status: 200, body: body)
            }
            do {
                _ = try await makeClient().validate(
                    key: "polar-test-key",
                    organizationID: organizationID,
                    activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
                )
                XCTFail("expected malformed response")
            } catch let error as PolarLicenseClientError {
                XCTAssertEqual(error, .malformedResponse)
            } catch {
                XCTFail("unexpected error \(error)")
            }
        }
    }

    func testOfflineErrorMapsToNetworkUnavailable() async {
        MockPolarURLProtocol.handler = { _ in
            throw URLError(.notConnectedToInternet)
        }
        do {
            _ = try await makeClient().validate(
                key: "polar-test-key",
                organizationID: organizationID,
                activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
            )
            XCTFail("expected offline failure")
        } catch let error as PolarLicenseClientError {
            XCTAssertEqual(error, .networkUnavailable)
        } catch {
            XCTFail("unexpected error \(error)")
        }
    }

    func testTimeoutMapsToNetworkUnavailable() async {
        MockPolarURLProtocol.handler = { _ in
            throw URLError(.timedOut)
        }

        do {
            _ = try await makeClient().validate(
                key: "polar-test-key",
                organizationID: organizationID,
                activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
            )
            XCTFail("expected timeout failure")
        } catch let error as PolarLicenseClientError {
            XCTAssertEqual(error, .networkUnavailable)
        } catch {
            XCTFail("unexpected error \(error)")
        }
    }

    func testResponseCookieIsNotReplayedOnLaterRequest() async throws {
        var requests: [URLRequest] = []
        MockPolarURLProtocol.handler = { request in
            requests.append(request)
            if requests.count == 1 {
                return Self.response(
                    for: request,
                    status: 200,
                    body: """
                    {
                      "id": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                      "license_key": {"status":"granted","expires_at":null}
                    }
                    """,
                    headers: ["Set-Cookie": "polar_session=must-not-return; Path=/"]
                )
            }
            return Self.response(
                for: request,
                status: 200,
                body: "{\"status\":\"granted\",\"expires_at\":null}"
            )
        }
        let client = makeClient()

        _ = try await client.activate(
            key: "polar-test-key",
            organizationID: organizationID,
            label: "Mac · 7Q2F"
        )
        _ = try await client.validate(
            key: "polar-test-key",
            organizationID: organizationID,
            activationID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
        )

        XCTAssertEqual(requests.count, 2)
        XCTAssertFalse(requests[0].httpShouldHandleCookies)
        XCTAssertFalse(requests[1].httpShouldHandleCookies)
        XCTAssertNil(requests[1].value(forHTTPHeaderField: "Cookie"))
    }

    private func makeClient() -> PolarLicenseClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockPolarURLProtocol.self]
        return PolarLicenseClient(
            session: URLSession(configuration: configuration),
            baseURL: URL(string: "https://api.polar.sh")!
        )
    }

    private func requestJSON(_ request: URLRequest) throws -> [String: Any] {
        let data: Data
        if let httpBody = request.httpBody {
            data = httpBody
        } else {
            let stream = try XCTUnwrap(request.httpBodyStream)
            stream.open()
            defer { stream.close() }
            var bytes = [UInt8](repeating: 0, count: 4_096)
            var collected = Data()
            while stream.hasBytesAvailable {
                let count = stream.read(&bytes, maxLength: bytes.count)
                guard count >= 0 else {
                    throw stream.streamError ?? URLError(.cannotDecodeContentData)
                }
                if count == 0 { break }
                collected.append(contentsOf: bytes.prefix(count))
            }
            data = collected
        }
        return try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
    }

    private static func response(
        for request: URLRequest,
        status: Int,
        body: String,
        headers: [String: String] = [:]
    ) -> (HTTPURLResponse, Data) {
        var responseHeaders = ["Content-Type": "application/json"]
        responseHeaders.merge(headers) { _, new in new }
        return (
            HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: nil,
                headerFields: responseHeaders
            )!,
            Data(body.utf8)
        )
    }
}

private final class MockPolarURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
