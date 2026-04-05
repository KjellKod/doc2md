#!/usr/bin/env bash
set -euo pipefail

# Compare raw PDF ingestion versus doc2md-preprocessed markdown for Claude and
# Codex. Each test case runs in its own isolated sandbox directory with only the
# PDF file copied in. The agent does the doc2md conversion (not this script).
#
# Usage: ./examples/compare-pdf-pipeline.sh [pdf-path]
# Defaults to examples/Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf
# and leaves all benchmark artifacts in temp directories printed at the end.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
DEFAULT_PDF="$SCRIPT_DIR/Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf"

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

warn() {
  printf 'Warning: %s\n' "$*" >&2
}

absolute_path() {
  local target="$1"
  local dir base
  dir="$(dirname "$target")"
  base="$(basename "$target")"
  [ -d "$dir" ] || return 1
  printf '%s/%s\n' "$(cd "$dir" && pwd -P)" "$base"
}

format_seconds() {
  local value="$1"
  if [ "$value" = "n/a" ]; then
    printf 'n/a'
    return
  fi
  printf '%ss' "$value"
}

print_row() {
  local label="$1"
  local status="$2"
  local exit_code="$3"
  local seconds="$4"
  local note="$5"
  printf '%-24s %-8s %-6s %-8s %s\n' \
    "$label" "$status" "$exit_code" \
    "$(format_seconds "$seconds")" "$note"
}

codex_supports_ephemeral() {
  codex exec --help 2>/dev/null | grep -q -- '--ephemeral'
}

codex_supports_quiet() {
  codex exec --help 2>/dev/null | grep -q -- '--quiet'
}

# ---------------------------------------------------------------------------
# Resolve PDF input
# ---------------------------------------------------------------------------
PDF_INPUT="${1:-$DEFAULT_PDF}"
PDF_PATH="$(absolute_path "$PDF_INPUT")" || die "could not resolve PDF path: $PDF_INPUT"
[ -f "$PDF_PATH" ] || die "PDF not found: $PDF_PATH"
PDF_FILENAME="$(basename "$PDF_PATH")"

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
command -v doc2md >/dev/null 2>&1 || die "doc2md is not installed. It is required for the doc2md test cases."

HAVE_CLAUDE=1
if ! command -v claude >/dev/null 2>&1; then
  HAVE_CLAUDE=0
  warn "claude is not installed. Claude test cases will be skipped."
fi

HAVE_CODEX=1
if ! command -v codex >/dev/null 2>&1; then
  HAVE_CODEX=0
  warn "codex is not installed. Codex test cases will be skipped."
fi

if [ "$HAVE_CLAUDE" -eq 0 ] && [ "$HAVE_CODEX" -eq 0 ]; then
  die "neither claude nor codex is installed. At least one AI CLI is required."
fi

# ---------------------------------------------------------------------------
# Create per-case sandbox directories
# ---------------------------------------------------------------------------
BENCH_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/compare-pdf-bench-XXXXX")"

SANDBOX_CLAUDE_RAW="$BENCH_ROOT/case-1-claude-raw"
SANDBOX_CLAUDE_DOC2MD="$BENCH_ROOT/case-2-claude-doc2md"
SANDBOX_CODEX_RAW="$BENCH_ROOT/case-3-codex-raw"
SANDBOX_CODEX_DOC2MD="$BENCH_ROOT/case-4-codex-doc2md"

for d in "$SANDBOX_CLAUDE_RAW" "$SANDBOX_CLAUDE_DOC2MD" \
         "$SANDBOX_CODEX_RAW" "$SANDBOX_CODEX_DOC2MD"; do
  mkdir -p "$d"
  cp "$PDF_PATH" "$d/"
done

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
RAW_PROMPT="Summarize the key findings in the PDF file at ./${PDF_FILENAME}
Do not search for or reference any external files beyond what is provided."

DOC2MD_PROMPT="First, run: doc2md ./${PDF_FILENAME} -o ./output/
Then read the resulting markdown file in ./output/ and summarize the key findings.
Do not search for or reference any external files beyond what is provided."

# ---------------------------------------------------------------------------
# Build Codex flags once
# ---------------------------------------------------------------------------
CODEX_EXTRA_FLAGS=()
if [ "$HAVE_CODEX" -eq 1 ]; then
  if codex_supports_ephemeral; then
    CODEX_EXTRA_FLAGS+=(--ephemeral)
  fi
  if codex_supports_quiet; then
    CODEX_EXTRA_FLAGS+=(--quiet)
  fi
fi

