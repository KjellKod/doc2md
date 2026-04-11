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
    maxDiff = None

    def test_load_diff_ranges_returns_normalized_ranges(self):
        module = load_module()

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "diff_ranges.json"
            path.write_text(
                json.dumps(
                    {
                        "src/app.py": {
                            "LEFT": [[3, 4]],
                            "RIGHT": [[10, 12], [20, 20]],
                        },
                        "ignored.py": [["x", 2]],
                    }
                ),
                encoding="utf-8",
            )

            diff_ranges = module.load_diff_ranges(str(path))

        self.assertEqual(
            diff_ranges,
            {"src/app.py": {"LEFT": [(3, 4)], "RIGHT": [(10, 12), (20, 20)]}},
        )

    def test_load_diff_ranges_accepts_legacy_right_side_shape(self):
        module = load_module()

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "diff_ranges.json"
            path.write_text(json.dumps({"src/app.py": [[10, 12]]}), encoding="utf-8")

            diff_ranges = module.load_diff_ranges(str(path))

        self.assertEqual(diff_ranges, {"src/app.py": {"RIGHT": [(10, 12)]}})

    def test_validate_line_in_diff_range_accepts_valid(self):
        module = load_module()

        self.assertTrue(
            module.validate_line_in_diff_range(
                {"path": "src/app.py", "line": 10, "side": "RIGHT"},
                {"src/app.py": {"RIGHT": [(10, 12)]}},
            )
        )
        self.assertTrue(
            module.validate_line_in_diff_range(
                {"path": "src/app.py", "line": 11, "side": "RIGHT"},
                {"src/app.py": {"RIGHT": [(10, 12)]}},
            )
        )
        self.assertTrue(
            module.validate_line_in_diff_range(
                {"path": "src/app.py", "line": 12, "side": "RIGHT"},
                {"src/app.py": {"RIGHT": [(10, 12)]}},
            )
        )
        self.assertTrue(
            module.validate_line_in_diff_range(
                {"path": "src/app.py", "line": 5, "side": "LEFT"},
                {"src/app.py": {"LEFT": [(5, 6)]}},
            )
        )

    def test_validate_line_in_diff_range_rejects_out_of_range(self):
        module = load_module()

        self.assertFalse(
            module.validate_line_in_diff_range(
                {"path": "src/app.py", "line": 13, "side": "RIGHT"},
                {"src/app.py": {"RIGHT": [(10, 12)]}},
            )
        )
        self.assertFalse(
            module.validate_line_in_diff_range(
                {"path": "missing.py", "line": 11, "side": "RIGHT"},
                {"src/app.py": {"RIGHT": [(10, 12)]}},
            )
        )
        self.assertFalse(
            module.validate_line_in_diff_range(
                {"path": "src/app.py", "line": 5, "side": "LEFT"},
                {"src/app.py": {"RIGHT": [(5, 6)]}},
            )
        )

    def test_build_diff_details_reports_truncation_and_exclusions(self):
        module = load_module()

        details = module.build_diff_details(
            {
                "original_diff_bytes": 120,
                "review_diff_bytes": 90,
                "diff_truncated": True,
                "excluded_files_count": 2,
            }
        )

        self.assertEqual(
            details,
            "Diff: 120 bytes total; reviewed 90 bytes after truncation. Excluded files: 2 files.",
        )

    def test_build_diff_details_reports_non_truncated_diff(self):
        module = load_module()

        details = module.build_diff_details({"review_diff_bytes": 90, "excluded_files_count": 1})

        self.assertEqual(details, "Diff: 90 bytes reviewed; not truncated. Excluded files: 1 file.")

    def test_build_response_details_reports_valid_json_with_findings(self):
        module = load_module()

        details = module.build_response_details(
            {"review_output_bytes": 42},
            valid_json=True,
            findings_count=1,
        )

        self.assertEqual(
            details,
            "Response: Codex returned a valid JSON array with 1 finding. Output: 42 bytes.",
        )

    def test_build_response_details_reports_valid_json_without_count(self):
        module = load_module()

        details = module.build_response_details({"review_output_bytes": 42}, valid_json=True)

        self.assertEqual(
            details,
            "Response: Codex returned a valid JSON array. Output: 42 bytes.",
        )

    def test_build_response_details_reports_invalid_json(self):
        module = load_module()

        details = module.build_response_details(
            {"review_exit_code": 0, "review_output_bytes": 42},
            valid_json=False,
        )

        self.assertEqual(
            details,
            "Response: Codex did not return a valid JSON array. Output: 42 bytes.",
        )

    def test_build_response_details_reports_exit_code_when_json_state_unknown(self):
        module = load_module()

        details = module.build_response_details(
            {"review_exit_code": 17, "review_output_bytes": 0},
        )

        self.assertEqual(details, "Response: Codex exited with code 17. Output: 0 bytes.")

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
                {
                    "path": "a.py",
                    "line": 1,
                    "side": "RIGHT",
                    "severity": "low",
                    "body": "first",
                },
                {
                    "path": "b.py",
                    "line": 2,
                    "side": "RIGHT",
                    "severity": "high",
                    "body": "second",
                },
            ],
            repo="owner/repo",
            pr_number="12",
            commit_sha="abcdef1",
            runner=runner,
        )

        self.assertEqual(
            failed,
            [
                {
                    "path": "b.py",
                    "line": 2,
                    "side": "RIGHT",
                    "severity": "high",
                    "body": "second",
                }
            ],
        )
        first_payload = json.loads(runner.call_args_list[0].kwargs["input"])
        self.assertEqual(first_payload["body"], "**[low]** first")

    def test_post_fallback_comment_returns_true_on_success(self):
        module = load_module()
        runner = mock.Mock(return_value=mock.Mock(returncode=0))

        posted = module.post_fallback_comment(
            [{"path": "b.py", "line": 2, "side": "RIGHT", "severity": "high", "body": "second"}],
            runner=runner,
            env={"PR_NUMBER": "12", "REPO": "owner/repo"},
        )

        self.assertTrue(posted)
        runner.assert_called_once()
        fallback_body = runner.call_args.args[0][-1]
        self.assertIn("<!-- codex-review-fallback -->", fallback_body)
        self.assertIn("**[high]** second", fallback_body)

    def test_parse_valid_json_array(self):
        module = load_module()

        comments = module.parse_review_output(
            '[{"path":"a.py","line":1,"side":"RIGHT","severity":"medium","body":"x"}]'
        )

        self.assertEqual(len(comments), 1)

    def test_parse_fenced_json(self):
        module = load_module()

        comments = module.parse_review_output(
            '```json\n[{"path":"a.py","line":1,"side":"RIGHT","severity":"medium","body":"x"}]\n```'
        )

        self.assertEqual(len(comments), 1)

    def test_parse_no_json_returns_none(self):
        module = load_module()

        comments = module.parse_review_output("not json")

        self.assertIsNone(comments)

    def test_format_body_prefixes_severity(self):
        module = load_module()

        formatted = module._format_body({"severity": "critical", "body": "original body"})

        self.assertEqual(formatted, "**[critical]** original body")

    def test_format_body_praise_prefix(self):
        module = load_module()

        formatted = module._format_body({"severity": "praise", "body": "nice catch"})

        self.assertEqual(formatted, "**[praise]** nice catch")

    def test_validate_comments_extracts_severity(self):
        module = load_module()

        with mock.patch("builtins.print") as mocked_print:
            comments = module.validate_comments(
                [
                    {
                        "path": "a.py",
                        "line": "2",
                        "side": "LEFT",
                        "severity": "HIGH",
                        "body": "first",
                    },
                    {"path": "b.py", "line": 3, "body": "second"},
                ]
            )

        self.assertEqual(
            comments,
            [
                {
                    "path": "a.py",
                    "line": 2,
                    "side": "LEFT",
                    "severity": "high",
                    "body": "first",
                },
                {
                    "path": "b.py",
                    "line": 3,
                    "side": "RIGHT",
                    "severity": "medium",
                    "body": "second",
                },
            ],
        )
        mocked_print.assert_called_once_with("::notice::Missing severity defaulted to medium.")

    def test_validate_comments_defaults_unknown_severity(self):
        module = load_module()

        with mock.patch("builtins.print") as mocked_print:
            comments = module.validate_comments(
                [{"path": "a.py", "line": 2, "severity": "urgent", "body": "bad"}]
            )

        self.assertEqual(
            comments,
            [
                {
                    "path": "a.py",
                    "line": 2,
                    "side": "RIGHT",
                    "severity": "medium",
                    "body": "bad",
                }
            ],
        )
        mocked_print.assert_called_once_with("::notice::Unknown severity 'urgent' defaulted to medium.")

    def test_jaccard_similarity_identical(self):
        module = load_module()

        similarity = module._jaccard_similarity("missing config returns error", "missing config returns error")

        self.assertEqual(similarity, 1.0)

    def test_jaccard_similarity_disjoint(self):
        module = load_module()

        similarity = module._jaccard_similarity("missing config returns error", "render button label text")

        self.assertEqual(similarity, 0.0)

    def test_jaccard_similarity_partial(self):
        module = load_module()

        similarity = module._jaccard_similarity(
            "missing config returns explicit error",
            "missing config should return error",
        )

        self.assertGreater(similarity, 0.0)
        self.assertLess(similarity, 1.0)

    def test_deduplicate_jaccard_same_path(self):
        module = load_module()
        comments = [
            {
                "path": "a.py",
                "line": 1,
                "side": "RIGHT",
                "severity": "high",
                "body": "Return explicit error when config is missing",
            }
        ]
        existing = [
            {
                "id": 1,
                "user": "github-actions[bot]",
                "path": "a.py",
                "body": "Return an explicit error when config is missing",
            }
        ]

        filtered = module.deduplicate(comments, existing)

        self.assertEqual(filtered, [])

    def test_deduplicate_jaccard_different_path_not_suppressed(self):
        module = load_module()
        comments = [
            {
                "path": "a.py",
                "line": 1,
                "side": "RIGHT",
                "severity": "high",
                "body": "Return explicit error when config is missing",
            }
        ]
        existing = [
            {
                "id": 1,
                "user": "github-actions[bot]",
                "path": "b.py",
                "body": "Return an explicit error when config is missing",
            }
        ]

        filtered = module.deduplicate(comments, existing)

        self.assertEqual(filtered, comments)

    def test_deduplicate_strips_boilerplate_before_comparison(self):
        module = load_module()
        comments = [
            {
                "path": "a.py",
                "line": 10,
                "side": "RIGHT",
                "severity": "medium",
                "body": "Distinct finding about error handling",
            },
            {
                "path": "a.py",
                "line": 20,
                "side": "RIGHT",
                "severity": "medium",
                "body": "Different finding about null checks",
            },
        ]
        existing = [
            {
                "id": 1,
                "user": "github-actions[bot]",
                "path": "a.py",
                "body": "**[medium]** Distinct finding about error handling\n\n*Automated review by OpenAI Codex*",
            }
        ]

        filtered = module.deduplicate(comments, existing)

        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["body"], "Different finding about null checks")

    def test_deduplicate_exact_match_different_path_not_suppressed(self):
        module = load_module()
        comments = [
            {
                "path": "a.py",
                "line": 1,
                "side": "RIGHT",
                "severity": "high",
                "body": "Identical body text",
            }
        ]
        existing = [
            {
                "id": 1,
                "user": "github-actions[bot]",
                "path": "b.py",
                "body": "Identical body text",
            }
        ]

        filtered = module.deduplicate(comments, existing)

        self.assertEqual(filtered, comments)

    def test_build_severity_summary(self):
        module = load_module()

        summary = module.build_severity_summary(
            [
                {"severity": "critical"},
                {"severity": "medium"},
                {"severity": "medium"},
                {"severity": "praise"},
            ]
        )

        self.assertEqual(summary, "Findings: 1 critical, 2 medium, 1 praise.")

    def test_emit_annotations_levels(self):
        module = load_module()

        comments = [
            {"path": "a.py", "line": 1, "severity": "critical", "body": "critical body"},
            {"path": "b.py", "line": 2, "severity": "high", "body": "high body"},
            {"path": "c.py", "line": 3, "severity": "medium", "body": "medium body"},
            {"path": "d.py", "line": 4, "severity": "low", "body": "low body"},
            {"path": "e.py", "line": 5, "severity": "praise", "body": "praise body"},
        ]

        with mock.patch("builtins.print") as mocked_print:
            module.emit_annotations(comments)

        printed = [call.args[0] for call in mocked_print.call_args_list]
        self.assertEqual(
            printed,
            [
                "::error file=a.py,line=1::critical body",
                "::error file=b.py,line=2::high body",
                "::warning file=c.py,line=3::medium body",
                "::notice file=d.py,line=4::low body",
                "::notice file=e.py,line=5::praise body",
            ],
        )

    def test_emit_annotations_escapes_injection(self):
        module = load_module()

        comments = [
            {"path": "src/foo:bar.py", "line": 1, "severity": "high",
             "body": "bad%0Ainjection::warning file=x,line=1::pwned"},
        ]

        with mock.patch("builtins.print") as mocked_print:
            module.emit_annotations(comments)

        printed = mocked_print.call_args_list[0].args[0]
        self.assertNotIn("::warning file=x", printed)
        self.assertIn("%3A", printed)
        # %0A in input becomes %250A (% escaped first), which is correct
        self.assertIn("%250A", printed)

    def test_emit_dropped_comment_notices_emits_notice_per_comment(self):
        module = load_module()

        with mock.patch("builtins.print") as mocked_print:
            module.emit_dropped_comment_notices(
                [
                    {"path": "src/app.py", "line": 14},
                    {"path": "src/lib.py", "line": 9},
                ]
            )

        printed = [call.args[0] for call in mocked_print.call_args_list]
        self.assertEqual(
            printed,
            [
                "::notice file=src/app.py,line=14::Dropped model comment outside changed diff lines.",
                "::notice file=src/lib.py,line=9::Dropped model comment outside changed diff lines.",
            ],
        )

    def test_main_exits_1_on_critical_finding(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            review_output = tmp / "review-output.json"
            existing_comments = tmp / "existing.json"
            metadata = tmp / "metadata.json"

            review_output.write_text(
                json.dumps(
                    [
                        {
                            "path": "a.py",
                            "line": 1,
                            "side": "RIGHT",
                            "severity": "critical",
                            "body": "critical issue",
                        }
                    ]
                ),
                encoding="utf-8",
            )
            existing_comments.write_text("[]", encoding="utf-8")
            metadata.write_text(json.dumps({"review_exit_code": 0}), encoding="utf-8")

            with mock.patch.object(module, "post_inline", return_value=[]):
                with mock.patch.object(module, "post_summary", return_value=True) as post_summary:
                    with mock.patch.object(module, "emit_annotations"):
                        with mock.patch("builtins.print") as mocked_print:
                            with mock.patch.dict(
                                module.os.environ,
                                {
                                    "REPO": "owner/repo",
                                    "PR_NUMBER": "12",
                                    "COMMIT_SHA": "abcdef1",
                                },
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

        self.assertEqual(rc, 1)
        post_summary.assert_called_once()
        self.assertIn("Findings: 1 critical.", post_summary.call_args.args[0])
        mocked_print.assert_called_once_with("::error::Blocking severity findings")

    def test_main_exits_0_on_medium_only(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            review_output = tmp / "review-output.json"
            existing_comments = tmp / "existing.json"
            metadata = tmp / "metadata.json"

            review_output.write_text(
                json.dumps(
                    [
                        {
                            "path": "a.py",
                            "line": 1,
                            "side": "RIGHT",
                            "severity": "medium",
                            "body": "advisory issue",
                        }
                    ]
                ),
                encoding="utf-8",
            )
            existing_comments.write_text("[]", encoding="utf-8")
            metadata.write_text(json.dumps({"review_exit_code": 0}), encoding="utf-8")

            with mock.patch.object(module, "post_inline", return_value=[]):
                with mock.patch.object(module, "post_summary", return_value=True) as post_summary:
                    with mock.patch.object(module, "emit_annotations"):
                        with mock.patch("builtins.print") as mocked_print:
                            with mock.patch.dict(
                                module.os.environ,
                                {
                                    "REPO": "owner/repo",
                                    "PR_NUMBER": "12",
                                    "COMMIT_SHA": "abcdef1",
                                },
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
        mocked_print.assert_not_called()

    def test_main_exits_0_on_infrastructure_failure(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            metadata = tmp / "metadata.json"
            metadata.write_text(json.dumps({"review_exit_code": 124}), encoding="utf-8")

            with mock.patch.object(module, "post_summary", return_value=False):
                with mock.patch("builtins.print") as mocked_print:
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
        mocked_print.assert_called_once_with(
            "::warning::Failed to post summary comment for timeout outcome."
        )

    def test_main_drops_out_of_range_comments_before_posting(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            review_output = tmp / "review-output.json"
            existing_comments = tmp / "existing.json"
            metadata = tmp / "metadata.json"
            diff_ranges = tmp / "diff_ranges.json"

            review_output.write_text(
                json.dumps(
                    [
                        {
                            "path": "a.py",
                            "line": 9,
                            "side": "RIGHT",
                            "severity": "medium",
                            "body": "out of range",
                        },
                        {
                            "path": "a.py",
                            "line": 2,
                            "side": "RIGHT",
                            "severity": "low",
                            "body": "in range",
                        },
                    ]
                ),
                encoding="utf-8",
            )
            existing_comments.write_text("[]", encoding="utf-8")
            metadata.write_text(json.dumps({"review_exit_code": 0}), encoding="utf-8")
            diff_ranges.write_text(
                json.dumps({"a.py": {"RIGHT": [[1, 3]]}}),
                encoding="utf-8",
            )

            with mock.patch.object(module, "post_inline", return_value=[] ) as post_inline:
                with mock.patch.object(module, "post_summary", return_value=True):
                    with mock.patch.object(module, "emit_annotations"):
                        with mock.patch("builtins.print") as mocked_print:
                            with mock.patch.dict(
                                module.os.environ,
                                {
                                    "REPO": "owner/repo",
                                    "PR_NUMBER": "12",
                                    "COMMIT_SHA": "abcdef1",
                                },
                                clear=False,
                            ):
                                rc = module.main(
                                    [
                                        "--review-output",
                                        str(review_output),
                                        "--diff-ranges",
                                        str(diff_ranges),
                                        "--existing-comments",
                                        str(existing_comments),
                                        "--metadata",
                                        str(metadata),
                                    ]
                                )

        self.assertEqual(rc, 0)
        post_inline.assert_called_once_with(
            [
                {
                    "path": "a.py",
                    "line": 2,
                    "side": "RIGHT",
                    "severity": "low",
                    "body": "in range",
                }
            ],
            repo="owner/repo",
            pr_number="12",
            commit_sha="abcdef1",
        )
        mocked_print.assert_called_once_with(
            "::notice file=a.py,line=9::Dropped model comment outside changed diff lines."
        )

    def test_main_keeps_left_side_deleted_line_comments(self):
        module = load_module()
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            review_output = tmp / "review-output.json"
            existing_comments = tmp / "existing.json"
            metadata = tmp / "metadata.json"
            diff_ranges = tmp / "diff_ranges.json"

            review_output.write_text(
                json.dumps(
                    [
                        {
                            "path": "a.py",
                            "line": 5,
                            "side": "LEFT",
                            "severity": "high",
                            "body": "deleted line finding",
                        }
                    ]
                ),
                encoding="utf-8",
            )
            existing_comments.write_text("[]", encoding="utf-8")
            metadata.write_text(json.dumps({"review_exit_code": 0}), encoding="utf-8")
            diff_ranges.write_text(
                json.dumps({"a.py": {"LEFT": [[5, 6]], "RIGHT": [[5, 5]]}}),
                encoding="utf-8",
            )

            with mock.patch.object(module, "post_inline", return_value=[]) as post_inline:
                with mock.patch.object(module, "post_summary", return_value=True):
                    with mock.patch.object(module, "emit_annotations"):
                        with mock.patch("builtins.print") as mocked_print:
                            with mock.patch.dict(
                                module.os.environ,
                                {
                                    "REPO": "owner/repo",
                                    "PR_NUMBER": "12",
                                    "COMMIT_SHA": "abcdef1",
                                },
                                clear=False,
                            ):
                                rc = module.main(
                                    [
                                        "--review-output",
                                        str(review_output),
                                        "--diff-ranges",
                                        str(diff_ranges),
                                        "--existing-comments",
                                        str(existing_comments),
                                        "--metadata",
                                        str(metadata),
                                    ]
                                )

        self.assertEqual(rc, 1)
        post_inline.assert_called_once_with(
            [
                {
                    "path": "a.py",
                    "line": 5,
                    "side": "LEFT",
                    "severity": "high",
                    "body": "deleted line finding",
                }
            ],
            repo="owner/repo",
            pr_number="12",
            commit_sha="abcdef1",
        )
        mocked_print.assert_called_once_with("::error::Blocking severity findings")

    def test_has_blocking_findings(self):
        module = load_module()

        self.assertTrue(module.has_blocking_findings([{"severity": "critical"}]))
        self.assertTrue(module.has_blocking_findings([{"severity": "high"}]))
        self.assertFalse(module.has_blocking_findings([{"severity": "medium"}]))
        self.assertFalse(module.has_blocking_findings([{"severity": "low"}]))
        self.assertFalse(module.has_blocking_findings([{"severity": "praise"}]))


if __name__ == "__main__":
    unittest.main()
