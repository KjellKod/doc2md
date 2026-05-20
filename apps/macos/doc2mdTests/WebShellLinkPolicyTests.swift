import Foundation
import WebKit
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

    func testInternalURL_isCaseInsensitiveForBundledScheme() {
        let url = URL(string: "DOC2MD://app/")!
        XCTAssertTrue(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_rejectsBundledSchemeWithWrongHost() {
        // AppSchemeHandler serves resources without checking the host, so the
        // policy layer is what blocks doc2md://attacker/... from being treated
        // as an in-shell link.
        let url = URL(string: "doc2md://attacker/index.html")!
        XCTAssertFalse(WebShellLinkPolicy.isInternalURL(url))
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

    func testInternalURL_acceptsLocalhostWithUpperCaseHostInDebug() {
        // URL hosts can show up case-mixed if a developer overrides the dev URL;
        // the rule lowercases the host so the dev-server allowance survives that.
        let url = URL(string: "HTTP://Localhost:5173/")!
        XCTAssertTrue(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_rejectsLocalhostOnWrongPortInDebug() {
        // The dev server is hardcoded to 5173; a link to a different local port
        // should not be treated as our shell.
        let url = URL(string: "http://localhost:3000/")!
        XCTAssertFalse(WebShellLinkPolicy.isInternalURL(url))
    }

    func testInternalURL_rejectsLocalhostHttpsInDebug() {
        // Vite serves HTTP, not HTTPS; tightening to http only.
        let url = URL(string: "https://localhost:5173/")!
        XCTAssertFalse(WebShellLinkPolicy.isInternalURL(url))
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

    // MARK: - route(for:)

    func testRoute_allowsNilURL() {
        // The initial WKWebView load posts a request with nil URL fields. Allow it
        // so we never accidentally cancel our own bootstrap.
        let routing = WebShellLinkPolicy.route(for: nil)
        XCTAssertEqual(routing, .allowInShell)
    }

    func testRoute_allowsInternalDoc2mdScheme() {
        let routing = WebShellLinkPolicy.route(for: URL(string: "doc2md://app/index.html")!)
        XCTAssertEqual(routing, .allowInShell)
    }

    #if DEBUG
    func testRoute_allowsLocalhostInDebug() {
        let routing = WebShellLinkPolicy.route(for: URL(string: "http://localhost:5173/")!)
        XCTAssertEqual(routing, .allowInShell)
    }
    #endif

    func testRoute_cancelsAndHandsOffHttpsToBrowser() {
        let target = URL(string: "https://github.com/KjellKod/doc2md")!
        let routing = WebShellLinkPolicy.route(for: target)
        XCTAssertEqual(routing.policy, .cancel)
        XCTAssertEqual(routing.openExternally, target)
    }

    func testRoute_cancelsAndHandsOffMailto() {
        let target = URL(string: "mailto:hello@example.com")!
        let routing = WebShellLinkPolicy.route(for: target)
        XCTAssertEqual(routing.policy, .cancel)
        XCTAssertEqual(routing.openExternally, target)
    }

    func testRoute_cancelsSilentlyForJavascriptScheme() {
        // javascript: must never reach NSWorkspace.shared.open — that would let a
        // hostile or malformed link launch an arbitrary handler.
        let routing = WebShellLinkPolicy.route(for: URL(string: "javascript:alert(1)")!)
        XCTAssertEqual(routing.policy, .cancel)
        XCTAssertNil(routing.openExternally)
    }

    func testRoute_cancelsSilentlyForFileScheme() {
        let routing = WebShellLinkPolicy.route(for: URL(string: "file:///etc/passwd")!)
        XCTAssertEqual(routing.policy, .cancel)
        XCTAssertNil(routing.openExternally)
    }

    func testRoute_allowsInternalEvenIfSchemeIsOtherwiseOpenable() {
        // Defensive: an in-shell doc2md:// link with target=_blank must never be
        // handed to NSWorkspace.open. route() makes this impossible by checking
        // isInternalURL first.
        let routing = WebShellLinkPolicy.route(for: URL(string: "doc2md://app/")!)
        XCTAssertEqual(routing, .allowInShell)
    }

    // MARK: - route(forNavigationActionWith:navigationType:)

    func testNavigationRoute_handsOffLinkActivatedToBrowser() {
        let target = URL(string: "https://github.com/KjellKod/doc2md")!
        let routing = WebShellLinkPolicy.route(
            forNavigationActionWith: target,
            navigationType: .linkActivated
        )
        XCTAssertEqual(routing.policy, .cancel)
        XCTAssertEqual(routing.openExternally, target)
    }

    func testNavigationRoute_cancelsFormSubmitsSilently() {
        // POST bodies must never be replayed as a Safari GET.
        let target = URL(string: "https://example.com/submit")!
        let routing = WebShellLinkPolicy.route(
            forNavigationActionWith: target,
            navigationType: .formSubmitted
        )
        XCTAssertEqual(routing, .cancelSilently)
    }

    func testNavigationRoute_cancelsFormResubmitsSilently() {
        let target = URL(string: "https://example.com/submit")!
        let routing = WebShellLinkPolicy.route(
            forNavigationActionWith: target,
            navigationType: .formResubmitted
        )
        XCTAssertEqual(routing, .cancelSilently)
    }

    func testNavigationRoute_cancelsBackForwardSilently() {
        // External history items should not be re-launched in the browser.
        let target = URL(string: "https://example.com/")!
        let routing = WebShellLinkPolicy.route(
            forNavigationActionWith: target,
            navigationType: .backForward
        )
        XCTAssertEqual(routing, .cancelSilently)
    }

    func testNavigationRoute_cancelsReloadOfExternalSilently() {
        let target = URL(string: "https://example.com/")!
        let routing = WebShellLinkPolicy.route(
            forNavigationActionWith: target,
            navigationType: .reload
        )
        XCTAssertEqual(routing, .cancelSilently)
    }

    func testNavigationRoute_cancelsProgrammaticNavigationToExternal() {
        // .other covers `window.location = "https://..."` and similar JS-driven
        // navigations. We never need to open these in the browser, so cancel.
        let target = URL(string: "https://example.com/")!
        let routing = WebShellLinkPolicy.route(
            forNavigationActionWith: target,
            navigationType: .other
        )
        XCTAssertEqual(routing, .cancelSilently)
    }

    func testNavigationRoute_allowsInternalRegardlessOfNavigationType() {
        // The initial doc2md:// bootstrap arrives with .other; back/forward
        // inside the SPA also fires here. All must still be allowed in-shell.
        let internalURL = URL(string: "doc2md://app/index.html")!
        for navigationType: WKNavigationType in [
            .other, .reload, .backForward, .linkActivated,
        ] {
            let routing = WebShellLinkPolicy.route(
                forNavigationActionWith: internalURL,
                navigationType: navigationType
            )
            XCTAssertEqual(
                routing,
                .allowInShell,
                "navigationType \(navigationType.rawValue) should still allow internal URL"
            )
        }
    }
}
