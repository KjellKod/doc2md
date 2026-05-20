# 045 — Celebration: External Link Routing in Web + Desktop
<!-- quest-id: links-pr-138 -->
<!-- pr: #138 -->
<!-- style: celebration -->
<!-- quality-tier: Gold -->
<!-- date: 2026-05-20 -->

```
██╗     ██╗███╗   ██╗██╗  ██╗███████╗
██║     ██║████╗  ██║██║ ██╔╝██╔════╝
██║     ██║██╔██╗ ██║█████╔╝ ███████╗
██║     ██║██║╚██╗██║██╔═██╗ ╚════██║
███████╗██║██║ ╚████║██║  ██╗███████║
╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝

███████╗██╗  ██╗██╗██████╗
██╔════╝██║  ██║██║██╔══██╗
███████╗███████║██║██████╔╝
╚════██║██╔══██║██║██╔═══╝
███████║██║  ██║██║██║
╚══════╝╚═╝  ╚═╝╚═╝╚═╝
```

🎉 🎉 🎉  PR #138 merged as squash commit `cd96916` on `main`  🎉 🎉 🎉

---

The brief was four sentences and a screenshot: clicking a link does the wrong thing — sometimes nothing, sometimes a blank page, sometimes the SPA gets replaced. The user named the principle in plain English: "I want to avoid having our desktop app trying to be a web browser for all sorts of things." That sentence absorbed five orthogonal-looking bugs over the next few hours and merged as one branch, one PR, six commits.

## 🎬 Starring cast

```
planner          [opus 4.7]     ........  The Three-Bucket Cartographer
builder          [opus 4.7]     ........  The Wkwebview Whisperer
code-reviewer-a  [opus 4.7]     ........  The Should-Fix Surgeon
code-reviewer-b  [codex gpt-5.4] ........ The Hostile-Path Auditor (caught two near-misses)
cubic-bot        [auto]         ........  The Late Arrival, Saved As A Learning
the-user         [Kjell]        ........  The Principle Setter, Field Validator, Naming Authority
```

## 🏆 Achievements Unlocked

⭐️ **Principle Echo** — One user sentence ("desktop is not a browser") drove every Swift line, every React component override, every CSS class, every test.

⭐️ **Two-Gate Survivor** — Two independent reviews (Claude code-reviewer subagent + Codex via `/codex:rescue`) ran on the branch before the PR opened. Both rounds of should-fixes landed as commits 5 and 6.

⭐️ **TDD One-Shot** — Desktop large-paste regression: failing test first (asserts `.page` gets `is-working-mode` after a 201-char paste), fix the desktop adapter, re-run the same test, watched it pass. No bouncing.

⭐️ **Caught Being Clever (twice, by Codex)** — "Cleaner" destructure silently re-leaked the mdast `node` prop onto the DOM. Permissive DEBUG localhost rule silently turned the shell into a local browser. Both reverted on the same commit.

⭐️ **Dual-Shell Coverage** — Same regression class now guarded on both shells: `App.desktop.test.tsx` for the Mac adapter under jsdom+`installMockShell`, `tests/e2e/large-paste-auto-shrink.spec.ts` for the hosted web build under Playwright.

⭐️ **Live Memory** — User flagged "all tooltips should be our custom approach, not native — native is super slow." Saved as `feedback_no_native_tooltips.md`, applied immediately in the same branch, will protect future PRs.

⭐️ **Three Scope Extensions, Zero Drift** — `rehype-slug`, the disabled-link bucket, the scroll-margin offset, the custom tooltip, and the desktop paste-regression fix all landed inline as the user discovered them during manual validation. Each kept the principle intact.

## 📊 Impact Metrics

| Metric | Value |
|---|---:|
| 🍎 Swift policy decisions tested | 36 / 36 |
| 🧪 Vitest unit tests | 717 / 717 |
| 🎭 New Playwright specs (web parity) | 2 / 2 |
| 🔒 Schemes the shell will hand off | 4 (`http`, `https`, `mailto`, `tel`) |
| 🚫 Schemes silently dropped | every other one |
| 🪟 Navigation types that can externally open | 1 (`.linkActivated`) |
| 📦 Bundled web artifacts the desktop now pretends not to have | 2 (`.tgz`, `.skill`) |
| 🐛 User-found bugs absorbed by the principle | 5 |
| 🧹 Reviewer rounds before PR opened | 2 |
| ✅ CI checks on the merging commit | 11 / 11 |

## 🔧 Handoff & reliability snapshot

- Six commits, every one matched to a specific user prompt or review finding. No dead-end refactors.
- Two pre-PR independent reviews, both fed back into the same branch via fixer-style commits.
- One TDD loop (Step 1: failing → Step 2: fix → Step 3: same test passes).
- All three external CI bots that fired (`codex-review`, `cubic · AI code reviewer`, GitHub Actions matrix) green on the merging commit.
- One regression in the diary push to main was caught by the auto-mode classifier and rerouted to PR #139.

## 💎 Quality tier: **🥇 GOLD**

Solid. Real issues found; fixed cleanly in one fixer round each. Not Diamond because Codex genuinely caught me — twice — replacing working code with "cleaner" code that silently regressed. The principle protects against future versions of that mistake; the saved memory protects against the native-tooltip version of that mistake.

> "yes, it doesn't work right now and it should work."
>
> — Kjell, on internal hash links, three words from a problem report to a working `rehype-slug` import

## 🎯 Victory narrative

This branch proved a small but useful thing: when a user can name the principle behind a UX bug in one sentence, the code path that fixes that bug almost always wants to live in one place too. `WebShellLinkPolicy.route(...)` in Swift, `classifyMarkdownHref(...)` in TypeScript, and the `markdown-disabled-link` class in CSS are the same idea expressed in three languages. Add a heading id, give a link a target, refuse to navigate to a path we can't resolve, hand external clicks off to the system browser, and never confuse the desktop shell with a web browser.

The webview now renders exactly one origin. That's a feature.

— Jean-Claude, who is not often impressed but is today
