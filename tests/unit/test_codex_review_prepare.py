import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "codex_review_prepare.py"


def load_module():
    spec = importlib.util.spec_from_file_location("codex_review_prepare", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class CodexReviewPrepareTests(unittest.TestCase):
    def test_truncate_diff_adds_marker_and_metadata(self):
        module = load_module()

        truncated, metadata = module.truncate_diff("abcdef", max_diff_bytes=3)

        self.assertIn("DIFF TRUNCATED", truncated)
        self.assertEqual(metadata["original_diff_bytes"], 6)
        self.assertTrue(metadata["diff_truncated"])

    def test_filter_binary_files_removes_known_binary_extensions(self):
        module = load_module()

        filtered = module.filter_binary_files(
            ["src/App.tsx", "docs/spec.pdf", "assets/logo.png", "scripts/tool.py"]
        )

        self.assertEqual(filtered, ["src/App.tsx", "scripts/tool.py"])

    def test_build_prompt_replaces_all_placeholders(self):
        module = load_module()

        prompt = module.build_prompt(
            template_text="A {PLACEHOLDER_PR_DESCRIPTION} B {PLACEHOLDER_EXISTING_COMMENTS} C {PLACEHOLDER_PR_HEAD_FILES} D {PLACEHOLDER_DIFF}",
            pr_description="desc",
            existing_comments_json="[]",
            pr_head_files="files",
            diff_text="diff",
        )

        self.assertEqual(prompt, "A desc B [] C files D diff")

    def test_fetch_diff_uses_supported_gh_command(self):
        module = load_module()

        with mock.patch.object(module, "run_command", return_value="diff") as run_command:
            diff = module.fetch_diff("owner/repo", 17)

        self.assertEqual(diff, "diff")
        run_command.assert_called_once_with(
            ["gh", "pr", "diff", "17", "--repo", "owner/repo", "--patch"]
        )

    def test_filter_excluded_diff_sections_removes_binary_hunks(self):
        module = load_module()

        filtered = module.filter_excluded_diff_sections(
            "\n".join(
                [
                    "diff --git a/src/app.py b/src/app.py",
                    "--- a/src/app.py",
                    "+++ b/src/app.py",
                    "@@ -1 +1 @@",
                    "-old",
                    "+new",
                    "diff --git a/docs/spec.pdf b/docs/spec.pdf",
                    "--- a/docs/spec.pdf",
                    "+++ b/docs/spec.pdf",
                    "@@ -0,0 +1 @@",
                    "+binary",
                    "",
                ]
            )
        )

        self.assertIn("src/app.py", filtered)
        self.assertNotIn("docs/spec.pdf", filtered)

    def test_write_github_output_appends_to_existing_file(self):
        module = load_module()

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "github_output.txt"
            output_path.write_text("skip=true\n", encoding="utf-8")

            module.write_github_output(
                str(output_path),
                {
                    "review_diff_bytes": 10,
                    "original_diff_bytes": 12,
                    "diff_truncated": False,
                    "reviewable_files_count": 3,
                    "prompt_bytes": 99,
                },
            )

            content = output_path.read_text(encoding="utf-8")

        self.assertIn("skip=true\n", content)
        self.assertIn("diff_size=10\n", content)


if __name__ == "__main__":
    unittest.main()
