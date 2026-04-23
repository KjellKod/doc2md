#!/usr/bin/env bash
set -euo pipefail

WAIT_SECONDS="3"

usage() {
  printf 'Usage: %s [--wait-seconds N]\n' "$(basename "$0")"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

validate_wait_seconds() {
  local value="$1"

  case "$value" in
    ''|*[!0-9]*)
      fail "--wait-seconds must be an integer from 0 to 60"
      ;;
  esac

  if ((10#$value > 60)); then
    fail "--wait-seconds must be between 0 and 60"
  fi

  WAIT_SECONDS="$((10#$value))"
}

quit_with_osascript() {
  osascript -e 'tell application "doc2md" to quit' >/dev/null 2>&1 &
  local osascript_pid=$!
  local waited=0

  while kill -0 "$osascript_pid" >/dev/null 2>&1; do
    if ((waited >= 3)); then
      kill "$osascript_pid" >/dev/null 2>&1 || true
      wait "$osascript_pid" >/dev/null 2>&1 || true
      return
    fi

    sleep 1
    waited=$((waited + 1))
  done

  wait "$osascript_pid" >/dev/null 2>&1 || true
}

cleanup() {
  local rc=$?
  trap - EXIT INT TERM

  if [[ -n "${LOG_STDERR_FILE:-}" && -e "$LOG_STDERR_FILE" ]]; then
    rm -f "$LOG_STDERR_FILE"
  fi

  # Only tear down the instance this script launched. If doc2md was already
  # running before we started, the preflight check would have refused to run,
  # so reaching cleanup implies we own the process.
  if [[ "${WE_LAUNCHED_DOC2MD:-0}" -eq 1 ]]; then
    quit_with_osascript
    sleep 1

    if pgrep -f 'doc2md.app/Contents/MacOS/doc2md' >/dev/null 2>&1; then
      # Graceful quit can hang when AppleScript/Accessibility permissions are missing; this cleans up the launched binary as a last resort.
      pkill -f 'doc2md.app/Contents/MacOS/doc2md' >/dev/null 2>&1 || true
    fi
  fi

  exit "$rc"
}

while (($#)); do
  case "$1" in
    --wait-seconds)
      [[ $# -ge 2 ]] || fail "--wait-seconds requires a value"
      validate_wait_seconds "$2"
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && /bin/pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && /bin/pwd)"
BUILD_HELPER="$REPO_ROOT/scripts/build-mac-app.sh"

trap cleanup EXIT INT TERM

# Refuse to run when a doc2md instance is already live. The cleanup path quits
# and (as last resort) pkills the app, which would close an unrelated session
# and drop unsaved work. Make the user quit it first, then rerun.
if pgrep -f 'doc2md.app/Contents/MacOS/doc2md' >/dev/null 2>&1; then
  fail "doc2md is already running. Quit it (including any other copies of the app) and rerun this script. It refuses to proceed because cleanup would terminate a doc2md session it did not launch, potentially losing unsaved work."
fi

WE_LAUNCHED_DOC2MD=0

if ! BUILD_OUTPUT="$("$BUILD_HELPER")"; then
  printf '%s\n' "$BUILD_OUTPUT" >&2
  fail "Mac app build failed"
fi

printf '%s\n' "$BUILD_OUTPUT"

BUILT_LINE="$(printf '%s\n' "$BUILD_OUTPUT" | awk '/^Built: / { line = $0 } END { print line }')"
if [[ -z "$BUILT_LINE" ]]; then
  fail "build helper did not print a final Built: line"
fi

APP_PATH="${BUILT_LINE#Built: }"
if [[ ! -d "$APP_PATH" ]]; then
  fail "build helper returned a missing app path: $APP_PATH"
fi

# Anchor the log query to this invocation. Without a start timestamp, `log show
# --last Ns` reads the rolling window and can pick up a previous launch's
# `load succeeded` entry, masking a currently broken launch. Capture local
# time just before `open -na`; `log show --start` parses this format and
# interprets it in the host's timezone.
LAUNCH_START="$(date '+%Y-%m-%d %H:%M:%S')"
open -na "$APP_PATH"
WE_LAUNCHED_DOC2MD=1
sleep "$WAIT_SECONDS"

if ! pgrep -f 'doc2md.app/Contents/MacOS/doc2md' >/dev/null 2>&1; then
  fail "doc2md process is not running after ${WAIT_SECONDS}s"
fi

LOG_STDERR_FILE="$(mktemp)"
LOG_STATUS=0
LOG_OUTPUT="$(log show --start "$LAUNCH_START" --predicate 'subsystem == "com.kjellkod.doc2md"' --style compact 2>"$LOG_STDERR_FILE")" || LOG_STATUS=$?
LOG_STDERR="$(cat "$LOG_STDERR_FILE" 2>/dev/null || true)"
rm -f "$LOG_STDERR_FILE"
unset LOG_STDERR_FILE

case "$LOG_OUTPUT" in
  *"load failed"*|*"bundle missing"*)
    fail "doc2md web content failed to load. Log output: $LOG_OUTPUT"
    ;;
  *"load succeeded"*)
    printf 'Launch OK: web content loaded\n'
    ;;
  *)
    # No success or failure token appeared. Do not silently pass. Common causes:
    # log delivery slower than the wait window, missing log access permission,
    # subsystem string drift, or the app crashed before logging. Surface what
    # we know and fail so the developer can diagnose.
    printf 'INCONCLUSIVE: no load signal from subsystem com.kjellkod.doc2md within %ss of launch.\n' "$WAIT_SECONDS" >&2
    if ((LOG_STATUS != 0)); then
      printf 'log show exit status: %s\n' "$LOG_STATUS" >&2
    fi
    if [[ -n "$LOG_STDERR" ]]; then
      printf 'log show stderr:\n%s\n' "$LOG_STDERR" >&2
    fi
    fail "launch smoke could not verify web content rendered. Rerun with a larger --wait-seconds if log delivery was slow, or check log access permissions."
    ;;
esac
