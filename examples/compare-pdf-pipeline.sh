#!/usr/bin/env bash
set -euo pipefail

# Benchmark: compare raw file ingestion versus doc2md preprocessing for Claude
# and Codex. Tests how each model handles a batch of mixed office documents.
#
# Default mode (batch): all files go into one sandbox per agent session.
# The agent processes all files in a single session, which is the realistic
# workflow. For doc2md cases, the agent runs doc2md on the entire folder.
#
# Usage:
#   ./examples/compare-pdf-pipeline.sh                       # batch mode (default)
#   ./examples/compare-pdf-pipeline.sh --per-file             # one session per file
#   ./examples/compare-pdf-pipeline.sh file1.pdf file2.docx   # custom files, batch
#   ./examples/compare-pdf-pipeline.sh --per-file my.pdf      # custom files, per-file
#
# Set BENCHMARK_QUESTION to add a comprehension question to the prompt:
#   BENCHMARK_QUESTION="What is the Q2 budget request?" ./examples/compare-pdf-pipeline.sh
#
# Results and response files are saved to a temp directory printed at the end.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

DEFAULT_FILES=(
  "$SCRIPT_DIR/Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf"
  "$SCRIPT_DIR/API_Rate_Limiting_Design.docx"
  "$SCRIPT_DIR/Sprint_Metrics_Q1_2026.xlsx"
  "$SCRIPT_DIR/doc2md_Quarterly_Review_Q1_2026.pptx"
)

BENCHMARK_QUESTION="${BENCHMARK_QUESTION:-}"
PER_FILE_MODE=0

die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
warn() { printf 'Warning: %s\n' "$*" >&2; }

absolute_path() {
  local dir base
  dir="$(dirname "$1")"
  base="$(basename "$1")"
  [ -d "$dir" ] || return 1
  printf '%s/%s\n' "$(cd "$dir" && pwd -P)" "$base"
}

format_seconds() {
  if [ "$1" = "n/a" ]; then printf 'n/a'; else printf '%ss' "$1"; fi
}

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
command -v doc2md >/dev/null 2>&1 || die "doc2md is not installed."

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

# Codex feature flags (probe once)
CODEX_EXTRA_FLAGS=()
if [ "$HAVE_CODEX" -eq 1 ]; then
  codex exec --help 2>/dev/null | grep -q -- '--ephemeral' && CODEX_EXTRA_FLAGS+=(--ephemeral)
  codex exec --help 2>/dev/null | grep -q -- '--quiet' && CODEX_EXTRA_FLAGS+=(--quiet)
fi

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
INPUT_FILES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --per-file) PER_FILE_MODE=1; shift ;;
    --help|-h)
      printf 'Usage: %s [--per-file] [file ...]\n' "$0"
      printf '  --per-file   Run one session per file instead of batch mode\n'
      printf '  file ...     Custom files to benchmark (default: 4 sample files)\n'
      exit 0
      ;;
    *)
      resolved="$(absolute_path "$1")" || die "could not resolve path: $1"
      [ -f "$resolved" ] || die "file not found: $resolved"
      INPUT_FILES+=("$resolved")
      shift
      ;;
  esac
done

