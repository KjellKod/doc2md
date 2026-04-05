#!/usr/bin/env bash
set -euo pipefail

# Benchmark: compare raw file ingestion versus doc2md preprocessing for Claude
# and Codex across multiple file formats (PDF, DOCX, XLSX, PPTX).
#
# Default mode (batch): all files go into one sandbox per agent session.
# Per-file mode (--per-file): one isolated session per file.
#
# Usage:
#   ./examples/compare-pdf-pipeline.sh                       # batch (default)
#   ./examples/compare-pdf-pipeline.sh --per-file             # per-file
#   ./examples/compare-pdf-pipeline.sh file1.pdf file2.docx   # custom files
#
# Environment:
#   BENCHMARK_QUESTION  Optional comprehension question appended to the task.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

DEFAULT_FILES=(
  "$SCRIPT_DIR/Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf"
  "$SCRIPT_DIR/API_Rate_Limiting_Design.docx"
  "$SCRIPT_DIR/Sprint_Metrics_Q1_2026.xlsx"
  "$SCRIPT_DIR/doc2md_Quarterly_Review_Q1_2026.pptx"
)

BENCHMARK_QUESTION="${BENCHMARK_QUESTION:-}"
PER_FILE_MODE=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
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

RESULTS=()
add_result() { RESULTS+=("$1|$2|$3|$4|$5"); }

# ---------------------------------------------------------------------------
# Timed execution: pipe prompt via stdin to a command
# Sets: _RC_STATUS, _RC_EXIT, _RC_SECONDS
# ---------------------------------------------------------------------------
run_timed() {
  local output_file="$1" prompt="$2"
  shift 2
  local t0 t1
  t0="$(date +%s)"
  set +e
  printf '%s\n' "$prompt" | "$@" > "$output_file" 2>&1
  _RC_EXIT=$?
  set -e
  t1="$(date +%s)"
  _RC_SECONDS="$((t1 - t0))"
  if [ "$_RC_EXIT" -eq 0 ]; then _RC_STATUS="PASS"; else _RC_STATUS="FAIL"; fi
}

# ---------------------------------------------------------------------------
# Sandbox: create an isolated temp dir and copy files into it
# ---------------------------------------------------------------------------
make_sandbox() {
  local name="$1"
  shift
  local sandbox="$BENCH_ROOT/$name"
  mkdir -p "$sandbox"
  for f in "$@"; do cp "$f" "$sandbox/"; done
  printf '%s' "$sandbox"
}

# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------
build_task() {
  local extra=""
  if [ -n "$BENCHMARK_QUESTION" ]; then
    extra=" Then answer this question: $BENCHMARK_QUESTION"
  fi
  printf 'Extract and output the full text content of %s.%s Do not search for or reference any external files beyond what is provided.' \
    "$1" "$extra"
}

