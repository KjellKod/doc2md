import Foundation
import XCTest

final class WebShellLinkPolicyTests: XCTestCase {
    // MARK: - isInternalURL

    func testInternalURL_acceptsBundledAppScheme() {
        let url = URL(string: "doc2md://app/index.html")!
        XCTAssertTrue(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_acceptsBundledAppSchemeWithSubresource() {
        let url = URL(string: "doc2md://app/assets/index.js")!
        XCTAssertTrue(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_rejectsHttps() {
        let url = URL(string: "https://github.com/KjellKod/doc2md")!
        XCTAssertFalse(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_rejectsHttpRemoteHost() {
        let url = URL(string: "http://example.com/")!
        XCTAssertFalse(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_rejectsFile() {
        let url = URL(string: "file:///etc/passwd")!
        XCTAssertFalse(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_rejectsURLWithoutScheme() {
        let url = URL(string: "/relative/path")!
        XCTAssertFalse(WebShellLinkPolicy.isInternalURL(url))
    }

    #if DEBUG
    func testInternalURL_acceptsLocalhostHttpInDebug() {
        let url = URL(string: "http://localhost:5173/")!
        XCTAssertTrue(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_rejectsLoopbackIPInDebug() {
        // We allow only the explicit "localhost" hostname to keep the rule narrow.
        let url = URL(string: "http://127.0.0.1:5173/")!
        XCTAssertFalse(WebShellLinkPolicy.isInternalURL(url))
    }
    #endif

    // MARK: - isExternallyOpenable

    func testExternallyOpenable_acceptsHttp() {
        XCTAssertTrue(WebShellLinkPolicy.isExternallyOpenable(URL(string: "http://example.com/")!))
    }

    func testExternallyOpenable_acceptsHttps() {
        XCTAssertTrue(WebShellLinkPolicy.isExternallyOpenable(URL(string: "https://example.com/")!))
    }

    func testExternallyOpenable_acceptsMailto() {
        XCTAssertTrue(WebShellLinkPolicy.isExternallyOpenable(URL(string: "mailto:hello@example.com")!))
    }

    func testExternallyOpenable_acceptsTel() {
        XCTAssertTrue(WebShellLinkPolicy.isExternallyOpenable(URL(string: "tel:+15555550100")!))
    }

    func testExternallyOpenable_rejectsBundledAppScheme() {
        // Internal URLs are never opened externally.
        XCTAssertFalse(WebShellLinkPolicy.isExternallyOpenable(URL(string: "doc2md://app/")!))
    }

    func testExternallyOpenable_rejectsFile() {
        XCTAssertFalse(WebShellLinkPolicy.isExternallyOpenable(URL(string: "file:///etc/passwd")!))
    }

    func testExternallyOpenable_rejectsJavascript() {
        // javascript: URLs are never handed to NSWorkspace.
        XCTAssertFalse(WebShellLinkPolicy.isExternallyOpenable(URL(string: "javascript:void(0)")!))
    }

    func testExternallyOpenable_rejectsAboutBlank() {
        XCTAssertFalse(WebShellLinkPolicy.isExternallyOpenable(URL(string: "about:blank")!))
    }

    func testExternallyOpenable_isCaseInsensitive() {
        XCTAssertTrue(WebShellLinkPolicy.isExternallyOpenable(URL(string: "HTTPS://example.com/")!))
        XCTAssertTrue(WebShellLinkPolicy.isExternallyOpenable(URL(string: "MAILTO:hello@example.com")!))
    }
}
