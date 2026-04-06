#!/usr/bin/env bash
set -euo pipefail

# Run the benchmark N times and collect timing statistics.
# Usage: ./examples/run-benchmark-suite.sh [runs]    (default: 10)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BENCHMARK="$SCRIPT_DIR/compare-pdf-pipeline.sh"
RUNS="${1:-10}"
RESULTS_DIR="$SCRIPT_DIR/output/benchmark-results-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$RESULTS_DIR"

printf 'Benchmark suite: %d runs\n' "$RUNS"
printf 'Results dir: %s\n\n' "$RESULTS_DIR"

# CSV header
CSV="$RESULTS_DIR/timings.csv"
printf 'run,doc2md_only,claude_raw,claude_doc2md,codex_raw,codex_doc2md\n' > "$CSV"

for i in $(seq 1 "$RUNS"); do
  printf '=== Run %d/%d ===\n' "$i" "$RUNS"

  # Capture full output
  output="$RESULTS_DIR/run-${i}.txt"
  "$BENCHMARK" > "$output" 2>&1 || true

  # The summary table has format: Case Status Exit Time Notes
  # Time is in column 4, formatted as "136s" or "n/a"
  extract_time() {
    local pattern="$1"
    local line
    line="$(grep "$pattern" "$output" | tail -1)" || true
    if [ -z "$line" ]; then
      printf 'n/a'
      return
    fi
    # Extract the time field (4th column-ish, ends with 's')
    printf '%s' "$line" | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+s$/) print $i}' | sed 's/s$//' | head -1
  }

  t_d2m="$(extract_time "^doc2md only")"
  t_cr="$(extract_time "^Claude raw")"
  t_cd="$(extract_time "^Claude+doc2md")"
  t_xr="$(extract_time "^Codex raw")"
  t_xd="$(extract_time "^Codex+doc2md")"

  printf '  doc2md=%ss  Claude raw=%ss  Claude+doc2md=%ss  Codex raw=%ss  Codex+doc2md=%ss\n' \
    "$t_d2m" "$t_cr" "$t_cd" "$t_xr" "$t_xd"

  printf '%d,%s,%s,%s,%s,%s\n' "$i" "$t_d2m" "$t_cr" "$t_cd" "$t_xr" "$t_xd" >> "$CSV"
done

# Compute stats
printf '\n'
printf '=%.0s' {1..72}
printf '\nResults after %d runs\n' "$RUNS"
printf '=%.0s' {1..72}
printf '\n\n'

compute_stats() {
  local label="$1"
  local col="$2"
  local values
  values="$(tail -n +2 "$CSV" | cut -d',' -f"$col" | grep -v 'n/a' | sort -n)"
  local count
  count="$(printf '%s\n' "$values" | wc -l | tr -d '[:space:]')"

  if [ "$count" -eq 0 ]; then
    printf '%-20s  no data\n' "$label"
    return
  fi

  local min max sum median
  min="$(printf '%s\n' "$values" | head -1)"
  max="$(printf '%s\n' "$values" | tail -1)"
  sum=0
  while IFS= read -r v; do
    sum=$((sum + v))
  done <<< "$values"
  local avg=$((sum / count))

  # Median
  local mid=$(( (count + 1) / 2 ))
  median="$(printf '%s\n' "$values" | sed -n "${mid}p")"

  printf '%-20s  min=%3ss  max=%3ss  avg=%3ss  median=%3ss  (n=%d)\n' \
    "$label" "$min" "$max" "$avg" "$median" "$count"
}

compute_stats "doc2md only" 2
compute_stats "Claude raw" 3
compute_stats "Claude+doc2md" 4
compute_stats "Codex raw" 5
compute_stats "Codex+doc2md" 6

printf '\nRaw data: %s\n' "$CSV"
printf 'Full logs: %s/run-*.txt\n' "$RESULTS_DIR"
