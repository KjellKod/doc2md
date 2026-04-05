#!/usr/bin/env bash
set -euo pipefail

# Compare raw PDF ingestion versus doc2md-preprocessed markdown for Claude and
# Codex. Usage: ./examples/compare-pdf-pipeline.sh [pdf-path]
# Defaults to examples/Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf
# and leaves all benchmark artifacts in a temp directory that is printed at the end.

SUMMARY_PROMPT="Summarize the key findings in this document"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
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
  local dir
  local base

  dir="$(dirname "$target")"
  base="$(basename "$target")"

  [ -d "$dir" ] || return 1
  printf '%s/%s\n' "$(cd "$dir" && pwd -P)" "$base"
}

basename_without_ext() {
  local file_name

  file_name="$(basename "$1")"
  printf '%s\n' "${file_name%.*}"
}

file_size_bytes() {
  wc -c < "$1" | tr -d '[:space:]'
}

format_seconds() {
  local value="$1"

  if [ "$value" = "n/a" ]; then
    printf 'n/a'
    return
  fi

  printf '%ss' "$value"
}

raw_pdf_prompt() {
  printf 'Read the file at %s and summarize the key findings in this document.\n' "$1"
}

write_skip_output() {
  local output_file="$1"
  local message="$2"

  printf '%s\n' "$message" > "$output_file"
}

capture_command() {
  local output_file="$1"
  shift

  local started_at
  local finished_at
  local exit_code

  started_at="$(date +%s)"
  set +e
  "$@" > "$output_file" 2>&1
  exit_code=$?
  set -e
  finished_at="$(date +%s)"

  RESULT_EXIT_CODE="$exit_code"
  RESULT_SECONDS="$((finished_at - started_at))"
  if [ "$exit_code" -eq 0 ]; then
    RESULT_STATUS="PASS"
  else
    RESULT_STATUS="FAIL"
  fi
}

capture_command_from_stdin() {
  local input_file="$1"
  local output_file="$2"
  shift 2

  local started_at
  local finished_at
  local exit_code

  started_at="$(date +%s)"
  set +e
  "$@" < "$input_file" > "$output_file" 2>&1
  exit_code=$?
  set -e
  finished_at="$(date +%s)"

  RESULT_EXIT_CODE="$exit_code"
  RESULT_SECONDS="$((finished_at - started_at))"
  if [ "$exit_code" -eq 0 ]; then
    RESULT_STATUS="PASS"
  else
    RESULT_STATUS="FAIL"
  fi
}

codex_supports_ephemeral() {
  codex exec --help 2>/dev/null | grep -q -- '--ephemeral'
}

print_row() {
  local label="$1"
  local status="$2"
  local exit_code="$3"
  local seconds="$4"
  local note="$5"

  printf '%-24s %-8s %-6s %-8s %s\n' \
    "$label" \
    "$status" \
    "$exit_code" \
    "$(format_seconds "$seconds")" \
    "$note"
}

print_total_row() {
  local label="$1"
  local status="$2"
  local seconds="$3"
  local note="$4"

  printf '%-24s %-8s %-8s %s\n' \
    "$label" \
    "$status" \
    "$(format_seconds "$seconds")" \
    "$note"
}

