#!/usr/bin/env python3
"""Post Codex CI review findings and always leave a visible summary comment."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Parse Codex review output, post inline comments, and add a summary comment."
    )
    parser.add_argument(
        "--review-output",
        default="/tmp/codex-review/review-output.json",
        help="Path to the Codex output file.",
    )
    parser.add_argument(
        "--existing-comments",
        default="/tmp/codex-review/existing_comments.json",
        help="Path to existing PR review comments JSON.",
    )
    parser.add_argument(
        "--metadata",
        default="/tmp/codex-review/review-metadata.json",
        help="Path to review metadata JSON.",
    )
    parser.add_argument(
        "--strict-inline-posting",
        action="store_true",
        help="Return a non-zero exit code if any inline comment cannot be posted.",
    )
    parser.add_argument(
        "--skip-reason",
        default="",
        help="Optional reason explaining why the review was skipped before Codex ran.",
    )
    return parser.parse_args(argv)


def parse_review_output(raw: str) -> list[dict[str, object]] | None:
    attempts = [raw]
    stripped_fences = re.sub(r"```[\w-]*\n?", "", raw)
    attempts.append(stripped_fences.strip())

    for candidate in attempts:
        try:
            parsed = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(parsed, list):
            return parsed

    for fence_match in re.finditer(r"```(?:json)?\s*\n(.*?)```", raw, re.DOTALL):
        try:
            parsed = json.loads(fence_match.group(1))
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(parsed, list):
            return parsed

    for match in re.finditer(r"\[[\s\S]*\]", stripped_fences):
        try:
            parsed = json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(parsed, list):
            return parsed

    return None


def validate_comments(comments: list[object]) -> list[dict[str, object]]:
    valid: list[dict[str, object]] = []
    for comment in comments:
        if not isinstance(comment, dict):
            continue
        path = comment.get("path")
        body = comment.get("body")
        if not isinstance(path, str) or not path.strip():
            continue
        if not isinstance(body, str) or not body.strip():
            continue
        try:
            line = int(comment.get("line"))
        except (TypeError, ValueError):
            continue
        if line < 1:
            continue
        side = comment.get("side")
        valid.append(
            {
                "path": path,
                "line": line,
                "side": side if side in {"LEFT", "RIGHT"} else "RIGHT",
                "body": body,
            }
        )
    return valid


def deduplicate(
    comments: list[dict[str, object]],
    existing: list[object],
) -> list[dict[str, object]]:
    bot_bodies = {
        item["body"].strip()
        for item in existing
        if isinstance(item, dict)
        and item.get("user") == "github-actions[bot]"
        and isinstance(item.get("body"), str)
    }
    replied_ids = {
        item.get("in_reply_to_id")
        for item in existing
        if isinstance(item, dict) and item.get("in_reply_to_id")
    }
    resolved_bot_ids = {
        item["id"]
        for item in existing
        if isinstance(item, dict)
        and item.get("user") == "github-actions[bot]"
        and item.get("id") in replied_ids
    }
    resolved_bot_bodies = {
        item["body"].strip()
        for item in existing
        if isinstance(item, dict)
        and item.get("user") == "github-actions[bot]"
        and item.get("id") in resolved_bot_ids
        and isinstance(item.get("body"), str)
    }

    filtered: list[dict[str, object]] = []
    for comment in comments:
        body = str(comment["body"]).strip()
        if body in bot_bodies or body in resolved_bot_bodies:
            continue
        filtered.append(comment)
    return filtered


def load_json_file(path: str, default: object) -> object:
    file_path = Path(path)
    if not file_path.exists():
        return default
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, ValueError):
        return default


def build_diff_details(metadata: dict[str, object]) -> str:
    original = metadata.get("original_diff_bytes")
    reviewed = metadata.get("review_diff_bytes")
    max_diff = metadata.get("max_diff_bytes")
    if isinstance(original, int) and metadata.get("diff_truncated"):
        visible = max_diff if isinstance(max_diff, int) else reviewed
        if isinstance(visible, int):
            return f"Diff: {original} bytes total; reviewed first {visible} bytes (truncated)."
    if isinstance(reviewed, int):
        return f"Diff: {reviewed} bytes."
    return "Diff size unavailable."


def build_response_details(
    metadata: dict[str, object],
    *,
    valid_json: bool | None = None,
    findings_count: int | None = None,
) -> str:
    parts: list[str] = []
    review_exit_code = metadata.get("review_exit_code")
    output_bytes = metadata.get("review_output_bytes")

    if valid_json is True:
        if isinstance(findings_count, int):
            noun = "finding" if findings_count == 1 else "findings"
            parts.append(
                f"Response: Codex returned a valid JSON array with {findings_count} {noun}."
            )
        else:
            parts.append("Response: Codex returned a valid JSON array.")
    elif valid_json is False:
        parts.append("Response: Codex did not return a valid JSON array.")
    elif isinstance(review_exit_code, int):
        parts.append(f"Response: Codex exited with code {review_exit_code}.")

    if isinstance(output_bytes, int):
        parts.append(f"Output: {output_bytes} bytes.")

    return " ".join(parts)


def post_summary(
    message: str,
    metadata: dict[str, object],
    *,
    valid_json: bool | None = None,
    findings_count: int | None = None,
    runner=subprocess.run,
    env: dict[str, str] | None = None,
) -> bool:
    env_values = env or os.environ
    commit_sha = env_values.get("COMMIT_SHA", "")
    response_details = build_response_details(
        metadata,
        valid_json=valid_json,
        findings_count=findings_count,
    )
    lines = [
        "## Codex Review Summary",
        "",
        f"Commit: `{commit_sha[:7]}`" if commit_sha else "Commit: unavailable",
        build_diff_details(metadata),
    ]
    if response_details:
        lines.extend(["", response_details])
    lines.extend(["", message])
    result = runner(
        [
            "gh",
            "pr",
            "comment",
            env_values["PR_NUMBER"],
            "--repo",
            env_values["REPO"],
            "--body",
            "\n".join(lines),
        ],
        text=True,
        check=False,
    )
    return result.returncode == 0


def post_inline(
    comments: list[dict[str, object]],
    repo: str,
    pr_number: str,
    commit_sha: str,
    runner=subprocess.run,
) -> list[dict[str, object]]:
    failed: list[dict[str, object]] = []
    for comment in comments:
        payload = {
            "body": comment["body"],
            "commit_id": commit_sha,
            "path": comment["path"],
            "line": comment["line"],
            "side": comment["side"],
        }
        result = runner(
            [
                "gh",
                "api",
                f"repos/{repo}/pulls/{pr_number}/comments",
                "--method",
                "POST",
                "--input",
                "-",
            ],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            failed.append(comment)
    return failed


def post_fallback_comment(
    failed_comments: list[dict[str, object]],
    runner=subprocess.run,
    env: dict[str, str] | None = None,
) -> bool:
    env_values = env or os.environ
    body_parts = ["## Codex Review (inline posting failed)", ""]
    for comment in failed_comments:
        body_parts.append(f"**{comment['path']}:{comment['line']}**")
        body_parts.append(str(comment["body"]))
        body_parts.append("")
    result = runner(
        [
            "gh",
            "pr",
            "comment",
            env_values["PR_NUMBER"],
            "--repo",
            env_values["REPO"],
            "--body",
            "\n".join(body_parts).rstrip(),
        ],
        text=True,
        check=False,
    )
    return result.returncode == 0


def fail_visible_outcome(message: str) -> int:
    print(f"::error::{message}")
    return 1


def require_summary_posted(posted: bool, context: str) -> int:
    if posted:
        return 0
    return fail_visible_outcome(f"Failed to post summary comment for {context}.")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    env = os.environ
    metadata = load_json_file(args.metadata, {})
    if not isinstance(metadata, dict):
        metadata = {}

    if args.skip_reason.strip():
        return require_summary_posted(
            post_summary(
                f"Review skipped before execution. {args.skip_reason.strip()}",
                metadata,
            ),
            "skipped review outcome",
        )

    review_exit_code = metadata.get("review_exit_code")
    timeout_seconds = metadata.get("review_timeout_seconds", 300)

    if review_exit_code == 124:
        return require_summary_posted(
            post_summary(
                f"Review timed out after {timeout_seconds}s. No findings were posted.",
                metadata,
            ),
            "timeout outcome",
        )

    if isinstance(review_exit_code, int) and review_exit_code not in {0, 124}:
        return require_summary_posted(
            post_summary(
                f"Review failed (exit code {review_exit_code}). No findings were posted.",
                metadata,
            ),
            "error outcome",
        )

    output_path = Path(args.review_output)
    if not output_path.exists() or not output_path.read_text(encoding="utf-8").strip():
        return require_summary_posted(
            post_summary(
                "Review produced no output file. No findings were posted.",
                metadata,
            ),
            "missing output outcome",
        )

    raw = output_path.read_text(encoding="utf-8")
    comments = parse_review_output(raw)
    if comments is None:
        return require_summary_posted(
            post_summary(
                "Review ran, but the response was not a parseable JSON comment array.",
                metadata,
                valid_json=False,
            ),
            "unparseable output outcome",
        )

    if not comments:
        return require_summary_posted(
            post_summary(
                "Review ran, no findings.",
                metadata,
                valid_json=True,
                findings_count=0,
            ),
            "empty findings outcome",
        )

    valid_comments = validate_comments(comments)
    if not valid_comments:
        return require_summary_posted(
            post_summary(
                "Review ran, but none of the returned items were valid inline review comments.",
                metadata,
                valid_json=True,
                findings_count=len(comments),
            ),
            "invalid findings outcome",
        )

    existing_comments = load_json_file(args.existing_comments, [])
    if not isinstance(existing_comments, list):
        existing_comments = []
    fresh_comments = deduplicate(valid_comments, existing_comments)
    if not fresh_comments:
        return require_summary_posted(
            post_summary(
                "Review ran, but every finding matched an existing bot comment or resolved thread.",
                metadata,
                valid_json=True,
                findings_count=len(valid_comments),
            ),
            "deduplicated findings outcome",
        )

    failed_inline = post_inline(
        fresh_comments,
        repo=env["REPO"],
        pr_number=env["PR_NUMBER"],
        commit_sha=env["COMMIT_SHA"],
    )
    if failed_inline:
        fallback_posted = post_fallback_comment(failed_inline)
        if fallback_posted:
            summary_message = (
                f"Posted {len(fresh_comments) - len(failed_inline)} inline finding(s); "
                f"{len(failed_inline)} finding(s) fell back to a PR comment."
            )
        else:
            summary_message = (
                f"Posted {len(fresh_comments) - len(failed_inline)} inline finding(s); "
                f"{len(failed_inline)} finding(s) could not be posted inline or as a fallback comment."
            )
        summary_posted = post_summary(
            summary_message,
            metadata,
            valid_json=True,
            findings_count=len(valid_comments),
        )
        if not fallback_posted and not summary_posted:
            return fail_visible_outcome(
                "Failed to post any visible review outcome after inline comment failures."
            )
        if not fallback_posted:
            return fail_visible_outcome(
                "Failed to post fallback PR comment for inline comment failures."
            )
        if not summary_posted:
            return fail_visible_outcome(
                "Failed to post summary comment after inline comment failures."
            )
        return 1 if args.strict_inline_posting else 0

    return require_summary_posted(
        post_summary(
            f"Posted {len(fresh_comments)} inline finding(s).",
            metadata,
            valid_json=True,
            findings_count=len(valid_comments),
        ),
        "successful review outcome",
    )


if __name__ == "__main__":
    raise SystemExit(main())
