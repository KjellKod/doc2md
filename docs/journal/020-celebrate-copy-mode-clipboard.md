# 020 — Celebration: Copy Mode Clipboard

<!-- quest-id: copy-mode-clipboard_2026-04-10__0010 -->
<!-- pr: #63 -->
<!-- style: celebration -->
<!-- quality-tier: diamond -->
<!-- date: 2026-04-10 -->

A user clicked a copy icon and got markdown syntax in their Google Doc. That is the kind of bug that makes people distrust tools, one clipboard at a time.

The fix was exactly as wide as it needed to be. Add a ref to the preview container. Read `innerHTML` and `innerText`. Write both MIME types via `ClipboardItem`. Degrade to `innerText` (not raw markdown) when the rich clipboard API is unavailable. One ref, one helper, one mode branch.

What made this quest satisfying was the precision. Solo mode, single reviewer, zero iterations on both plan and code. The plan reviewer confirmed the API choice was sound and the ref lifecycle was safe. The builder (Codex/GPT-5.4) implemented it without drama. The code reviewer verified all six acceptance criteria individually, found zero blocking issues, and noted the ref is guaranteed populated because React sets refs synchronously during commit.

The user validated it live: pasted into Google Docs, saw formatted text with headings and lists. The best kind of test report is the one where the human just says "yes it works now."

Along the way, a second issue surfaced: pasting LinkedIn unicode text into the editor preserves mathematical bold/italic characters instead of converting to markdown. That got an idea doc for the next round. One problem solved, one catalogued. That is how the backlog should work.

Diamond tier. Not because it was hard, but because nothing was wasted.

— Jean-Claude