# ---------------------------------------------------------------------------
# Result variables (defaults)
# ---------------------------------------------------------------------------
CLAUDE_RAW_STATUS="SKIPPED"; CLAUDE_RAW_EXIT="n/a"; CLAUDE_RAW_SECONDS="n/a"; CLAUDE_RAW_NOTE="not run"
CLAUDE_D2M_STATUS="SKIPPED"; CLAUDE_D2M_EXIT="n/a"; CLAUDE_D2M_SECONDS="n/a"; CLAUDE_D2M_NOTE="not run"
CODEX_RAW_STATUS="SKIPPED";  CODEX_RAW_EXIT="n/a";  CODEX_RAW_SECONDS="n/a";  CODEX_RAW_NOTE="not run"
CODEX_D2M_STATUS="SKIPPED";  CODEX_D2M_EXIT="n/a";  CODEX_D2M_SECONDS="n/a";  CODEX_D2M_NOTE="not run"

# Output file paths (inside each sandbox)
CLAUDE_RAW_OUTPUT="$SANDBOX_CLAUDE_RAW/response.txt"
CLAUDE_D2M_OUTPUT="$SANDBOX_CLAUDE_DOC2MD/response.txt"
CODEX_RAW_OUTPUT="$SANDBOX_CODEX_RAW/response.txt"
CODEX_D2M_OUTPUT="$SANDBOX_CODEX_DOC2MD/response.txt"

# ---------------------------------------------------------------------------
# Runner: execute a command, capture output, time it
# ---------------------------------------------------------------------------
run_case() {
  local output_file="$1"
  local prompt="$2"
  shift 2

  local started_at finished_at exit_code
  started_at="$(date +%s)"
  set +e
  printf '%s\n' "$prompt" | "$@" > "$output_file" 2>&1
  exit_code=$?
  set -e
  finished_at="$(date +%s)"

  _RC_EXIT="$exit_code"
  _RC_SECONDS="$((finished_at - started_at))"
  if [ "$exit_code" -eq 0 ]; then
    _RC_STATUS="PASS"
  else
    _RC_STATUS="FAIL"
  fi
}

# ---------------------------------------------------------------------------
# Print header
# ---------------------------------------------------------------------------
printf 'PDF benchmark source: %s\n' "$PDF_PATH"
printf 'Benchmark root: %s\n\n' "$BENCH_ROOT"

# ---------------------------------------------------------------------------
# Case 1: Claude raw PDF
# ---------------------------------------------------------------------------
if [ "$HAVE_CLAUDE" -eq 1 ]; then
  printf 'Case 1: Claude raw PDF...\n'
  run_case "$CLAUDE_RAW_OUTPUT" "$RAW_PROMPT" \
    claude -p --no-session-persistence \
      --add-dir "$SANDBOX_CLAUDE_RAW"
  CLAUDE_RAW_STATUS="$_RC_STATUS"
  CLAUDE_RAW_EXIT="$_RC_EXIT"
  CLAUDE_RAW_SECONDS="$_RC_SECONDS"
  if [ "$_RC_EXIT" -eq 0 ]; then
    CLAUDE_RAW_NOTE="raw PDF prompt completed"
  else
    CLAUDE_RAW_NOTE="command exited $_RC_EXIT"
  fi
else
  printf 'Case 1: Claude raw PDF... SKIPPED (claude not installed)\n'
  printf 'Skipped: claude is not installed.\n' > "$CLAUDE_RAW_OUTPUT"
  CLAUDE_RAW_NOTE="claude not installed"
fi

# ---------------------------------------------------------------------------
# Case 2: Claude + doc2md
# ---------------------------------------------------------------------------
if [ "$HAVE_CLAUDE" -eq 1 ]; then
  printf 'Case 2: Claude + doc2md...\n'
  run_case "$CLAUDE_D2M_OUTPUT" "$DOC2MD_PROMPT" \
    claude -p --no-session-persistence \
      --add-dir "$SANDBOX_CLAUDE_DOC2MD"
  CLAUDE_D2M_STATUS="$_RC_STATUS"
  CLAUDE_D2M_EXIT="$_RC_EXIT"
  CLAUDE_D2M_SECONDS="$_RC_SECONDS"
  if [ "$_RC_EXIT" -eq 0 ]; then
    CLAUDE_D2M_NOTE="agent ran doc2md then summarized"
  else
    CLAUDE_D2M_NOTE="command exited $_RC_EXIT"
  fi
else
  printf 'Case 2: Claude + doc2md... SKIPPED (claude not installed)\n'
  printf 'Skipped: claude is not installed.\n' > "$CLAUDE_D2M_OUTPUT"
  CLAUDE_D2M_NOTE="claude not installed"
fi

