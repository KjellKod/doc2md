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
# APPLE_*, SPARKLE_*, MACOS_*, and NOTARIZE_* are intentionally broad
# secret-family matches so CI guardrails cover newly added release credentials.
NPM_SECRET_TOKEN_RE = re.compile(
    r"(?<![A-Za-z0-9_])"
    r"(?:OPENAI_API_KEY|APPLE_[A-Z0-9_]+|SPARKLE_[A-Z0-9_]+|"
    r"MACOS_[A-Z0-9_]+|NOTARIZE_[A-Z0-9_]+)"
    r"(?![A-Za-z0-9_])"
)
RELEASE_SIGNING_SECRET_RE = re.compile(
    r"(?<![A-Za-z0-9_])(?:APPLE_[A-Z0-9_]+|SPARKLE_[A-Z0-9_]+)(?![A-Za-z0-9_])"
)
NPM_CACHE_RE = re.compile(r"^\s*cache:\s*['\"]?(?:npm|yarn|pnpm)['\"]?\s*(?:#.*)?$")
CONTENTS_WRITE_RE = re.compile(r"^\s*contents:\s*write\s*(?:#.*)?$", re.MULTILINE)
ID_TOKEN_WRITE_RE = re.compile(r"^\s*id-token:\s*write\s*(?:#.*)?$", re.MULTILINE)
JOB_NAME_RE = re.compile(r"^    name:\s*['\"]?(.+?)['\"]?\s*(?:#.*)?$", re.MULTILINE)
SENSITIVE_JOB_NAME_RE = re.compile(r"publish|release|sign|notariz", re.IGNORECASE)
NPM_INSTALL_RE = re.compile(r"\bnpm\s+install\b")
NPM_CI_RE = re.compile(r"\bnpm\s+ci\b")
NPM_GLOBAL_RE = re.compile(r"(?<!\S)(?:-g|--global)(?!\S)")
IGNORE_SCRIPTS_FALSE_RE = re.compile(r"--ignore-scripts=false(?:\s|$)")
IGNORE_SCRIPTS_RE = re.compile(r"(?<!\S)--ignore-scripts(?!\S)")
ID_TOKEN_WRITE_ALLOWLIST = {
    ("deploy-pages.yml", "deploy"),
}
# Detect repo-content fetches pinned to PR HEAD (via $HEAD_SHA shell var or
# ${{ github.event.pull_request.head.sha }} expansion). Secret-bearing PR
# workflows must use the base checkout, not pull PR HEAD content at runtime.
HEAD_SHA_REF_RE = re.compile(
    r"\?ref=(?:\$HEAD_SHA"
    r"|\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\})"
)
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


def strip_yaml_comments(line: str) -> str:
    return line.split("#", 1)[0]


def references_npm_sensitive_secret(job_text: str) -> bool:
    return any(
        NPM_SECRET_TOKEN_RE.search(strip_yaml_comments(line))
        for line in job_text.splitlines()
    )


def references_release_signing_secret(job_text: str) -> bool:
    return any(
        RELEASE_SIGNING_SECRET_RE.search(strip_yaml_comments(line))
        for line in job_text.splitlines()
    )


def has_ignore_scripts(line: str) -> bool:
    if IGNORE_SCRIPTS_FALSE_RE.search(line):
        return False
    return IGNORE_SCRIPTS_RE.search(line) is not None


def is_global_npm_install(line: str) -> bool:
    line_without_comments = strip_yaml_comments(line)
    return NPM_INSTALL_RE.search(line_without_comments) is not None and (
        NPM_GLOBAL_RE.search(line_without_comments) is not None
    )


def is_local_npm_install(line: str) -> bool:
    line_without_comments = strip_yaml_comments(line)
    if NPM_CI_RE.search(line_without_comments):
        return True
    return (
        NPM_INSTALL_RE.search(line_without_comments) is not None
        and not is_global_npm_install(line_without_comments)
    )


def job_display_name(job_text: str) -> str | None:
    match = JOB_NAME_RE.search(job_text)
    return match.group(1).strip() if match else None


def sensitive_job_name(job_key: str, job_text: str) -> bool:
    return SENSITIVE_JOB_NAME_RE.search(job_display_name(job_text) or job_key) is not None


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


def has_regex_like_release_tag_filter(text: str) -> bool:
    in_tags = False
    tag_indent = 0

    for line in text.splitlines():
        content = line.split("#", 1)[0]
        stripped = content.strip()
        if not stripped or stripped.startswith("#"):
            continue

        indent = len(content) - len(content.lstrip())
        if in_tags:
            if indent <= tag_indent and not stripped.startswith("-"):
                in_tags = False
            elif "+" in content:
                return True

        if stripped.startswith("tags:"):
            if "+" in content:
                return True
            in_tags = True
            tag_indent = indent

    return False


def release_secret_failures(path: Path, text: str) -> list[str]:
    failures: list[str] = []

    if path.name == "release-mac.yml" and has_regex_like_release_tag_filter(text):
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

        if references_apple and references_sparkle:
            failures.append(
                f"{path}: job {job_name} must not reference both Apple and Sparkle secrets."
            )

    return failures


def workflow_level_text(text: str) -> str:
    before_jobs, _separator, _after_jobs = text.partition("\njobs:")
    return before_jobs


def supply_chain_failures(path: Path, text: str) -> list[str]:
    failures: list[str] = []

    if ID_TOKEN_WRITE_RE.search(workflow_level_text(text)):
        failures.append(
            f"{path}: Rule 4 id-token: write is only allowed for approved deployment jobs."
        )

    for job_name, job_text in workflow_jobs(text).items():
        privileged_release_job = (
            references_release_signing_secret(job_text)
            or CONTENTS_WRITE_RE.search(job_text) is not None
            or sensitive_job_name(job_name, job_text)
        )

        if privileged_release_job:
            for line in job_text.splitlines():
                if NPM_CACHE_RE.match(line):
                    failures.append(
                        f"{path}: Rule 1 job {job_name} must not use npm/yarn/pnpm cache in privileged release jobs."
                    )

        if references_npm_sensitive_secret(job_text):
            for line in job_text.splitlines():
                line_without_comments = strip_yaml_comments(line)
                if is_global_npm_install(line_without_comments):
                    if not has_ignore_scripts(line_without_comments):
                        failures.append(
                            f"{path}: Rule 2 job {job_name} global npm installs must use --ignore-scripts."
                        )
                    continue
                if is_local_npm_install(line_without_comments) and not has_ignore_scripts(
                    line_without_comments
                ):
                    failures.append(
                        f"{path}: Rule 3 job {job_name} npm installs must use --ignore-scripts."
                    )

        if (
            ID_TOKEN_WRITE_RE.search(job_text)
            and (path.name, job_name) not in ID_TOKEN_WRITE_ALLOWLIST
        ):
            failures.append(
                f"{path}: Rule 4 job {job_name} id-token: write is not allowlisted."
            )

    return failures


def scan_workflow(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    failures: list[str] = []

    if uses_pull_request_target(text):
        failures.append(f"{path}: pull_request_target is banned in this repository.")

    failures.extend(release_secret_failures(path, text))
    failures.extend(supply_chain_failures(path, text))

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

    if HEAD_SHA_REF_RE.search(text):
        failures.append(
            f"{path}: secret-bearing PR workflow must not fetch repo content from PR HEAD "
            f"(?ref=$HEAD_SHA / ?ref=${{{{ github.event.pull_request.head.sha }}}}). "
            f"Use the base checkout instead."
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
