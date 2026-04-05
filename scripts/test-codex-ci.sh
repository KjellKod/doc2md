#!/usr/bin/env bash
set -euo pipefail

# Test Codex CI review locally with the same setup as the workflow.
# Usage: OPENAI_API_KEY=sk-... /tmp/test-codex-ci.sh

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "Error: OPENAI_API_KEY not set"
  exit 1
fi

echo "=== Step 1: Check API key ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY")
echo "API key check: HTTP $STATUS"
if [ "$STATUS" != "200" ]; then
  echo "API key is invalid or expired"
  exit 1
fi

echo ""
echo "=== Step 2: Test codex exec with a simple prompt ==="
echo "Summarize this in one sentence: Hello world" | \
  codex exec \
    --sandbox read-only \
    --output-last-message /tmp/codex-test-output.json \
    - 2>&1
CODEX_EXIT=$?

echo ""
echo "=== Results ==="
echo "Codex exit code: $CODEX_EXIT"

if [ -s /tmp/codex-test-output.json ]; then
  echo "Output file exists: $(wc -c < /tmp/codex-test-output.json) bytes"
  echo "Content:"
  cat /tmp/codex-test-output.json
else
  echo "No output file produced"
fi