# List sandbox files as "./name" lines (skips response.txt)
list_sandbox_files() {
  for f in "$1"/*; do
    [ -f "$f" ] || continue
    local b; b="$(basename "$f")"
    [ "$b" = "response.txt" ] && continue
    printf '  ./%s\n' "$b"
  done
}

# Build space-separated "./file1 ./file2" for doc2md command
doc2md_file_args() {
  local args=""
  for f in "$1"/*; do
    [ -f "$f" ] || continue
    local b; b="$(basename "$f")"
    [ "$b" = "response.txt" ] && continue
    args="${args} ./${b}"
  done
  printf '%s' "$args"
}

# Example prompts (for manual reproduction):
#
# --- Batch raw prompt ---
#   This directory contains the following files:
#     ./Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf
#     ./API_Rate_Limiting_Design.docx
#     ./Sprint_Metrics_Q1_2026.xlsx
#     ./doc2md_Quarterly_Review_Q1_2026.pptx
#   Read each file and complete this task: Extract and output the full
#   text content of each document. Do not search for or reference any
#   external files beyond what is provided in this directory.
#
# --- Batch doc2md prompt ---
#   This directory contains the following files:
#     ./Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf
#     ./API_Rate_Limiting_Design.docx
#     ./Sprint_Metrics_Q1_2026.xlsx
#     ./doc2md_Quarterly_Review_Q1_2026.pptx
#   First, convert all files to markdown by running:
#     doc2md ./Repo_Quality_Cleanup.pdf ./API_Rate_Limiting.docx ... -o ./output/
#   Then read the resulting markdown files in ./output/ and complete this
#   task: Extract and output the full text content of each document. Do not
#   search for or reference any external files beyond what is provided in
#   this directory.
#
# --- Single raw prompt ---
#   Read the file at ./API_Rate_Limiting_Design.docx and complete this
#   task: Extract and output the full text content of this document. Do not
#   search for or reference any external files beyond what is provided.
#
# --- Single doc2md prompt ---
#   First, run: doc2md ./API_Rate_Limiting_Design.docx -o ./output/
#   Then read the resulting markdown file in ./output/ and complete this
#   task: Extract and output the full text content of this document. Do not
#   search for or reference any external files beyond what is provided.
#
# To run this benchmark script:
#   ./examples/compare-pdf-pipeline.sh                       # batch mode, 4 default files
#   ./examples/compare-pdf-pipeline.sh --per-file             # one session per file
#   ./examples/compare-pdf-pipeline.sh my.pdf my.docx         # custom files
#   BENCHMARK_QUESTION="What is the Q2 budget?" ./examples/compare-pdf-pipeline.sh
#
# To run doc2md directly (no AI, just conversion):
#   doc2md ./file1.pdf ./file2.docx ./file3.xlsx ./file4.pptx -o ./output/
#
# To run manually with Claude:
#   echo "<prompt>" | claude -p --no-session-persistence --add-dir /tmp/sandbox
#
# To run manually with Codex:
#   echo "<prompt>" | codex exec -C /tmp/sandbox --add-dir /tmp/sandbox --skip-git-repo-check

prompt_raw_batch() {
  local dir="$1"
  printf 'This directory contains the following files:\n%s\nRead each file and complete this task: %s' \
    "$(list_sandbox_files "$dir")" "$(build_task "each document")"
}

prompt_doc2md_batch() {
  local dir="$1"
  printf 'This directory contains the following files:\n%s\nFirst, convert all files to markdown by running: doc2md%s -o ./output/\nThen read the resulting markdown files in ./output/ and complete this task: %s' \
    "$(list_sandbox_files "$dir")" "$(doc2md_file_args "$dir")" "$(build_task "each document")"
}

prompt_raw_single() {
  printf 'Read the file at ./%s and complete this task: %s' "$1" "$(build_task "this document")"
}

prompt_doc2md_single() {
  printf 'First, run: doc2md ./%s -o ./output/\nThen read the resulting markdown file in ./output/ and complete this task: %s' \
    "$1" "$(build_task "this document")"
}

# ---------------------------------------------------------------------------
# Agent runner: handles availability check, sandbox, prompt, result capture
#   run_agent <label> <sandbox> <prompt> <agent: claude|codex>
# ---------------------------------------------------------------------------
run_agent() {
  local label="$1" sandbox="$2" prompt="$3" agent="$4"

  case "$agent" in
    claude)
      if [ "$HAVE_CLAUDE" -eq 0 ]; then
        add_result "$label" "SKIP" "n/a" "n/a" "not installed"
        return
      fi
      run_timed "$sandbox/response.txt" "$prompt" \
        claude -p --no-session-persistence --add-dir "$sandbox"
      ;;
    codex)
      if [ "$HAVE_CODEX" -eq 0 ]; then
        add_result "$label" "SKIP" "n/a" "n/a" "not installed"
        return
      fi
      run_timed "$sandbox/response.txt" "$prompt" \
        codex exec -C "$sandbox" --add-dir "$sandbox" --skip-git-repo-check \
        "${CODEX_EXTRA_FLAGS[@]}"
      ;;
  esac

  printf ' %s (%ss)\n' "$_RC_STATUS" "$_RC_SECONDS"
  add_result "$label" "$_RC_STATUS" "$_RC_EXIT" "$_RC_SECONDS" ""
}

# ---------------------------------------------------------------------------
# doc2md baseline (no AI, just conversion)
# ---------------------------------------------------------------------------
run_doc2md_baseline() {
  local sandbox
  sandbox="$(make_sandbox "baseline-doc2md" "${INPUT_FILES[@]}")"

  local doc2md_args=()
  for f in "$sandbox"/*; do
    [ -f "$f" ] || continue
    doc2md_args+=("$f")
  done

  printf '  doc2md only (baseline)...'
  local t0 t1 exit_code
  t0="$(date +%s)"
  set +e
  doc2md "${doc2md_args[@]}" -o "$sandbox/output" > "$sandbox/response.txt" 2>&1
  exit_code=$?
  set -e
  t1="$(date +%s)"

  local seconds="$((t1 - t0))"
  local status="PASS"; [ "$exit_code" -ne 0 ] && status="FAIL"

  local md_count=0 md_bytes=0
  if [ -d "$sandbox/output" ]; then
    for mf in "$sandbox/output"/*.md; do
      [ -f "$mf" ] || continue
      md_count=$((md_count + 1))
      md_bytes=$((md_bytes + $(wc -c < "$mf" | tr -d '[:space:]')))
    done
  fi

  printf ' %s (%ss, %d files, %d bytes md)\n' "$status" "$seconds" "$md_count" "$md_bytes"
  add_result "doc2md only" "$status" "$exit_code" "$seconds" \
    "${#INPUT_FILES[@]} in, ${md_count} md, ${md_bytes} bytes"
}

# ---------------------------------------------------------------------------
# Batch mode
# ---------------------------------------------------------------------------
run_batch() {
  run_doc2md_baseline

  local agents=("claude" "codex")
  local modes=("raw" "doc2md")

  for agent in "${agents[@]}"; do
    for mode in "${modes[@]}"; do
      local label="${agent^} ${mode}"
      [ "$mode" = "doc2md" ] && label="${agent^}+doc2md"
      local sandbox
      sandbox="$(make_sandbox "batch-${agent}-${mode}" "${INPUT_FILES[@]}")"

      local prompt
      if [ "$mode" = "raw" ]; then
        prompt="$(prompt_raw_batch "$sandbox")"
      else
        prompt="$(prompt_doc2md_batch "$sandbox")"
      fi

      printf '  %s (batch)...' "$label"
      run_agent "$label" "$sandbox" "$prompt" "$agent"
    done
  done
}

# ---------------------------------------------------------------------------
# Per-file mode
# ---------------------------------------------------------------------------
run_perfile() {
  run_doc2md_baseline

  local agents=("claude" "codex")
  local modes=("raw" "doc2md")

  for file_path in "${INPUT_FILES[@]}"; do
    local filename ext
    filename="$(basename "$file_path")"
    ext="${filename##*.}"
    printf '\n  --- %s ---\n' "$filename"

    for agent in "${agents[@]}"; do
      for mode in "${modes[@]}"; do
        local suffix="raw"; [ "$mode" = "doc2md" ] && suffix="d2m"
        local label="${ext} ${agent^} ${suffix}"
        local sandbox
        sandbox="$(make_sandbox "${ext}-${agent}-${mode}-$$" "$file_path")"

        local prompt
        if [ "$mode" = "raw" ]; then
          prompt="$(prompt_raw_single "$filename")"
        else
          prompt="$(prompt_doc2md_single "$filename")"
        fi

        printf '    %s %s...' "${agent^}" "$mode"
        run_agent "$label" "$sandbox" "$prompt" "$agent"
      done
    done
  done
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

[ "$HAVE_CLAUDE" -eq 0 ] && [ "$HAVE_CODEX" -eq 0 ] && \
  die "neither claude nor codex is installed. At least one AI CLI is required."

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
      printf '  --per-file   One session per file instead of batch\n'
      printf '  file ...     Custom files (default: 4 sample files)\n'
      exit 0
      ;;
    *)
      resolved="$(absolute_path "$1")" || die "could not resolve: $1"
      [ -f "$resolved" ] || die "not found: $resolved"
      INPUT_FILES+=("$resolved")
      shift
      ;;
  esac
done

if [ ${#INPUT_FILES[@]} -eq 0 ]; then
  for f in "${DEFAULT_FILES[@]}"; do
    [ -f "$f" ] && INPUT_FILES+=("$f") || warn "missing default: $f"
  done
fi
[ ${#INPUT_FILES[@]} -gt 0 ] || die "no input files."

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
BENCH_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/doc2md-bench-XXXXXX")"
MODE="batch"; [ "$PER_FILE_MODE" -eq 1 ] && MODE="per-file"

printf 'doc2md benchmark (%s mode)\n' "$MODE"
printf 'Files: %d\n' "${#INPUT_FILES[@]}"
for f in "${INPUT_FILES[@]}"; do
  printf '  %s (%s)\n' "$(basename "$f")" "${f##*.}"
done
printf 'Models: %s\n' "$([ "$HAVE_CLAUDE" -eq 1 ] && printf 'Claude ')$([ "$HAVE_CODEX" -eq 1 ] && printf 'Codex')"
printf 'Artifacts: %s\n\n' "$BENCH_ROOT"

if [ "$PER_FILE_MODE" -eq 1 ]; then run_perfile; else run_batch; fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n'
printf '=%.0s' {1..72}
printf '\n'
printf '%-20s %-8s %-6s %-8s %s\n' "Case" "Status" "Exit" "Time" "Notes"
printf '%-20s %-8s %-6s %-8s %s\n' "--------------------" "--------" "------" "--------" "-----"
for entry in "${RESULTS[@]}"; do
  IFS='|' read -r label status exit_code seconds note <<< "$entry"
  printf '%-20s %-8s %-6s %-8s %s\n' "$label" "$status" "$exit_code" \
    "$(format_seconds "$seconds")" "$note"
done

printf '\nResponse files:\n'
for d in "$BENCH_ROOT"/*/; do
  [ -f "${d}response.txt" ] || continue
  local_size="$(wc -c < "${d}response.txt" | tr -d '[:space:]')"
  printf '  %sresponse.txt (%s bytes)\n' "$d" "$local_size"
done
printf '\nCleanup: rm -rf %s\n' "$BENCH_ROOT"
