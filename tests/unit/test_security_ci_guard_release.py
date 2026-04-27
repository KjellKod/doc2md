import importlib.util
import tempfile
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "security_ci_guard.py"
RELEASE_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "release-mac.yml"


def load_module():
    spec = importlib.util.spec_from_file_location("security_ci_guard", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def write_workflow(directory: Path, text: str) -> Path:
    path = directory / "workflow.yml"
    path.write_text(textwrap.dedent(text).lstrip(), encoding="utf-8")
    return path


class SecurityCiGuardReleaseTests(unittest.TestCase):
    def test_release_workflow_passes_guard(self):
        module = load_module()

        self.assertEqual(module.scan_workflow(RELEASE_WORKFLOW), [])

    def test_apple_secret_without_environment_fails_guard(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  sign:
                    runs-on: macos-latest
                    steps:
                      - run: echo "${{ secrets.APPLE_NOTARY_API_KEY_ID }}"
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("without an environment gate", failures[0])

    def test_pull_request_target_anywhere_fails_guard(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  pull_request_target:
                jobs:
                  noop:
                    runs-on: ubuntu-latest
                    steps:
                      - run: true
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("pull_request_target is banned", failures[0])

    def test_unpinned_checkout_action_fails_guard_for_secret_job(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  sign:
                    runs-on: macos-latest
                    environment: mac-release
                    steps:
                      - uses: actions/checkout@v5
                      - run: echo "${{ secrets.SPARKLE_EDDSA_PRIVATE_KEY }}"
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("unpinned actions/checkout@v5", failures[0])

    def test_job_referencing_both_apple_and_sparkle_secrets_fails_guard(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  mixed:
                    runs-on: macos-latest
                    environment: mac-release
                    steps:
                      - run: echo "${{ secrets.APPLE_NOTARY_API_KEY_ID }} ${{ secrets.SPARKLE_EDDSA_PRIVATE_KEY }}"
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("must not reference both Apple and Sparkle secrets", failures[0])

    def test_push_only_workflow_without_secrets_passes_guard(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: ok
                on:
                  push:
                jobs:
                  build:
                    runs-on: ubuntu-latest
                    steps:
                      - run: true
                """,
            )

            self.assertEqual(module.scan_workflow(path), [])

    def test_release_workflow_regex_tag_filter_fails_guard(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "release-mac.yml"
            path.write_text(
                textwrap.dedent(
                    """
                    name: bad
                    on:
                      push:
                        tags: ["v[0-9]+.[0-9]+.[0-9]+"]
                    jobs:
                      build:
                        runs-on: ubuntu-latest
                        steps:
                          - run: true
                    """
                ).lstrip(),
                encoding="utf-8",
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("GitHub globs", failures[0])

    def test_release_workflow_multiline_regex_tag_filter_fails_guard(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "release-mac.yml"
            path.write_text(
                textwrap.dedent(
                    """
                    name: bad
                    on:
                      push:
                        tags:
                          - "v[0-9]+.[0-9]+.[0-9]+"
                    jobs:
                      build:
                        runs-on: ubuntu-latest
                        steps:
                          - run: true
                    """
                ).lstrip(),
                encoding="utf-8",
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("GitHub globs", failures[0])

    def test_release_workflow_tag_filter_comment_plus_passes_guard(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "release-mac.yml"
            path.write_text(
                textwrap.dedent(
                    """
                    name: ok
                    on:
                      push:
                        tags:
                          - "v*.*.*" # semver check with + happens in shell regex
                    jobs:
                      build:
                        runs-on: ubuntu-latest
                        steps:
                          - run: true
                    """
                ).lstrip(),
                encoding="utf-8",
            )

            self.assertEqual(module.scan_workflow(path), [])


if __name__ == "__main__":
    unittest.main()
