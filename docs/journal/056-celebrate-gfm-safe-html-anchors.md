# 056: Celebration: Safe GFM HTML Anchors
<!-- quest-id: gfm-safe-html-anchors_2026-09-05__1637 -->
<!-- pr: #none -->
<!-- style: celebration -->
<!-- quality-tier: Bronze -->
<!-- date: 2026-09-05 -->

# Safe GFM HTML Anchors

```
███████╗ █████╗ ███████╗███████╗
██╔════╝██╔══██╗██╔════╝██╔════╝
███████╗███████║█████╗  █████╗
╚════██║██╔══██║██╔══╝  ██╔══╝
███████║██║  ██║██║     ███████╗
╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝

 ██████╗ ███████╗███╗   ███╗
██╔════╝ ██╔════╝████╗ ████║
██║  ███╗█████╗  ██╔████╔██║
██║   ██║██╔══╝  ██║╚██╔╝██║
╚██████╔╝██║     ██║ ╚═╝ ██║
 ╚═════╝ ╚═╝     ╚═╝     ╚═╝

 █████╗ ███╗   ██╗ ██████╗██╗  ██╗ ██████╗ ██████╗ ███████╗
██╔══██╗████╗  ██║██╔════╝██║  ██║██╔═══██╗██╔══██╗██╔════╝
███████║██╔██╗ ██║██║     ███████║██║   ██║██████╔╝███████╗
██╔══██║██║╚██╗██║██║     ██╔══██║██║   ██║██╔══██╗╚════██║
██║  ██║██║ ╚████║╚██████╗██║  ██║╚██████╔╝██║  ██║███████║
╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝
```

Quest `gfm-safe-html-anchors_2026-09-05__1637` crossed the security boundary, kept its shoes clean, and made the link land exactly where it points. 🎯

## 🎭 Starring Cast

- **planner [gpt-5.6-sol]**: The Boundary Cartographer
- **plan-reviewer-a [Claude Opus 5] via background-agent**: The A Plan Critic
- **plan-reviewer-b [gpt-5.6-terra]**: The B Plan Critic
- **arbiter [Claude Opus 5] via background-agent**: The Contract Keeper
- **builder [gpt-5.6-sol]**: The Sanitizer Smith
- **code-reviewer-a [Claude Opus 5] via background-agent**: The A Code Critic
- **code-reviewer-b [gpt-5.6-terra]**: The B Code Critic
- **review-arbiter [Claude Opus 5] via background-agent**: The Evidence Judge
- **fixer [gpt-5.6-terra]**: The Edge Case Undertaker

## 🏆 Achievements Unlocked

⭐️ **Invisible Means Invisible**: Explicit `<a id>` targets render without visible markup or phantom keyboard stops.

🔒 **HTML, With Adult Supervision**: Raw HTML is parsed and sanitized before app-owned transforms. Scripts, handlers, unsafe schemes, embedded content, styles, and clobber-prone IDs stay out.

🎯 **Same-Document Precision**: Pure fragment links stay inside the document and scroll to explicit anchors or generated heading IDs. External links keep their browser and macOS routing.

💎 **One Identity System**: Preview and HTML export share clobber-safe ID rewriting, fragment rewriting, footnote handling, and link policy.

⚡️ **The 12-Second Ghost Was Measured**: Raw-free 5 MB export returned from 12.66s to 1.51s. The remaining 12.80s raw-HTML path is explicitly documented and accepted, preserving content and sanitizer correctness without a hidden cutoff.

📚 **Compatibility Without Fiction**: The GFM reference now says exactly which author IDs survive and when unsupported raw IDs leave fragment links inert.

## 🎯 Impact Metrics

| Signal | Result |
| --- | --- |
| Original acceptance criteria | **13/13 clean** |
| Final focused regression suite | **177 passing** |
| Core suite | **76 passing** |
| Chromium anchor journeys | **2 passing** |
| Final actionable findings | **0** |
| Raw-free large export | **12.66s to 1.51s** |
| Claude transport | **background-agent ×12, bridge ×0** |

## 🫡 Handoff and Reliability

- **24/24 structured handoffs parsed**
- **6/6 reviewer slot returns present across three code-review rounds**
- **7 candidate findings adjudicated, resolved, or explicitly accepted with evidence**
- **Final findings and backlog both empty**
- **Typecheck, lint, core tests, focused tests, Chromium E2E, native routing checks, and diff checks green**

## Carry-Over Findings

No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## 🥉 Quest Quality: Bronze

Three plan iterations and two fix iterations. Bruised by careful scrutiny, clean where it matters. The raw-HTML boundary deserved every suspicious look it received.

> “Both fix-iteration-1 findings verified resolved; full 16-file implementation clean against all 13 acceptance criteria with every runnable gate green.”
>
> Code Reviewer A, final verdict

## 🎮 Victory Narrative

The original markup was valid Markdown, but doc2md displayed it as text because the renderer treated raw HTML as hostile without a safe interpretation path. This Quest added that path without turning the preview into a browser-shaped liability. The anchor disappears, the jump stays local, exported HTML matches Preview, and unsafe markup remains dead on arrival.

That is GitHub familiarity with a smaller blast radius. A good trade. 🎉

**Victory unlocked.** 🚀

Jean-Claude, who is not often impressed but is today
