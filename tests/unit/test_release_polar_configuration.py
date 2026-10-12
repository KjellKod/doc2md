import os
import re
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = REPO_ROOT / "scripts" / "build-mac-app.sh"
RELEASE_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "release-mac.yml"
XCODE_PROJECT = REPO_ROOT / "apps" / "macos" / "doc2md.xcodeproj" / "project.pbxproj"
POLAR_CLIENT = REPO_ROOT / "apps" / "macos" / "doc2md" / "Licensing" / "PolarLicenseClient.swift"
LICENSE_WINDOW = REPO_ROOT / "apps" / "macos" / "doc2md" / "Licensing" / "LicenseWindow.swift"


class ReleasePolarConfigurationTests(unittest.TestCase):
    def run_build_helper(
        self,
        *arguments: str,
        environment: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        build_environment = os.environ.copy()
        for name in (
            "DOC2MD_POLAR_ORGANIZATION_ID",
            "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID",
            "OTHER_SWIFT_FLAGS",
            "SWIFT_ACTIVE_COMPILATION_CONDITIONS",
        ):
            build_environment.pop(name, None)
        build_environment.update(environment or {})
        return subprocess.run(
            ["bash", str(BUILD_SCRIPT), *arguments],
            cwd=REPO_ROOT,
            env=build_environment,
            text=True,
            capture_output=True,
            check=False,
        )

    def assert_fails_before_build(
        self,
        result: subprocess.CompletedProcess[str],
        text: str,
    ) -> None:
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(text, result.stderr)
        self.assertNotIn("Native file API allowlist", result.stdout)

    def test_required_production_organization_id_rejects_missing_value(self) -> None:
        result = self.run_build_helper(
            "--configuration",
            "Release",
            "--require-polar-organization-id",
        )

        self.assert_fails_before_build(result, "DOC2MD_POLAR_ORGANIZATION_ID is required")

    def test_supplied_production_organization_id_rejects_malformed_value(self) -> None:
        result = self.run_build_helper(
            "--configuration",
            "Release",
            environment={"DOC2MD_POLAR_ORGANIZATION_ID": "not-a-uuid"},
        )

        self.assert_fails_before_build(result, "DOC2MD_POLAR_ORGANIZATION_ID must be a UUID")

    def test_release_rejects_sandbox_flag(self) -> None:
        result = self.run_build_helper(
            "--configuration",
            "Release",
            "--polar-sandbox",
            environment={
                "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
            },
        )

        self.assert_fails_before_build(result, "--polar-sandbox requires Debug")

    def test_normal_build_rejects_sandbox_organization_id(self) -> None:
        result = self.run_build_helper(
            "--configuration",
            "Release",
            environment={
                "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
            },
        )

        self.assert_fails_before_build(
            result,
            "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID requires --polar-sandbox",
        )

    def test_release_rejects_sandbox_compile_condition(self) -> None:
        result = self.run_build_helper(
            "--configuration",
            "Release",
            environment={"OTHER_SWIFT_FLAGS": "$(inherited) -DDOC2MD_POLAR_SANDBOX"},
        )

        self.assert_fails_before_build(result, "Release builds cannot use DOC2MD_POLAR_SANDBOX")

    def test_normal_debug_build_rejects_active_sandbox_compile_condition(self) -> None:
        result = self.run_build_helper(
            "--configuration",
            "Debug",
            environment={
                "PATH": "/usr/bin:/bin",
                "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG DOC2MD_POLAR_SANDBOX",
            },
        )

        self.assert_fails_before_build(result, "Debug builds cannot use DOC2MD_POLAR_SANDBOX")

    def test_sandbox_requires_organization_id(self) -> None:
        result = self.run_build_helper("--configuration", "Debug", "--polar-sandbox")

        self.assert_fails_before_build(
            result,
            "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID is required",
        )

    def test_sandbox_rejects_malformed_organization_id(self) -> None:
        result = self.run_build_helper(
            "--configuration",
            "Debug",
            "--polar-sandbox",
            environment={"DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID": "not-a-uuid"},
        )

        self.assert_fails_before_build(
            result,
            "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID must be a UUID",
        )

    def test_sandbox_rejects_production_organization_id(self) -> None:
        result = self.run_build_helper(
            "--configuration",
            "Debug",
            "--polar-sandbox",
            environment={
                "DOC2MD_POLAR_ORGANIZATION_ID": "11111111-2222-3333-4444-555555555555",
                "DOC2MD_POLAR_SANDBOX_ORGANIZATION_ID": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            },
        )

        self.assert_fails_before_build(
            result,
            "DOC2MD_POLAR_ORGANIZATION_ID cannot be set for a sandbox build",
        )

    def test_sandbox_build_settings_are_pinned(self) -> None:
        script = BUILD_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("OTHER_SWIFT_FLAGS=$(inherited) -DDOC2MD_POLAR_SANDBOX", script)
        self.assertIn("PRODUCT_BUNDLE_IDENTIFIER=com.kjellkod.doc2md.sandbox", script)
        self.assertIn("DOC2MD_BUNDLE_DISPLAY_NAME=$SANDBOX_APP_NAME", script)
        self.assertIn("DOC2MD_BUNDLE_NAME=$SANDBOX_APP_NAME", script)
        self.assertNotIn("SWIFT_ACTIVE_COMPILATION_CONDITIONS=", script)

    def test_production_bundle_identity_defaults_are_pinned(self) -> None:
        project = XCODE_PROJECT.read_text(encoding="utf-8")

        self.assertEqual(project.count("DOC2MD_BUNDLE_DISPLAY_NAME = doc2md;"), 2)
        self.assertEqual(project.count("DOC2MD_BUNDLE_NAME = doc2md;"), 2)

    def test_build_helper_verifies_production_bundle_identity(self) -> None:
        script = BUILD_SCRIPT.read_text(encoding="utf-8")

        self.assertIn(
            '[[ "$BUILT_DISPLAY_NAME" == "doc2md" ]] || fail "production Info.plist has the wrong display name"',
            script,
        )
        self.assertIn(
            '[[ "$BUILT_BUNDLE_NAME" == "doc2md" ]] || fail "production Info.plist has the wrong bundle name"',
            script,
        )
        self.assertIn(
            '[[ "$BUILT_BUNDLE_IDENTIFIER" == "com.kjellkod.doc2md" ]] || fail "production Info.plist has the wrong bundle identifier"',
            script,
        )

    def test_release_workflow_wires_public_variable_and_plist_assertion(self) -> None:
        workflow = RELEASE_WORKFLOW.read_text(encoding="utf-8")
        build_job = workflow.split("\n  release:\n", maxsplit=1)[0]

        self.assertIn(
            "DOC2MD_POLAR_ORGANIZATION_ID: ${{ vars.DOC2MD_POLAR_ORGANIZATION_ID }}",
            build_job,
        )
        self.assertIn("--require-polar-organization-id", build_job)
        self.assertIn("Print :DOC2MDPolarOrganizationID", build_job)
        self.assertIn('"$POLAR_ORGANIZATION_ID" != "$DOC2MD_POLAR_ORGANIZATION_ID"', build_job)
        self.assertIsNone(re.search(r"^    environment:", build_job, re.MULTILINE))
        self.assertNotIn("secrets.DOC2MD_POLAR_ORGANIZATION_ID", workflow)

    def test_swift_compile_guard_prevents_non_debug_sandbox(self) -> None:
        source = POLAR_CLIENT.read_text(encoding="utf-8")

        self.assertIn("#if DOC2MD_POLAR_SANDBOX && !DEBUG", source)
        self.assertIn("#error", source)

    def test_license_window_uses_canonical_support_url(self) -> None:
        source = LICENSE_WINDOW.read_text(encoding="utf-8")

        self.assertIn(
            'Link("Email support", destination: PolarLicenseConfiguration.supportURL)',
            source,
        )


if __name__ == "__main__":
    unittest.main()
