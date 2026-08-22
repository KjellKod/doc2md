import re
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = REPO_ROOT / "scripts" / "build-mac-app.sh"


class NativeAPIGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        script = BUILD_SCRIPT.read_text(encoding="utf-8")
        pattern = re.search(r"^ALLOWED_NATIVE_API_PATTERN=.*$", script, re.MULTILINE)
        function = re.search(
            r"^is_allowed_native_api_match\(\) \{.*?^\}",
            script,
            re.MULTILINE | re.DOTALL,
        )
        organization_id_function = re.search(
            r"^validated_polar_organization_id\(\) \{.*?^\}",
            script,
            re.MULTILINE | re.DOTALL,
        )
        if pattern is None or function is None or organization_id_function is None:
            raise AssertionError("build guard functions were not found")
        cls.predicate = f"{pattern.group(0)}\n{function.group(0)}"
        cls.organization_id_function = organization_id_function.group(0)

    def run_predicate(self, value: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", "-c", f'{self.predicate}\nis_allowed_native_api_match "$1"', "guard", value],
            check=False,
            text=True,
            capture_output=True,
        )

    def test_exact_polar_atomic_write_is_allowed(self) -> None:
        result = self.run_predicate(
            "apps/macos/doc2md/Licensing/PolarLicensePersistence.swift:199:"
            "        try encoded.write(to: metadataURL, options: [.atomic])"
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_one_token_different_polar_write_is_rejected(self) -> None:
        result = self.run_predicate(
            "apps/macos/doc2md/Licensing/PolarLicensePersistence.swift:199:"
            "        try encoded.write(to: otherURL, options: [.atomic])"
        )
        self.assertNotEqual(result.returncode, 0)

    def test_approved_polar_write_with_appended_write_is_rejected(self) -> None:
        result = self.run_predicate(
            "apps/macos/doc2md/Licensing/PolarLicensePersistence.swift:199:"
            "        try encoded.write(to: metadataURL, options: [.atomic]); "
            "try secret.write(to: otherURL)"
        )
        self.assertNotEqual(result.returncode, 0)

    def test_malformed_polar_organization_id_is_ignored(self) -> None:
        for value in ("not/a-uuid", "[bad", "11111111-2222-3333-4444-55555555555z"):
            result = subprocess.run(
                [
                    "bash",
                    "-c",
                    f'{self.organization_id_function}\nvalidated_polar_organization_id "$1"',
                    "organization-id",
                    value,
                ],
                check=False,
                text=True,
                capture_output=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, "")

    def test_valid_polar_organization_id_is_preserved(self) -> None:
        value = "11111111-2222-3333-4444-555555555555"
        result = subprocess.run(
            [
                "bash",
                "-c",
                f'{self.organization_id_function}\nvalidated_polar_organization_id "$1"',
                "organization-id",
                value,
            ],
            check=False,
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, value)


if __name__ == "__main__":
    unittest.main()
