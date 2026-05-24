#!/usr/bin/env bash
set -euo pipefail

RUN_MAC=1
MAC_ARGS=()

usage() {
  cat <<'USAGE'
Usage: validate-local.sh [--signed|--unsigned-only] [--skip-mac] [--wait-seconds N]

Run the full local PR validation suite:
  1. npm run lint
  2. npm run typecheck
  3. npm test -- --run
  4. npm run build
  5. npm run test:e2e
  6. python3 -m unittest discover -s tests/unit -p 'test_*.py' -v
  7. python3 scripts/security_ci_guard.py
  8. npm run validate:mac

By default the Mac step runs signed validation and fails loudly if Apple/Sparkle
credentials are missing. --signed is accepted as an explicit no-op for clarity.
Pass --unsigned-only to run the reduced Mac path, or --skip-mac only when Mac
validation is intentionally out of scope.
USAGE
}

note() {
  printf '\033[1;34m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*"
}

fail() {
  printf '\033[1;31mError:\033[0m %s\n' "$*" >&2
  exit 1
}

while (($#)); do
  case "$1" in
    --signed)
      MAC_ARGS+=("--signed")
      shift
      ;;
    --unsigned-only)
      MAC_ARGS+=("--unsigned-only")
      shift
      ;;
    --skip-mac)
      RUN_MAC=0
      shift
      ;;
    --wait-seconds)
      [[ $# -ge 2 ]] || fail "--wait-seconds requires a value"
      MAC_ARGS+=("--wait-seconds" "$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

note "1/8 Lint"
npm run lint

note "2/8 Typecheck"
npm run typecheck

note "3/8 Unit tests"
npm test -- --run

note "4/8 Build"
npm run build

note "5/8 Playwright e2e"
npm run test:e2e

note "6/8 Python unit tests"
python3 -m unittest discover -s tests/unit -p 'test_*.py' -v

note "7/8 Workflow/security guard"
python3 scripts/security_ci_guard.py

if ((RUN_MAC)); then
  note "8/8 Mac validation"
  npm run validate:mac -- "${MAC_ARGS[@]}"
else
  note "8/8 Mac validation skipped by --skip-mac"
fi

printf '\n'
printf '\033[1;32mLocal validation passed.\033[0m\n'
