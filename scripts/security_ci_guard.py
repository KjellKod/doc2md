#!/usr/bin/env python3

from __future__ import annotations

import re
from pathlib import Path


WORKFLOW_DIR = Path(".github/workflows")
TRUSTED_AUTHOR_SNIPPETS = {
    "github.event.pull_request.user.login == 'KjellKod'",
    'github.event.pull_request.user.login == "KjellKod"',
}
SAME_REPO_SNIPPET = "github.event.pull_request.head.repo.full_name == github.repository"
BASE_SHA_SNIPPET = "ref: ${{ github.event.pull_request.base.sha }}"
SECRET_BEARING_SNIPPETS = (
    "OPENAI_API_KEY",
    "secrets.OPENAI_API_KEY",
    "pull-requests: write",
    "issues: write",
)
BROAD_WRITE_SNIPPETS = (
    "contents: write",
    "actions: write",
    "packages: write",
    "deployments: write",
    "attestations: write",
    "checks: write",
)
APPLE_SECRET_RE = re.compile(r"secrets\.APPLE_[A-Z0-9_]+")
SPARKLE_SECRET_RE = re.compile(r"secrets\.SPARKLE_[A-Z0-9_]+")
PINNED_ACTION_RE = re.compile(r"actions/checkout@[0-9a-f]{40}\b")
CHECKOUT_ACTION_RE = re.compile(r"actions/checkout@([^\s#]+)")
JOB_HEADER_RE = re.compile(r"^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$")
JOB_ENVIRONMENT_RE = re.compile(r"^    environment\s*:", re.MULTILINE)
SECRET_MATERIAL_MARKERS = (
    "-----BEGIN " + "PRIVATE KEY-----",
    "-----BEGIN " + "ENCRYPTED PRIVATE KEY-----",
    "-----BEGIN " + "EC PRIVATE KEY-----",
)
SECRET_SCAN_EXCLUDED_PARTS = {
    ".git",
    ".build",
    ".quest",
    "node_modules",
    "__pycache__",
    "dist",
}
SECRET_SCAN_ALLOWED_PREFIXES = (
    Path("apps/macos/doc2mdTests/Fixtures"),
)


def uses_pull_request_event(text: str) -> bool:
    return "pull_request:" in text


def uses_pull_request_target(text: str) -> bool:
    return "pull_request_target:" in text


def uses_checkout(text: str) -> bool:
    return "actions/checkout@" in text


def uses_apple_secret(text: str) -> bool:
    return APPLE_SECRET_RE.search(text) is not None


def uses_sparkle_secret(text: str) -> bool:
    return SPARKLE_SECRET_RE.search(text) is not None


def is_secret_bearing(text: str) -> bool:
    return any(snippet in text for snippet in SECRET_BEARING_SNIPPETS)


def has_trusted_author_gate(text: str) -> bool:
    return any(snippet in text for snippet in TRUSTED_AUTHOR_SNIPPETS)


def workflow_jobs(text: str) -> dict[str, str]:
    lines = text.splitlines(keepends=True)
    jobs: dict[str, str] = {}
    in_jobs = False
    current_name: str | None = None
    current_lines: list[str] = []

    for line in lines:
        if not in_jobs:
            if line.strip() == "jobs:":
                in_jobs = True
            continue

        match = JOB_HEADER_RE.match(line)
        if match:
            if current_name is not None:
                jobs[current_name] = "".join(current_lines)
            current_name = match.group(1)
            current_lines = [line]
            continue

        if current_name is not None:
            current_lines.append(line)

    if current_name is not None:
        jobs[current_name] = "".join(current_lines)

    return jobs


def release_secret_failures(path: Path, text: str) -> list[str]:
    failures: list[str] = []

    if path.name == "release-mac.yml" and any(
        "tags:" in line and "+" in line for line in text.splitlines()
    ):
        failures.append(
            f"{path}: release tag filters are GitHub globs, not regular expressions; use v*.*.* plus shell validation."
        )

    for job_name, job_text in workflow_jobs(text).items():
        references_apple = uses_apple_secret(job_text)
        references_sparkle = uses_sparkle_secret(job_text)

        if references_apple or references_sparkle:
            if JOB_ENVIRONMENT_RE.search(job_text) is None:
                failures.append(
                    f"{path}: job {job_name} references Apple/Sparkle secrets without an environment gate."
                )

            for checkout_ref in CHECKOUT_ACTION_RE.findall(job_text):
                if not PINNED_ACTION_RE.search(f"actions/checkout@{checkout_ref}"):
                    failures.append(
                        f"{path}: job {job_name} checks out code with unpinned actions/checkout@{checkout_ref} while referencing release secrets."
                    )

        if references_apple and references_sparkle:
            failures.append(
                f"{path}: job {job_name} must not reference both Apple and Sparkle secrets."
            )

    return failures


def scan_workflow(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    failures: list[str] = []

    if uses_pull_request_target(text):
        failures.append(f"{path}: pull_request_target is banned in this repository.")

    failures.extend(release_secret_failures(path, text))

    if not uses_pull_request_event(text):
        return failures

    if uses_apple_secret(text) or uses_sparkle_secret(text):
        failures.append(
            f"{path}: PR workflows must not reference Apple or Sparkle release secrets."
        )

    if any(snippet in text for snippet in BROAD_WRITE_SNIPPETS):
        failures.append(f"{path}: PR workflow requests overly broad write permissions.")

    if not is_secret_bearing(text):
        return failures

    if "permissions:" not in text:
        failures.append(
            f"{path}: secret-bearing PR workflow must declare explicit permissions."
        )
    if "environment:" not in text:
        failures.append(
            f"{path}: secret-bearing PR workflow must use an environment gate."
        )
    if not has_trusted_author_gate(text):
        failures.append(
            f"{path}: secret-bearing PR workflow must gate execution to KjellKod."
        )
    if SAME_REPO_SNIPPET not in text:
        failures.append(
            f"{path}: secret-bearing PR workflow must require same-repo PRs."
        )
    if uses_checkout(text) and BASE_SHA_SNIPPET not in text:
        failures.append(
            f"{path}: secret-bearing PR workflow must checkout the trusted base SHA, not PR head code."
        )

    return failures


def is_secret_scan_allowed(path: Path) -> bool:
    normalized = Path(*path.parts)
    if any(part in SECRET_SCAN_EXCLUDED_PARTS for part in normalized.parts):
        return True
    return any(
        normalized == prefix or prefix in normalized.parents
        for prefix in SECRET_SCAN_ALLOWED_PREFIXES
    )


def scan_repo_for_secret_material(root: Path = Path(".")) -> list[str]:
    failures: list[str] = []

    for path in sorted(root.rglob("*")):
        if not path.is_file() or is_secret_scan_allowed(path.relative_to(root)):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for marker in SECRET_MATERIAL_MARKERS:
            if marker in text:
                failures.append(f"{path}: possible committed private key material.")
                break

    return failures


def main() -> int:
    failures: list[str] = []
    for path in sorted(WORKFLOW_DIR.glob("*.y*ml")):
        failures.extend(scan_workflow(path))
    failures.extend(scan_repo_for_secret_material())

    if not failures:
        print("workflow security guard passed")
        return 0

    print("workflow security guard failed:")
    for failure in failures:
        print(f"- {failure}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
