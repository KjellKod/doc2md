#!/bin/bash
set -uo pipefail

# Quest SessionStart hook for Claude Code on the web.
# Keep startup deterministic: persist env state and perform non-fatal checks only.

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== Quest session-start: setting up web sandbox ==="

log() {
  echo "[session-start] $*"
}

warn() {
  echo "[session-start] WARNING: $*"
}

# --- OpenAI API Key ---
# If OPENAI_API_KEY is already in the environment (e.g. from sandbox config or
# GitHub environment secrets), persist it for the session. Never read from .env
# files — secrets come from the environment or not at all.
if [ -n "${OPENAI_API_KEY:-}" ]; then
  env_file="${CLAUDE_ENV_FILE:-}"
  if [ -n "$env_file" ] && touch "$env_file" 2>/dev/null; then
    printf "export OPENAI_API_KEY=%q\n" "$OPENAI_API_KEY" >> "$env_file" \
      || warn "Failed to append OPENAI_API_KEY to $env_file"
    log "OPENAI_API_KEY found in environment, persisted to session"
  else
    log "OPENAI_API_KEY found in environment"
  fi
else
  warn "No OPENAI_API_KEY in environment — Codex MCP reviews will be skipped"
fi

# --- Codex MCP server ---
if command -v codex >/dev/null 2>&1; then
  log "codex CLI available — Codex MCP server can be launched on demand"
else
  warn "codex CLI not found — Codex MCP server will be unavailable"
fi

# --- GitHub CLI (gh) ---
if command -v gh >/dev/null 2>&1; then
  log "gh CLI already available"
else
  warn "gh CLI not available — PR shepherd will be limited"
fi

# --- Shellcheck (linter for shell scripts) ---
if command -v shellcheck >/dev/null 2>&1; then
  log "shellcheck already available"
else
  warn "shellcheck not available (optional)"
fi

echo "=== Quest session-start: setup complete ==="