run_doc2md_conversion() {
  capture_command "$DOC2MD_LOG_FILE" doc2md "$PDF_PATH" -o "$DOC2MD_OUTPUT_DIR"
  DOC2MD_STATUS="$RESULT_STATUS"
  DOC2MD_EXIT="$RESULT_EXIT_CODE"
  DOC2MD_SECONDS="$RESULT_SECONDS"

  if [ "$DOC2MD_EXIT" -ne 0 ]; then
    DOC2MD_NOTE="conversion failed"
    die "doc2md conversion failed. See $DOC2MD_LOG_FILE"
  fi

  if [ ! -f "$MARKDOWN_FILE" ]; then
    set -- "$DOC2MD_OUTPUT_DIR"/*.md
    if [ -f "$1" ]; then
      MARKDOWN_FILE="$1"
    fi
  fi

  [ -f "$MARKDOWN_FILE" ] || die "doc2md did not produce a markdown file in $DOC2MD_OUTPUT_DIR"

  MARKDOWN_BYTES="$(file_size_bytes "$MARKDOWN_FILE")"
  if [ "$MARKDOWN_BYTES" -le 500 ]; then
    DOC2MD_NOTE="markdown output too small"
    die "doc2md output was only $MARKDOWN_BYTES bytes. Expected more than 500 bytes."
  fi

  DOC2MD_NOTE="markdown ready ($MARKDOWN_BYTES bytes)"
}

run_claude_raw() {
  capture_command \
    "$CLAUDE_RAW_OUTPUT" \
    "${CLAUDE_BASE_CMD[@]}" \
    "$(raw_pdf_prompt "$PDF_PATH")"

  CLAUDE_RAW_STATUS="$RESULT_STATUS"
  CLAUDE_RAW_EXIT="$RESULT_EXIT_CODE"
  CLAUDE_RAW_SECONDS="$RESULT_SECONDS"
  if [ "$CLAUDE_RAW_EXIT" -eq 0 ]; then
    CLAUDE_RAW_NOTE="raw PDF prompt completed"
  else
    CLAUDE_RAW_NOTE="command exited $CLAUDE_RAW_EXIT"
  fi
}

run_claude_markdown() {
  capture_command_from_stdin \
    "$MARKDOWN_FILE" \
    "$CLAUDE_MD_OUTPUT" \
    "${CLAUDE_BASE_CMD[@]}" \
    "$SUMMARY_PROMPT"

  CLAUDE_MD_STATUS="$RESULT_STATUS"
  CLAUDE_MD_EXIT="$RESULT_EXIT_CODE"
  CLAUDE_MD_SECONDS="$RESULT_SECONDS"
  if [ "$CLAUDE_MD_EXIT" -eq 0 ]; then
    CLAUDE_MD_NOTE="markdown piped via stdin"
  else
    CLAUDE_MD_NOTE="command exited $CLAUDE_MD_EXIT"
  fi
}

run_codex_raw() {
  capture_command \
    "$CODEX_RAW_OUTPUT" \
    "${CODEX_BASE_CMD[@]}" \
    "$(raw_pdf_prompt "$PDF_PATH")"

  CODEX_RAW_STATUS="$RESULT_STATUS"
  CODEX_RAW_EXIT="$RESULT_EXIT_CODE"
  CODEX_RAW_SECONDS="$RESULT_SECONDS"
  if [ "$CODEX_RAW_EXIT" -eq 0 ]; then
    CODEX_RAW_NOTE="raw PDF prompt completed"
  else
    CODEX_RAW_NOTE="command exited $CODEX_RAW_EXIT"
  fi
}

run_codex_markdown() {
  capture_command_from_stdin \
    "$MARKDOWN_FILE" \
    "$CODEX_MD_OUTPUT" \
    "${CODEX_BASE_CMD[@]}" \
    "$SUMMARY_PROMPT"

  CODEX_MD_STATUS="$RESULT_STATUS"
  CODEX_MD_EXIT="$RESULT_EXIT_CODE"
  CODEX_MD_SECONDS="$RESULT_SECONDS"
  if [ "$CODEX_MD_EXIT" -eq 0 ]; then
    CODEX_MD_NOTE="markdown piped via stdin"
  else
    CODEX_MD_NOTE="command exited $CODEX_MD_EXIT"
  fi
}

PDF_INPUT="${1:-$DEFAULT_PDF}"
PDF_PATH="$(absolute_path "$PDF_INPUT")" || die "could not resolve PDF path: $PDF_INPUT"
[ -f "$PDF_PATH" ] || die "PDF not found: $PDF_PATH"
PDF_READ_DIR="$(cd "$(dirname "$PDF_PATH")" && pwd -P)"

command -v doc2md >/dev/null 2>&1 || die "doc2md is not installed. All tests are skipped because markdown conversion is required."

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

# Keep artifacts for manual review instead of auto-cleaning them on exit.
ARTIFACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/compare-pdf-pipeline.XXXXXX")"
DOC2MD_OUTPUT_DIR="$ARTIFACT_DIR/doc2md"
DOC2MD_LOG_FILE="$ARTIFACT_DIR/doc2md.json"
MARKDOWN_FILE="$DOC2MD_OUTPUT_DIR/$(basename_without_ext "$PDF_PATH").md"
mkdir -p "$DOC2MD_OUTPUT_DIR"

CLAUDE_RAW_OUTPUT="$ARTIFACT_DIR/claude-raw-pdf.txt"
CLAUDE_MD_OUTPUT="$ARTIFACT_DIR/claude-doc2md-markdown.txt"
CODEX_RAW_OUTPUT="$ARTIFACT_DIR/codex-raw-pdf.txt"
CODEX_MD_OUTPUT="$ARTIFACT_DIR/codex-doc2md-markdown.txt"

DOC2MD_STATUS="NOT_RUN"
DOC2MD_EXIT="n/a"
DOC2MD_SECONDS="n/a"
DOC2MD_NOTE=""
MARKDOWN_BYTES="0"

CLAUDE_RAW_STATUS="SKIPPED"
CLAUDE_RAW_EXIT="n/a"
CLAUDE_RAW_SECONDS="n/a"
CLAUDE_RAW_NOTE="not run"

CLAUDE_MD_STATUS="SKIPPED"
CLAUDE_MD_EXIT="n/a"
CLAUDE_MD_SECONDS="n/a"
CLAUDE_MD_NOTE="not run"

CODEX_RAW_STATUS="SKIPPED"
CODEX_RAW_EXIT="n/a"
CODEX_RAW_SECONDS="n/a"
CODEX_RAW_NOTE="not run"

CODEX_MD_STATUS="SKIPPED"
CODEX_MD_EXIT="n/a"
CODEX_MD_SECONDS="n/a"
CODEX_MD_NOTE="not run"

CLAUDE_BASE_CMD=(claude -p --no-session-persistence --add-dir "$PDF_READ_DIR")
if [ "$HAVE_CODEX" -eq 1 ] && codex_supports_ephemeral; then
  CODEX_BASE_CMD=(codex exec -C "$REPO_ROOT" --add-dir "$PDF_READ_DIR" --ephemeral)
  CODEX_EPHEMERAL_NOTE="--ephemeral enabled"
else
  CODEX_BASE_CMD=(codex exec -C "$REPO_ROOT" --add-dir "$PDF_READ_DIR")
  CODEX_EPHEMERAL_NOTE="--ephemeral unavailable"
fi

printf 'PDF benchmark source: %s\n' "$PDF_PATH"
printf 'Benchmark artifacts: %s\n' "$ARTIFACT_DIR"
printf '\nRunning doc2md conversion...\n'
run_doc2md_conversion

if [ "$HAVE_CLAUDE" -eq 1 ]; then
  printf 'Running Claude raw PDF benchmark...\n'
  run_claude_raw
  printf 'Running Claude doc2md markdown benchmark...\n'
  run_claude_markdown
else
  write_skip_output "$CLAUDE_RAW_OUTPUT" "Skipped: claude is not installed."
  write_skip_output "$CLAUDE_MD_OUTPUT" "Skipped: claude is not installed."
  CLAUDE_RAW_NOTE="claude not installed"
  CLAUDE_MD_NOTE="claude not installed"
fi

if [ "$HAVE_CODEX" -eq 1 ]; then
  printf 'Running Codex raw PDF benchmark...\n'
  run_codex_raw
  printf 'Running Codex doc2md markdown benchmark...\n'
  run_codex_markdown
  CODEX_RAW_NOTE="${CODEX_RAW_NOTE}; ${CODEX_EPHEMERAL_NOTE}"
  CODEX_MD_NOTE="${CODEX_MD_NOTE}; ${CODEX_EPHEMERAL_NOTE}"
else
  write_skip_output "$CODEX_RAW_OUTPUT" "Skipped: codex is not installed."
  write_skip_output "$CODEX_MD_OUTPUT" "Skipped: codex is not installed."
  CODEX_RAW_NOTE="codex not installed"
  CODEX_MD_NOTE="codex not installed"
fi

CLAUDE_DOC2MD_TOTAL_STATUS="$CLAUDE_MD_STATUS"
CLAUDE_DOC2MD_TOTAL_SECONDS="n/a"
if [ "$CLAUDE_MD_SECONDS" != "n/a" ]; then
  CLAUDE_DOC2MD_TOTAL_SECONDS="$((DOC2MD_SECONDS + CLAUDE_MD_SECONDS))"
fi

CODEX_DOC2MD_TOTAL_STATUS="$CODEX_MD_STATUS"
CODEX_DOC2MD_TOTAL_SECONDS="n/a"
if [ "$CODEX_MD_SECONDS" != "n/a" ]; then
  CODEX_DOC2MD_TOTAL_SECONDS="$((DOC2MD_SECONDS + CODEX_MD_SECONDS))"
fi

printf '\nBreakdown\n'
printf '%-24s %-8s %-6s %-8s %s\n' "Case" "Status" "Exit" "Seconds" "Notes"
printf '%-24s %-8s %-6s %-8s %s\n' "------------------------" "--------" "------" "--------" "-----"
print_row "doc2md conversion" "$DOC2MD_STATUS" "$DOC2MD_EXIT" "$DOC2MD_SECONDS" "$DOC2MD_NOTE"
print_row "Claude raw PDF" "$CLAUDE_RAW_STATUS" "$CLAUDE_RAW_EXIT" "$CLAUDE_RAW_SECONDS" "$CLAUDE_RAW_NOTE"
print_row "Claude doc2md" "$CLAUDE_MD_STATUS" "$CLAUDE_MD_EXIT" "$CLAUDE_MD_SECONDS" "$CLAUDE_MD_NOTE"
print_row "Codex raw PDF" "$CODEX_RAW_STATUS" "$CODEX_RAW_EXIT" "$CODEX_RAW_SECONDS" "$CODEX_RAW_NOTE"
print_row "Codex doc2md" "$CODEX_MD_STATUS" "$CODEX_MD_EXIT" "$CODEX_MD_SECONDS" "$CODEX_MD_NOTE"

printf '\nPath Totals\n'
printf '%-24s %-8s %-8s %s\n' "Scenario" "Status" "Seconds" "Components"
printf '%-24s %-8s %-8s %s\n' "------------------------" "--------" "--------" "----------"
print_total_row "Claude raw PDF" "$CLAUDE_RAW_STATUS" "$CLAUDE_RAW_SECONDS" "raw PDF only"
print_total_row "Claude doc2md" "$CLAUDE_DOC2MD_TOTAL_STATUS" "$CLAUDE_DOC2MD_TOTAL_SECONDS" "doc2md $(format_seconds "$DOC2MD_SECONDS") + markdown $(format_seconds "$CLAUDE_MD_SECONDS")"
print_total_row "Codex raw PDF" "$CODEX_RAW_STATUS" "$CODEX_RAW_SECONDS" "raw PDF only"
print_total_row "Codex doc2md" "$CODEX_DOC2MD_TOTAL_STATUS" "$CODEX_DOC2MD_TOTAL_SECONDS" "doc2md $(format_seconds "$DOC2MD_SECONDS") + markdown $(format_seconds "$CODEX_MD_SECONDS")"

printf '\nArtifacts\n'
printf 'doc2md log: %s\n' "$DOC2MD_LOG_FILE"
printf 'converted markdown: %s (%s bytes)\n' "$MARKDOWN_FILE" "$MARKDOWN_BYTES"
printf 'Claude raw PDF response: %s\n' "$CLAUDE_RAW_OUTPUT"
printf 'Claude doc2md response: %s\n' "$CLAUDE_MD_OUTPUT"
printf 'Codex raw PDF response: %s\n' "$CODEX_RAW_OUTPUT"
printf 'Codex doc2md response: %s\n' "$CODEX_MD_OUTPUT"
printf 'Cleanup: delete %s when you are done reviewing the artifacts.\n' "$ARTIFACT_DIR"
