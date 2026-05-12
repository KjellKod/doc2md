import importlib.util
import tempfile
import textwrap
import unittest
from pathlib import Path


# This repo pins first-party actions/* by tag because GitHub is the platform
# vendor and Dependabot tracks new first-party action releases. The workflow
# guard intentionally does not enforce SHA pinning for actions/*.
REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "security_ci_guard.py"
RELEASE_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "release-mac.yml"
WORKFLOW_DIR = REPO_ROOT / ".github" / "workflows"


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

    def test_rule1_cache_in_release_job_flags_npm_cache(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  release:
                    runs-on: ubuntu-latest
                    steps:
                      - uses: actions/setup-node@v6
                        with:
                          node-version: 22
                          cache: npm
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("Rule 1", failures[0])

    def test_rule1_cache_in_contents_write_job_flags_pnpm_cache(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  publish-assets:
                    runs-on: ubuntu-latest
                    permissions:
                      contents: write
                    steps:
                      - uses: actions/setup-node@v6
                        with:
                          node-version: 22
                          cache: pnpm
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("Rule 1", failures[0])

    def test_rule1_cache_in_job_key_without_display_name_flags(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  notarize:
                    runs-on: ubuntu-latest
                    steps:
                      - uses: actions/setup-node@v6
                        with:
                          node-version: 22
                          cache: yarn
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("Rule 1", failures[0])

    def test_rule2_npm_install_g_without_ignore_scripts_flags(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  review:
                    runs-on: ubuntu-latest
                    steps:
                      - run: npm install -g @openai/codex
                      - run: echo "${{ secrets.OPENAI_API_KEY }}"
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("Rule 2", failures[0])

    def test_rule2_npm_install_g_with_ignore_scripts_passes(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: ok
                on:
                  push:
                jobs:
                  review:
                    runs-on: ubuntu-latest
                    steps:
                      - run: npm install -g --ignore-scripts @openai/codex
                      - run: echo "${{ secrets.OPENAI_API_KEY }}"
                """,
            )

            self.assertEqual(module.scan_workflow(path), [])

    def test_rule2_and_rule3_dispatch_counts_global_and_local_once(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  review:
                    runs-on: ubuntu-latest
                    steps:
                      - run: npm install -g @openai/codex
                      - run: npm ci
                      - run: echo "${{ secrets.OPENAI_API_KEY }}"
                """,
            )

            failures = module.scan_workflow(path)

        relevant_failures = [
            failure
            for failure in failures
            if "Rule 2" in failure or "Rule 3" in failure
        ]
        self.assertEqual(len(relevant_failures), 2)
        self.assertEqual(sum("Rule 2" in failure for failure in relevant_failures), 1)
        self.assertEqual(sum("Rule 3" in failure for failure in relevant_failures), 1)

    def test_rule3_npm_ci_without_ignore_scripts_flags(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  build:
                    runs-on: ubuntu-latest
                    steps:
                      - run: npm ci
                      - run: echo "${{ secrets.MACOS_CERTIFICATE }}"
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("Rule 3", failures[0])

    def test_rule3_npm_ci_with_ignore_scripts_passes(self):
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
                      - run: npm ci --ignore-scripts
                      - run: echo "${{ secrets.MACOS_CERTIFICATE }}"
                """,
            )

            self.assertEqual(module.scan_workflow(path), [])

    def test_rule3_npm_ci_ignore_scripts_false_flags(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  build:
                    runs-on: ubuntu-latest
                    steps:
                      - run: npm ci --ignore-scripts=false
                      - run: echo "${{ secrets.MACOS_CERTIFICATE }}"
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("Rule 3", failures[0])

    def test_rule3_comment_only_secret_reference_does_not_flag(self):
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
                      - run: npm ci # MACOS_CERTIFICATE
                """,
            )

            self.assertEqual(module.scan_workflow(path), [])

    def test_rule3_secret_token_regex_does_not_match_unrelated_identifier(self):
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
                    env:
                      MY_APPLE_BUTTON_COLOR: blue
                    steps:
                      - run: npm ci
                """,
            )

            self.assertEqual(module.scan_workflow(path), [])

    def test_rule4_id_token_write_outside_allowlist_flags(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                jobs:
                  publish:
                    runs-on: ubuntu-latest
                    permissions:
                      id-token: write
                    steps:
                      - run: true
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("Rule 4", failures[0])

    def test_rule4_id_token_write_deploy_pages_deploy_allowlist_passes(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "deploy-pages.yml"
            path.write_text(
                textwrap.dedent(
                    """
                    name: ok
                    on:
                      push:
                    jobs:
                      deploy:
                        runs-on: ubuntu-latest
                        permissions:
                          pages: write
                          id-token: write
                        steps:
                          - run: true
                    """
                ).lstrip(),
                encoding="utf-8",
            )

            self.assertEqual(module.scan_workflow(path), [])

    def test_rule4_workflow_level_id_token_write_flags(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = write_workflow(
                Path(tmp),
                """
                name: bad
                on:
                  push:
                permissions:
                  contents: read
                  id-token: write
                jobs:
                  deploy:
                    runs-on: ubuntu-latest
                    steps:
                      - run: true
                """,
            )

            failures = module.scan_workflow(path)

        self.assertEqual(len(failures), 1)
        self.assertIn("Rule 4", failures[0])

    def test_rule1_rule2_rule3_rule4_real_workflow_tree_passes_security_ci_guard(self):
        module = load_module()

        failures = []
        for path in sorted(WORKFLOW_DIR.glob("*.y*ml")):
            failures.extend(module.scan_workflow(path))

        self.assertEqual(failures, [])


if __name__ == "__main__":
    unittest.main()
