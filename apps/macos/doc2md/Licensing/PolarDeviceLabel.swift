import Darwin
import Foundation

protocol PolarHardwareModelProviding {
    func hardwareModel() -> String?
}

protocol PolarInstallationSuffixGenerating {
    func generateSuffix() -> String
}

struct SystemPolarHardwareModelProvider: PolarHardwareModelProviding {
    func hardwareModel() -> String? {
        var size = 0
        guard sysctlbyname("hw.model", nil, &size, nil, 0) == 0, size > 1 else {
            return nil
        }
        var bytes = [CChar](repeating: 0, count: size)
        guard sysctlbyname("hw.model", &bytes, &size, nil, 0) == 0 else {
            return nil
        }
        return String(cString: bytes)
    }
}

struct RandomPolarInstallationSuffixGenerator: PolarInstallationSuffixGenerating {
    private static let alphabet = Array("23456789ABCDEFGHJKLMNPQRSTUVWXYZ")

    func generateSuffix() -> String {
        String((0..<4).map { _ in Self.alphabet.randomElement()! })
    }
}

struct PolarDeviceLabel {
    private let modelProvider: PolarHardwareModelProviding

    init(modelProvider: PolarHardwareModelProviding = SystemPolarHardwareModelProvider()) {
        self.modelProvider = modelProvider
    }

    func makeLabel(suffix: String) -> String {
        "\(safeModel) · \(suffix)"
    }

    private var safeModel: String {
        let raw = modelProvider.hardwareModel() ?? ""
        let printable = raw.unicodeScalars.filter {
            !CharacterSet.controlCharacters.contains($0)
        }
        let trimmed = String(String.UnicodeScalarView(printable))
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return "Mac"
        }
        return String(trimmed.prefix(80))
    }
}
