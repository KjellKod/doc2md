# Quest Journal: LinkedIn Block Art (Abandoned)

**Quest ID:** linkedin-block-art_2026-04-13__2232
**Date:** 2026-04-13 to 2026-04-14
**Branch:** linkedin
**Mode:** Solo
**Outcome:** Abandoned. PR #76 closed.

## Summary

Attempted to make ASCII block art (figlet-style banners) render correctly when copied from doc2md's LinkedIn view and pasted into LinkedIn posts. The feature worked perfectly in the in-app preview (monospace rendering), but LinkedIn posts use a proportional sans-serif font where block characters have varying widths, making pixel-perfect alignment impossible with Unicode spacing alone.

## What We Built

- `isBlockArt()` detection with three signals: art characters, non-alphanumeric density, visually aligned lines
- Figure-space (U+2007) replacement for block art in fenced code blocks and `<pre>` blocks
- Language hint negative signal to skip detection for typed code blocks (```bash, etc.)
- Zero-width markers for monospace rendering in the in-app LinkedIn preview
- Canvas-based character width measurement against LinkedIn's font stack
- Per-column alignment compensation for the copy-to-clipboard path
- Em-space (U+2003) substitution matching block character width (~14px)
- Character normalization (═ to █) to reduce cumulative drift

## Why It Was Abandoned

LinkedIn posts render in a proportional font where:
- `█` (full block) = 14.00px
- `═` `║` `╔` `╗` `╚` `╝` (box-drawing) = 13.75px
- `▓` (dark shade) = 13.75px
- Em space (U+2003) = 13.85px (closest available gap character)
- Ideographic space (U+3000) = collapsed by LinkedIn

No Unicode space character exactly matches the 14px block width. Normalizing all characters to █ gives perfect alignment but loses all visual detail (solid black rectangles). Keeping detail characters introduces 0.25px/character drift that compounds across lines.

The feature hit a hard ceiling: pixel-perfect block art alignment in a proportional font is not achievable with Unicode spacing. The result was recognizable but not publication-quality.

## Key Learnings

1. LinkedIn posts use `-apple-system, system-ui, "Segoe UI", Roboto` font stack
2. LinkedIn collapses ideographic space (U+3000) in single-space gaps
3. Em space (U+2003) is the widest space LinkedIn preserves reliably
4. Canvas `measureText()` accurately predicts local rendering but LinkedIn's server-side font resolution may differ
5. The approach would work perfectly if LinkedIn supported `<code>` or monospace font in posts (it does in articles, not posts)

## Files Changed (on abandoned branch)

- `src/components/linkedinFormatting.ts` (block art detection)
- `src/components/linkedinFormatting.test.ts` (16 new tests)
- `src/components/linkedinBlockArtAlign.ts` (compensation engine)
- `src/components/PreviewPanel.tsx` (monospace rendering, copy handler)
- `src/styles/global.css` (block-art CSS class)

## Agents

| Role | Model | Runtime |
|------|-------|---------|
| Planner | claude-opus-4-6 | claude |
| Plan Reviewer A | claude | claude |
| Builder | gpt-5.4 | codex |
| Code Reviewer A | claude | claude |

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "solo",
  "agents": [
    {"name": "Planner", "model": "claude-opus-4-6", "role": "planner"},
    {"name": "Plan Reviewer A", "model": "claude", "role": "plan-reviewer-a"},
    {"name": "Builder", "model": "gpt-5.4", "role": "builder"},
    {"name": "Code Reviewer A", "model": "claude", "role": "code-reviewer-a"}
  ],
  "achievements": [
    {"icon": "🔬", "title": "Font Forensics", "desc": "Measured every block character width in LinkedIn's font stack"},
    {"icon": "🎯", "title": "0.15px Ceiling", "desc": "Found the theoretical minimum drift for em-space alignment"},
    {"icon": "💀", "title": "Killed by Proportional", "desc": "LinkedIn's proportional font made pixel-perfect alignment impossible"},
    {"icon": "🧪", "title": "12 Iterations", "desc": "Tried per-column, micro-correction, segment-based, ideographic space, character normalization"}
  ],
  "metrics": [
    {"icon": "📊", "label": "14.00px vs 13.75px: the gap that killed us"},
    {"icon": "🧪", "label": "59 tests passing across 12 commits"},
    {"icon": "🔍", "label": "7 Unicode space characters tested"},
    {"icon": "⚡️", "label": "Solo quest, 0 fix iterations, abandoned post-review"}
  ],
  "quality": {"tier": "Abandoned", "icon": "💀", "grade": "Incomplete"},
  "quote": {"text": "not usable until it's pixel perfect", "attribution": "Kjell"},
  "victory_narrative": "The quest proved that proportional fonts and block art are fundamentally incompatible. The knowledge is banked for when LinkedIn adds monospace support.",
  "test_count": 59,
  "tests_added": 16,
  "files_changed": 5
}
```
<!-- celebration-data-end -->