# ---------------------------------------------------------------------------
# Case 3: Codex raw PDF
# ---------------------------------------------------------------------------
if [ "$HAVE_CODEX" -eq 1 ]; then
  printf 'Case 3: Codex raw PDF...\n'
  run_case "$CODEX_RAW_OUTPUT" "$RAW_PROMPT" \
    codex exec \
      -C "$SANDBOX_CODEX_RAW" \
      --add-dir "$SANDBOX_CODEX_RAW" \
      --skip-git-repo-check \
      "${CODEX_EXTRA_FLAGS[@]}"
  CODEX_RAW_STATUS="$_RC_STATUS"
  CODEX_RAW_EXIT="$_RC_EXIT"
  CODEX_RAW_SECONDS="$_RC_SECONDS"
  if [ "$_RC_EXIT" -eq 0 ]; then
    CODEX_RAW_NOTE="raw PDF prompt completed"
  else
    CODEX_RAW_NOTE="command exited $_RC_EXIT"
  fi
else
  printf 'Case 3: Codex raw PDF... SKIPPED (codex not installed)\n'
  printf 'Skipped: codex is not installed.\n' > "$CODEX_RAW_OUTPUT"
  CODEX_RAW_NOTE="codex not installed"
fi

# ---------------------------------------------------------------------------
# Case 4: Codex + doc2md
# ---------------------------------------------------------------------------
if [ "$HAVE_CODEX" -eq 1 ]; then
  printf 'Case 4: Codex + doc2md...\n'
  run_case "$CODEX_D2M_OUTPUT" "$DOC2MD_PROMPT" \
    codex exec \
      -C "$SANDBOX_CODEX_DOC2MD" \
      --add-dir "$SANDBOX_CODEX_DOC2MD" \
      --skip-git-repo-check \
      "${CODEX_EXTRA_FLAGS[@]}"
  CODEX_D2M_STATUS="$_RC_STATUS"
  CODEX_D2M_EXIT="$_RC_EXIT"
  CODEX_D2M_SECONDS="$_RC_SECONDS"
  if [ "$_RC_EXIT" -eq 0 ]; then
    CODEX_D2M_NOTE="agent ran doc2md then summarized"
  else
    CODEX_D2M_NOTE="command exited $_RC_EXIT"
  fi
else
  printf 'Case 4: Codex + doc2md... SKIPPED (codex not installed)\n'
  printf 'Skipped: codex is not installed.\n' > "$CODEX_D2M_OUTPUT"
  CODEX_D2M_NOTE="codex not installed"
fi

# ---------------------------------------------------------------------------
# Results table
# ---------------------------------------------------------------------------
printf '\nResults\n'
printf '%-24s %-8s %-6s %-8s %s\n' "Case" "Status" "Exit" "Time" "Notes"
printf '%-24s %-8s %-6s %-8s %s\n' "------------------------" "--------" "------" "--------" "-----"
print_row "Claude raw PDF"    "$CLAUDE_RAW_STATUS" "$CLAUDE_RAW_EXIT" "$CLAUDE_RAW_SECONDS" "$CLAUDE_RAW_NOTE"
print_row "Claude + doc2md"   "$CLAUDE_D2M_STATUS" "$CLAUDE_D2M_EXIT" "$CLAUDE_D2M_SECONDS" "$CLAUDE_D2M_NOTE"
print_row "Codex raw PDF"     "$CODEX_RAW_STATUS"  "$CODEX_RAW_EXIT"  "$CODEX_RAW_SECONDS"  "$CODEX_RAW_NOTE"
print_row "Codex + doc2md"    "$CODEX_D2M_STATUS"  "$CODEX_D2M_EXIT"  "$CODEX_D2M_SECONDS"  "$CODEX_D2M_NOTE"

# ---------------------------------------------------------------------------
# Artifacts
# ---------------------------------------------------------------------------
printf '\nArtifacts\n'
printf 'Case 1 (Claude raw):     %s\n' "$SANDBOX_CLAUDE_RAW"
printf 'Case 2 (Claude + doc2md):%s\n' " $SANDBOX_CLAUDE_DOC2MD"
printf 'Case 3 (Codex raw):      %s\n' "$SANDBOX_CODEX_RAW"
printf 'Case 4 (Codex + doc2md): %s\n' "$SANDBOX_CODEX_DOC2MD"
printf '\nResponse files:\n'
printf '  %s\n' "$CLAUDE_RAW_OUTPUT"
printf '  %s\n' "$CLAUDE_D2M_OUTPUT"
printf '  %s\n' "$CODEX_RAW_OUTPUT"
printf '  %s\n' "$CODEX_D2M_OUTPUT"
printf '\nCleanup: rm -rf %s\n' "$BENCH_ROOT"
