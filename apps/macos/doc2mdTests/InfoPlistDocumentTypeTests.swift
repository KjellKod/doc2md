import XCTest

// The hosted test target sets TEST_HOST to the built doc2md.app, so
// Bundle.main here is the application bundle after build-setting
// substitution. These assertions confirm the Markdown declaration survives
// into the shipped Info.plist and stays scoped strictly to Markdown.
final class InfoPlistDocumentTypeTests: XCTestCase {
    func testBuiltInfoPlistDeclaresMarkdownDocumentTypes() throws {
        let info = try XCTUnwrap(Bundle.main.infoDictionary)

        let documentTypes = try XCTUnwrap(
            info["CFBundleDocumentTypes"] as? [[String: Any]]
        )
        let markdownType = try XCTUnwrap(
            documentTypes.first { type in
                (type["CFBundleTypeName"] as? String) == "Markdown Document"
            }
        )

        XCTAssertEqual(markdownType["CFBundleTypeRole"] as? String, "Viewer")
        XCTAssertEqual(markdownType["LSHandlerRank"] as? String, "Owner")

        let extensions = try XCTUnwrap(
            markdownType["CFBundleTypeExtensions"] as? [String]
        )
        XCTAssertEqual(Set(extensions), ["md", "markdown"])

        let contentTypes = try XCTUnwrap(
            markdownType["LSItemContentTypes"] as? [String]
        )
        XCTAssertEqual(contentTypes, ["net.daringfireball.markdown"])
    }

    func testBuiltInfoPlistDeclaresMarkdownImportedType() throws {
        let info = try XCTUnwrap(Bundle.main.infoDictionary)

        let importedTypes = try XCTUnwrap(
            info["UTImportedTypeDeclarations"] as? [[String: Any]]
        )
        let markdownDeclaration = try XCTUnwrap(
            importedTypes.first { declaration in
                (declaration["UTTypeIdentifier"] as? String)
                    == "net.daringfireball.markdown"
            }
        )

        let conformsTo = try XCTUnwrap(
            markdownDeclaration["UTTypeConformsTo"] as? [String]
        )
        XCTAssertTrue(conformsTo.contains("public.plain-text"))

        let tagSpec = try XCTUnwrap(
            markdownDeclaration["UTTypeTagSpecification"] as? [String: Any]
        )
        let fileExtensions = try XCTUnwrap(
            tagSpec["public.filename-extension"] as? [String]
        )
        XCTAssertEqual(Set(fileExtensions), ["md", "markdown"])
    }

    func testDocumentTypesDoNotDeclareNonMarkdownImportFormats() throws {
        let info = try XCTUnwrap(Bundle.main.infoDictionary)
        let documentTypes = try XCTUnwrap(
            info["CFBundleDocumentTypes"] as? [[String: Any]]
        )

        let declaredExtensions = documentTypes
            .compactMap { $0["CFBundleTypeExtensions"] as? [String] }
            .flatMap { $0 }
            .map { $0.lowercased() }

        XCTAssertEqual(Set(declaredExtensions), ["md", "markdown"])
    }
}