if [ ${#INPUT_FILES[@]} -eq 0 ]; then
  for f in "${DEFAULT_FILES[@]}"; do
    if [ -f "$f" ]; then
      INPUT_FILES+=("$f")
    else
      warn "default file not found, skipping: $f"
    fi
  done
fi

[ ${#INPUT_FILES[@]} -gt 0 ] || die "no input files to benchmark."

# ---------------------------------------------------------------------------
# Create benchmark root
# ---------------------------------------------------------------------------
BENCH_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/doc2md-bench-XXXXXX")"

# ---------------------------------------------------------------------------
# Runner: pipe prompt to a command, capture output, time it
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
  if [ "$exit_code" -eq 0 ]; then _RC_STATUS="PASS"; else _RC_STATUS="FAIL"; fi
}

# ---------------------------------------------------------------------------
# Result collection
# ---------------------------------------------------------------------------
RESULTS=()

add_result() {
  # label|status|exit|seconds|note
  RESULTS+=("$1|$2|$3|$4|$5")
}

# ---------------------------------------------------------------------------
# Build file listing for prompts
# ---------------------------------------------------------------------------
build_file_list() {
  local dir="$1"
  # List only the test files (not response.txt or output/)
  local listing=""
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    local base
    base="$(basename "$f")"
    [ "$base" = "response.txt" ] && continue
    listing="${listing}  ./${base}\n"
  done
  printf '%b' "$listing"
}

# ---------------------------------------------------------------------------
# Batch mode prompts
# ---------------------------------------------------------------------------
build_batch_task() {
  local extra=""
  if [ -n "$BENCHMARK_QUESTION" ]; then
    extra=" Then answer this question: $BENCHMARK_QUESTION"
  fi
  printf 'Summarize the key findings in each document.%s Do not search for or reference any external files beyond what is provided in this directory.' "$extra"
}

build_batch_raw_prompt() {
  local dir="$1"
  printf 'This directory contains the following files:\n%s\nRead each file and complete this task: %s' "$(build_file_list "$dir")" "$(build_batch_task)"
}

build_batch_doc2md_prompt() {
  local dir="$1"
  printf 'This directory contains the following files:\n%s\nFirst, run doc2md on all files: doc2md ./ -o ./output/\nThen read the resulting markdown files in ./output/ and complete this task: %s' "$(build_file_list "$dir")" "$(build_batch_task)"
}

# ---------------------------------------------------------------------------
# Per-file mode prompts
# ---------------------------------------------------------------------------
build_single_task() {
  local extra=""
  if [ -n "$BENCHMARK_QUESTION" ]; then
    extra=" Then answer this question: $BENCHMARK_QUESTION"
  fi
  printf 'Summarize the key findings in this document.%s Do not search for or reference any external files beyond what is provided.' "$extra"
}

build_single_raw_prompt() {
  local filename="$1"
  printf 'Read the file at ./%s and complete this task: %s' "$filename" "$(build_single_task)"
}

build_single_doc2md_prompt() {
  local filename="$1"
  printf 'First, run: doc2md ./%s -o ./output/\nThen read the resulting markdown file in ./output/ and complete this task: %s' "$filename" "$(build_single_task)"
}

# ---------------------------------------------------------------------------
# Batch mode: one sandbox per agent variant, all files inside
# ---------------------------------------------------------------------------
run_batch_benchmark() {
  local sandbox label

  # --- Claude raw ---
  if [ "$HAVE_CLAUDE" -eq 1 ]; then
    label="Claude raw"
    sandbox="$BENCH_ROOT/batch-claude-raw"
    mkdir -p "$sandbox"
    for f in "${INPUT_FILES[@]}"; do cp "$f" "$sandbox/"; done
    printf '  %s (batch)...' "$label"
    run_case "$sandbox/response.txt" "$(build_batch_raw_prompt "$sandbox")" \
      claude -p --no-session-persistence --add-dir "$sandbox"
    printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
    add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" "${#INPUT_FILES[@]} files"
  else
    add_result "Claude raw" "SKIP" "n/a" "n/a" "not installed"
  fi

  # --- Claude + doc2md ---
  if [ "$HAVE_CLAUDE" -eq 1 ]; then
    label="Claude+doc2md"
    sandbox="$BENCH_ROOT/batch-claude-doc2md"
    mkdir -p "$sandbox"
    for f in "${INPUT_FILES[@]}"; do cp "$f" "$sandbox/"; done
    printf '  %s (batch)...' "$label"
    run_case "$sandbox/response.txt" "$(build_batch_doc2md_prompt "$sandbox")" \
      claude -p --no-session-persistence --add-dir "$sandbox"
    printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
    add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" "${#INPUT_FILES[@]} files"
  else
    add_result "Claude+doc2md" "SKIP" "n/a" "n/a" "not installed"
  fi

  # --- Codex raw ---
  if [ "$HAVE_CODEX" -eq 1 ]; then
    label="Codex raw"
    sandbox="$BENCH_ROOT/batch-codex-raw"
    mkdir -p "$sandbox"
    for f in "${INPUT_FILES[@]}"; do cp "$f" "$sandbox/"; done
    printf '  %s (batch)...' "$label"
    run_case "$sandbox/response.txt" "$(build_batch_raw_prompt "$sandbox")" \
      codex exec -C "$sandbox" --add-dir "$sandbox" --skip-git-repo-check \
      "${CODEX_EXTRA_FLAGS[@]}"
    printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
    add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" "${#INPUT_FILES[@]} files"
  else
    add_result "Codex raw" "SKIP" "n/a" "n/a" "not installed"
  fi

  # --- Codex + doc2md ---
  if [ "$HAVE_CODEX" -eq 1 ]; then
    label="Codex+doc2md"
    sandbox="$BENCH_ROOT/batch-codex-doc2md"
    mkdir -p "$sandbox"
    for f in "${INPUT_FILES[@]}"; do cp "$f" "$sandbox/"; done
    printf '  %s (batch)...' "$label"
    run_case "$sandbox/response.txt" "$(build_batch_doc2md_prompt "$sandbox")" \
      codex exec -C "$sandbox" --add-dir "$sandbox" --skip-git-repo-check \
      "${CODEX_EXTRA_FLAGS[@]}"
    printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
    add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" "${#INPUT_FILES[@]} files"
  else
    add_result "Codex+doc2md" "SKIP" "n/a" "n/a" "not installed"
  fi
}

# ---------------------------------------------------------------------------
# Per-file mode: one sandbox per file per agent variant
# ---------------------------------------------------------------------------
run_perfile_benchmark() {
  local file_path filename ext sandbox label

  for file_path in "${INPUT_FILES[@]}"; do
    filename="$(basename "$file_path")"
    ext="${filename##*.}"

    printf '\n  --- %s ---\n' "$filename"

    # Claude raw
    if [ "$HAVE_CLAUDE" -eq 1 ]; then
      label="${ext} Claude raw"
      sandbox="$BENCH_ROOT/${ext}-claude-raw"
      mkdir -p "$sandbox"
      cp "$file_path" "$sandbox/"
      printf '    Claude raw...'
      run_case "$sandbox/response.txt" "$(build_single_raw_prompt "$filename")" \
        claude -p --no-session-persistence --add-dir "$sandbox"
      printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
      add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" ""
    else
      add_result "${ext} Claude raw" "SKIP" "n/a" "n/a" "not installed"
    fi

    # Claude + doc2md
    if [ "$HAVE_CLAUDE" -eq 1 ]; then
      label="${ext} Claude+d2m"
      sandbox="$BENCH_ROOT/${ext}-claude-doc2md"
      mkdir -p "$sandbox"
      cp "$file_path" "$sandbox/"
      printf '    Claude+doc2md...'
      run_case "$sandbox/response.txt" "$(build_single_doc2md_prompt "$filename")" \
        claude -p --no-session-persistence --add-dir "$sandbox"
      printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
      add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" ""
    else
      add_result "${ext} Claude+d2m" "SKIP" "n/a" "n/a" "not installed"
    fi

    # Codex raw
    if [ "$HAVE_CODEX" -eq 1 ]; then
      label="${ext} Codex raw"
      sandbox="$BENCH_ROOT/${ext}-codex-raw"
      mkdir -p "$sandbox"
      cp "$file_path" "$sandbox/"
      printf '    Codex raw...'
      run_case "$sandbox/response.txt" "$(build_single_raw_prompt "$filename")" \
        codex exec -C "$sandbox" --add-dir "$sandbox" --skip-git-repo-check \
        "${CODEX_EXTRA_FLAGS[@]}"
      printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
      add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" ""
    else
      add_result "${ext} Codex raw" "SKIP" "n/a" "n/a" "not installed"
    fi

    # Codex + doc2md
    if [ "$HAVE_CODEX" -eq 1 ]; then
      label="${ext} Codex+d2m"
      sandbox="$BENCH_ROOT/${ext}-codex-doc2md"
      mkdir -p "$sandbox"
      cp "$file_path" "$sandbox/"
      printf '    Codex+doc2md...'
      run_case "$sandbox/response.txt" "$(build_single_doc2md_prompt "$filename")" \
        codex exec -C "$sandbox" --add-dir "$sandbox" --skip-git-repo-check \
        "${CODEX_EXTRA_FLAGS[@]}"
      printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
      add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" ""
    else
      add_result "${ext} Codex+d2m" "SKIP" "n/a" "n/a" "not installed"
    fi
  done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
MODE="batch"
[ "$PER_FILE_MODE" -eq 1 ] && MODE="per-file"

printf 'doc2md benchmark (%s mode)\n' "$MODE"
printf 'Files: %d\n' "${#INPUT_FILES[@]}"
for f in "${INPUT_FILES[@]}"; do
  printf '  %s (%s)\n' "$(basename "$f")" "${f##*.}"
done
printf 'Models: %s\n' "$([ "$HAVE_CLAUDE" -eq 1 ] && printf 'Claude ')$([ "$HAVE_CODEX" -eq 1 ] && printf 'Codex')"
printf 'Artifacts: %s\n\n' "$BENCH_ROOT"

if [ "$PER_FILE_MODE" -eq 1 ]; then
  run_perfile_benchmark
else
  run_batch_benchmark
fi

# ---------------------------------------------------------------------------
# Summary table
# ---------------------------------------------------------------------------
printf '\n'
printf '=%.0s' {1..72}
printf '\n'
printf '%-20s %-8s %-6s %-8s %s\n' "Case" "Status" "Exit" "Time" "Notes"
printf '%-20s %-8s %-6s %-8s %s\n' "--------------------" "--------" "------" "--------" "-----"

for entry in "${RESULTS[@]}"; do
  IFS='|' read -r label status exit_code seconds note <<< "$entry"
  printf '%-20s %-8s %-6s %-8s %s\n' \
    "$label" "$status" "$exit_code" \
    "$(format_seconds "$seconds")" "$note"
done

# ---------------------------------------------------------------------------
# Response file listing
# ---------------------------------------------------------------------------
printf '\nResponse files:\n'
for d in "$BENCH_ROOT"/*/; do
  if [ -f "${d}response.txt" ]; then
    size="$(wc -c < "${d}response.txt" | tr -d '[:space:]')"
    printf '  %sresponse.txt (%s bytes)\n' "$d" "$size"
  fi
done

printf '\nCleanup: rm -rf %s\n' "$BENCH_ROOT"
