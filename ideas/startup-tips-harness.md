# Startup tips harness

Status: proposed (follow-up PR). First surfaced while building the Markdown
file-association feature (PR #166), whose one-time "Make doc2md the Default
Markdown App" hint exposed both a bug and a missing system.

## Problem

doc2md has functionality people never discover. The file-association PR added
our first in-app hint, but its design is a dead-end:

- Suppression is a single boolean (`hasDismissedDefaultMarkdownAppHint`). Once
  dismissed, it is gone forever, with no way to bring it back.
- It does not generalize. A second tip would either reuse that one boolean (one
  dismissal silences everything) or add another ad-hoc boolean. Both rot.

We want a small, honest way to surface missed features: easy to silence one tip,
deliberately harder to go dark on all of them, and reversible.

## Goal

A minimal startup-tips registry. Not a framework. A list of tips and a couple of
persisted flags.

## Design

### Tip model
A tiny value type, one entry per tip:
- `id`: stable string (e.g. `default-markdown-app`). Never reused or renamed.
- `headline`: **required**, one eye-catching line. If a tip cannot earn a
  headline, it does not deserve to interrupt anyone.
- `body`: the explanation / steps.

No priority, no scheduling, no "tip of the day". The controller shows the first
eligible tip; that is the whole policy.

### Persisted state (native, UserDefaults, `com.kjellkod.doc2md`)
- `dismissedTipIDs: Set<String>` — tips the user has individually silenced.
- `startupTipsEnabled: Bool` — master switch, default `true`.
- Plus the existing once-per-launch in-memory guard (shipped in PR #166) so a
  window re-appearing does not re-show a tip within a session.

### Presentation rule
Show the next eligible tip when ALL of:
1. `startupTipsEnabled == true`, AND
2. tip `id` not in `dismissedTipIDs`, AND
3. no tip already shown this launch.

### Controls (the asymmetry is the point)
- **Per-tip (on the tip itself):** the only choice is "Don't show THIS tip
  again", which adds the tip's `id` to `dismissedTipIDs`. One click, cheap.
- **Global (Settings panel):** a "Show startup tips" toggle bound to
  `startupTipsEnabled`. Off suppresses all tips; reversible by toggling it back
  on. Turning the master back on does NOT un-dismiss individually-dismissed tips
  (simpler mental model); a separate "Reset tips" action is the only thing that
  would clear `dismissedTipIDs`, and it is optional / later.

Easy to silence one thing; going fully dark is a deliberate trip to Settings.

### Cross-stack wiring (this is why it is its own PR, not a tiny add)
- Tips are native SwiftUI; the Settings panel is the web layer
  (`WorkingModeBar`). The master `startupTipsEnabled` bool must therefore be
  exposed through a new `ShellBridge` settings handler, mirroring the existing
  `getPersistenceSettings` / `setPersistenceEnabled` pattern, so the web toggle
  can read and write it.
- `dismissedTipIDs` stays native; the web UI does not need it unless we add a
  "Reset tips" button (then a clear-handler).

### First consumer
Generalize `MarkdownDefaultAppHintPreferences` / `MarkdownDefaultAppHelpController`
into `StartupTipsPreferences` / `StartupTipsController`, with the existing default
-Markdown-app hint becoming tip `id = default-markdown-app`. No new tip content in
this PR; just the harness plus the one migrated tip.

## Tests
- Swift: per-id dismissal silences only that tip; master off suppresses all;
  master on shows non-dismissed tips; once-per-launch (already covered).
- TS: the Settings toggle renders, reflects the persisted value, and writes back
  through the bridge.

## Non-goals
Scheduling, priorities, tip-of-the-day, analytics, remote tip content.

## Scope
One follow-up PR. Native prefs + bridge handler + web Settings toggle + migrate
the one existing hint + tests on both sides. Build it next, with the
Markdown-default hint as the first consumer.
