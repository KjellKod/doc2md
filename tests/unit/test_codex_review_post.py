import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "codex_review_post.py"


def load_module():
    spec = importlib.util.spec_from_file_location("codex_review_post", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class CodexReviewPostTests(unittest.TestCase):
    def test_post_summary_returns_true_on_success(self):
        module = load_module()
        runner = mock.Mock(return_value=mock.Mock(returncode=0))

        posted = module.post_summary(
            "Review ran, no findings.",
            {"review_diff_bytes": 10, "review_output_bytes": 2},
            valid_json=True,
            findings_count=0,
            runner=runner,
            env={"PR_NUMBER": "12", "REPO": "owner/repo", "COMMIT_SHA": "abcdef1"},
        )

        self.assertTrue(posted)
        runner.assert_called_once()
        summary_body = runner.call_args.args[0][-1]
        self.assertIn("Commit: `abcdef1`", summary_body)
        self.assertIn("Response: Codex returned a valid JSON array with 0 findings.", summary_body)
        self.assertIn("Output: 2 bytes.", summary_body)

    def test_post_inline_returns_failed_comments(self):
        module = load_module()
        runner = mock.Mock(
            side_effect=[
                mock.Mock(returncode=0),
                mock.Mock(returncode=1),
            ]
        )

        failed = module.post_inline(
            [
                {"path": "a.py", "line": 1, "side": "RIGHT", "body": "first"},
                {"path": "b.py", "line": 2, "side": "RIGHT", "body": "second"},
            ],
            repo="owner/repo",
            pr_number="12",
            commit_sha="abcdef1",
            runner=runner,
        )

        self.assertEqual(failed, [{"path": "b.py", "line": 2, "side": "RIGHT", "body": "second"}])

    def test_post_fallback_comment_returns_true_on_success(self):
        module = load_module()
        runner = mock.Mock(return_value=mock.Mock(returncode=0))

        posted = module.post_fallback_comment(
            [{"path": "b.py", "line": 2, "side": "RIGHT", "body": "second"}],
            runner=runner,
            env={"PR_NUMBER": "12", "REPO": "owner/repo"},
        )

        self.assertTrue(posted)
        runner.assert_called_once()

    def test_parse_valid_json_array(self):
        module = load_module()

        comments = module.parse_review_output('[{"path":"a.py","line":1,"body":"x"}]')

        self.assertEqual(len(comments), 1)

    def test_parse_fenced_json(self):
        module = load_module()

        comments = module.parse_review_output(
            '```json\n[{"path":"a.py","line":1,"body":"x"}]\n```'
        )

        self.assertEqual(len(comments), 1)

    def test_parse_no_json_returns_none(self):
        module = load_module()

        comments = module.parse_review_output("not json")

        self.assertIsNone(comments)

    def test_validate_filters_invalid(self):
        module = load_module()

        comments = module.validate_comments(
            [
                {"path": "a.py", "line": "2", "body": "ok"},
                {"path": "", "line": 2, "body": "bad"},
                {"path": "b.py", "line": 0, "body": "bad"},
            ]
        )

        self.assertEqual(comments, [{"path": "a.py", "line": 2, "side": "RIGHT", "body": "ok"}])

    def test_deduplicate_removes_existing(self):
        module = load_module()
        comments = [{"path": "a.py", "line": 1, "side": "RIGHT", "body": "same"}]
        existing = [
            {"id": 1, "user": "github-actions[bot]", "body": "same"},
            {"id": 2, "user": "human", "body": "other"},
        ]

        filtered = module.deduplicate(comments, existing)

        self.assertEqual(filtered, [])

    def test_main_always_posts_summary_when_output_unparseable(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            review_output = tmp / "review-output.json"
            existing_comments = tmp / "existing.json"
            metadata = tmp / "metadata.json"

            review_output.write_text("not json", encoding="utf-8")
            existing_comments.write_text("[]", encoding="utf-8")
            metadata.write_text(json.dumps({"review_exit_code": 0}), encoding="utf-8")

            with mock.patch.object(module, "post_summary", return_value=True) as post_summary:
                rc = module.main(
                    [
                        "--review-output",
                        str(review_output),
                        "--existing-comments",
                        str(existing_comments),
                        "--metadata",
                        str(metadata),
                    ]
                )

        self.assertEqual(rc, 0)
        post_summary.assert_called_once()

    def test_main_empty_findings_summary_mentions_valid_json_response(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            review_output = tmp / "review-output.json"
            existing_comments = tmp / "existing.json"
            metadata = tmp / "metadata.json"

            review_output.write_text("[]", encoding="utf-8")
            existing_comments.write_text("[]", encoding="utf-8")
            metadata.write_text(
                json.dumps({"review_exit_code": 0, "review_output_bytes": 2}),
                encoding="utf-8",
            )

            with mock.patch.object(module, "post_summary", return_value=True) as post_summary:
                rc = module.main(
                    [
                        "--review-output",
                        str(review_output),
                        "--existing-comments",
                        str(existing_comments),
                        "--metadata",
                        str(metadata),
                    ]
                )

        self.assertEqual(rc, 0)
        post_summary.assert_called_once_with(
            "Review ran, no findings.",
            {"review_exit_code": 0, "review_output_bytes": 2},
            valid_json=True,
            findings_count=0,
        )

    def test_main_posts_summary_on_timeout(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            metadata = tmp / "metadata.json"
            metadata.write_text(json.dumps({"review_exit_code": 124}), encoding="utf-8")

            with mock.patch.object(module, "post_summary", return_value=True) as post_summary:
                rc = module.main(
                    [
                        "--review-output",
                        str(tmp / "missing.json"),
                        "--existing-comments",
                        str(tmp / "existing.json"),
                        "--metadata",
                        str(metadata),
                    ]
                )

        self.assertEqual(rc, 0)
        post_summary.assert_called_once()

    def test_main_posts_summary_when_review_is_skipped(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            metadata = tmp / "metadata.json"
            metadata.write_text("{}", encoding="utf-8")

            with mock.patch.object(module, "post_summary", return_value=True) as post_summary:
                rc = module.main(
                    [
                        "--review-output",
                        str(tmp / "missing.json"),
                        "--existing-comments",
                        str(tmp / "existing.json"),
                        "--metadata",
                        str(metadata),
                        "--skip-reason",
                        "OPENAI_API_KEY was unavailable.",
                    ]
                )

        self.assertEqual(rc, 0)
        post_summary.assert_called_once()

    def test_main_posts_summary_when_no_output_file_exists(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            metadata = tmp / "metadata.json"
            metadata.write_text(json.dumps({"review_exit_code": 0}), encoding="utf-8")

            with mock.patch.object(module, "post_summary", return_value=True) as post_summary:
                rc = module.main(
                    [
                        "--review-output",
                        str(tmp / "missing.json"),
                        "--existing-comments",
                        str(tmp / "existing.json"),
                        "--metadata",
                        str(metadata),
                    ]
                )

        self.assertEqual(rc, 0)
        post_summary.assert_called_once()

    def test_main_posts_summary_when_all_findings_are_deduplicated(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            review_output = tmp / "review-output.json"
            existing_comments = tmp / "existing.json"
            metadata = tmp / "metadata.json"

            review_output.write_text(
                '[{"path":"a.py","line":1,"body":"same"}]',
                encoding="utf-8",
            )
            existing_comments.write_text(
                json.dumps([{"id": 1, "user": "github-actions[bot]", "body": "same"}]),
                encoding="utf-8",
            )
            metadata.write_text(json.dumps({"review_exit_code": 0}), encoding="utf-8")

            with mock.patch.object(module, "post_summary", return_value=True) as post_summary:
                with mock.patch.dict(
                    module.os.environ,
                    {"REPO": "owner/repo", "PR_NUMBER": "12", "COMMIT_SHA": "abcdef1"},
                    clear=False,
                ):
                    rc = module.main(
                        [
                            "--review-output",
                            str(review_output),
                            "--existing-comments",
                            str(existing_comments),
                            "--metadata",
                            str(metadata),
                        ]
                    )

        self.assertEqual(rc, 0)
        post_summary.assert_called_once()

    def test_main_returns_non_zero_when_summary_comment_cannot_be_posted(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            metadata = tmp / "metadata.json"
            metadata.write_text(json.dumps({"review_exit_code": 124}), encoding="utf-8")

            with mock.patch.object(module, "post_summary", return_value=False):
                rc = module.main(
                    [
                        "--review-output",
                        str(tmp / "missing.json"),
                        "--existing-comments",
                        str(tmp / "existing.json"),
                        "--metadata",
                        str(metadata),
                    ]
                )

        self.assertEqual(rc, 1)


if __name__ == "__main__":
    unittest.main()
