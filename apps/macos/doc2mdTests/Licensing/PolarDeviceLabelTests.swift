import XCTest

final class PolarDeviceLabelTests: XCTestCase {
    func testLabelUsesGenericModelAndSuffix() {
        let label = PolarDeviceLabel(modelProvider: StubPolarHardwareModel(value: "MacBookPro18,3"))

        XCTAssertEqual(label.makeLabel(suffix: "7Q2F"), "MacBookPro18,3 · 7Q2F")
    }

    func testMissingOrUnsafeModelFallsBackWithoutPersonalizedData() {
        let missing = PolarDeviceLabel(modelProvider: StubPolarHardwareModel(value: nil))
        let unsafe = PolarDeviceLabel(modelProvider: StubPolarHardwareModel(value: "\n\t"))

        XCTAssertEqual(missing.makeLabel(suffix: "7Q2F"), "Mac · 7Q2F")
        XCTAssertEqual(unsafe.makeLabel(suffix: "7Q2F"), "Mac · 7Q2F")
    }

    func testSameModelInstallationsRemainDistinguishable() {
        let label = PolarDeviceLabel(modelProvider: StubPolarHardwareModel(value: "Mac14,9"))

        XCTAssertNotEqual(
            label.makeLabel(suffix: "7Q2F"),
            label.makeLabel(suffix: "9R3G")
        )
    }
}

private struct StubPolarHardwareModel: PolarHardwareModelProviding {
    let value: String?
    func hardwareModel() -> String? { value }
}
