# 028 — Celebration: Mac PR CI Check
<!-- quest-id: mac-pr-ci-check_2026-04-24__1319 -->
<!-- pr: none -->
<!-- style: celebration -->
<!-- quality-tier: Diamond -->
<!-- date: 2026-04-24 -->

```
███╗   ███╗ █████╗  ██████╗
████╗ ████║██╔══██╗██╔════╝
██╔████╔██║███████║██║
██║╚██╔╝██║██╔══██║██║
██║ ╚═╝ ██║██║  ██║╚██████╗
╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝

██████╗ ██████╗
██╔══██╗██╔══██╗
██████╔╝██████╔╝
██╔═══╝ ██╔══██╗
██║     ██║  ██║
╚═╝     ╚═╝  ╚═╝

 ██████╗██╗
██╔════╝██║
██║     ██║
██║     ██║
╚██████╗██║
 ╚═════╝╚═╝
```

# Mac PR CI Check

🎉 🎯 🔒 🧪 ⚡️ 🏆 ✨

Quest `mac-pr-ci-check_2026-04-24__1319` is complete. The Mac desktop shell now has a pull request gate before Phase 5 release machinery gets anywhere near signing keys, notarization, or other sharp objects.

---

## Starring Cast

| Agent | Model | Role |
|---|---|---|
| Jean-Claude | `claude` | planner ........ The CI Plan Architect |
| Jean-Claude | `claude` | plan-reviewer-a ........ The Solo Plan Critic |
| Dexter | `gpt-5.4` | builder ........ The Workflow Pinning Technician |
| Dexter | `gpt-5.4` | code-reviewer-a ........ The Security Check Coroner |

Solo mode did exactly what it should: one approved plan, one implementation pass, one clean review. No fix loop. No drama hiding under the rug.

---

## Achievements Unlocked

⭐️ **Mac Regression Tripwire** — Pull requests against `main` now run the unsigned Release Mac build on `macos-latest`.

🔒 **No-Secret Surface** — The workflow uses `pull_request`, top-level `contents: read`, no `pull_request_target`, no environments, no `secrets.*`, and no `id-token`.

📌 **Pinned Action Discipline** — `checkout`, `setup-node`, and `upload-artifact` are all locked to full 40-character SHAs with readable tag comments.

🧪 **Three Failure Modes Covered** — Desktop bundle build, forbidden native API scan, and Xcode Release build all sit in the PR path.

📚 **Contributor Breadcrumb** — The Mac README now points directly at the workflow so nobody has to divine CI behavior from tea leaves.

---

## Impact Metrics

| Signal | Result |
|---|---|
| PR trust boundary | `pull_request` only, no secret-bearing trigger |
| Mac runner | `macos-latest` with full Release helper path |
| Action supply chain | 3 third-party actions SHA-pinned |
| Local review validation | manifest, `actionlint`, YAML parse, desktop build, permissions, trigger, secrets, SHA checks |
| Quest shape | 1 plan iteration, 0 fix iterations |
| Handoff reliability | 4/4 structured handoffs parsed |

---

## Handoff & Reliability Snapshot

All participating roles wrote parseable `handoff.json`. The Claude bridge was rate-limited during the resume, so build and review completed Codex-only, but the earlier plan artifacts remained structured and intact. The workflow did not need a fixer. That is not luck; that is a small, well-bounded change with the right tripwires.

---

## Quality Tier: 💎 Diamond

Zero review findings. Zero fix iterations. Static validation green. The local `npm run build:desktop` check passed during review. The remaining validations are necessarily PR-round-trip tests with temporary breakage commits, and the workflow is now in place to run them.

---

## Quote

> "Reviewer A found no blocking issues; manifest, actionlint, desktop build, security, and SHA-pinning checks passed."
>
> — Code Reviewer A

---

## Victory Narrative

This quest did not try to ship Phase 5b under a fake mustache. It put one sober gate in front of Mac-specific breakage: build the desktop bundle, run the helper that already knows the forbidden native API list, compile the Swift shell, and publish an unsigned app for inspection.

That is the kind of CI change I like: narrow, readable, hard to misuse, and quietly hostile to regressions.

— Jean-Claude, who is not often impressed but is today
