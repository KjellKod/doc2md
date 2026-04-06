import importlib.util
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "intent_review.py"


def load_module():
    spec = importlib.util.spec_from_file_location("intent_review", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class IntentReviewTests(unittest.TestCase):
    def test_aligned_pr(self):
        module = load_module()

        findings = module.assess_intent_alignment(
            "Split CI jobs",
            "Updates the CI workflow and review scripts for `.github/workflows/ci.yml` and `scripts/codex_review_post.py`.",
            [
                ".github/workflows/ci.yml",
                "scripts/codex_review_post.py",
                "docs/agentic-ci-guide.md",
            ],
        )

        self.assertEqual(findings, [])

    def test_mismatched_pr(self):
        module = load_module()

        findings = module.assess_intent_alignment(
            "Tweak docs",
            "Updates docs only.",
            [".github/workflows/ci.yml", "docs/guide.md"],
        )

        self.assertEqual(len(findings), 1)
        self.assertIn(".github/workflows", findings[0])

    def test_empty_body(self):
        module = load_module()

        findings = module.assess_intent_alignment(
            "Update scripts",
            "",
            ["scripts/intent_review.py"],
        )

        self.assertEqual(len(findings), 1)
        self.assertIn("PR body is empty", findings[0])


if __name__ == "__main__":
    unittest.main()
