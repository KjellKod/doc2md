# 035 — Celebration: Phase 7b Issuer Spec
<!-- quest-id: phase-7b-issuer-spec_2026-05-06__0822 -->
<!-- pr: none -->
<!-- style: celebration -->
<!-- quality-tier: gold -->
<!-- date: 2026-05-06 -->

```
██████╗ ██╗  ██╗ █████╗ ███████╗███████╗
██╔══██╗██║  ██║██╔══██╗██╔════╝██╔════╝
██████╔╝███████║███████║███████╗█████╗
██╔═══╝ ██╔══██║██╔══██║╚════██║██╔══╝
██║     ██║  ██║██║  ██║███████║███████╗
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝

██╗███████╗███████╗██╗   ██╗███████╗██████╗
██║██╔════╝██╔════╝██║   ██║██╔════╝██╔══██╗
██║███████╗███████╗██║   ██║█████╗  ██████╔╝
██║╚════██║╚════██║██║   ██║██╔══╝  ██╔══██╗
██║███████║███████║╚██████╔╝███████╗██║  ██║
╚═╝╚══════╝╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
```

# Phase 7b Issuer Spec

## Starring Cast

| Role | Model | Credit |
|---|---|---|
| planner | GPT-5.5 | The Boundary Cartographer |
| plan-reviewer-a | Claude | The Continuity Critic |
| plan-reviewer-b | GPT-5.5 | The Scope Auditor |
| code-reviewer-a | Claude then Codex fallback | The Contract Surgeon |
| code-reviewer-b | GPT-5.5 | The Clean-Room Inspector |

## Achievements Unlocked

⭐️ **PR #108 Preserved** — the new spec inherits the commercial decision instead of quietly rewriting it.

🔒 **Private Means Private** — signing keys, merchant credentials, webhook secrets, customer/license records, and issuer data stayed outside the public repo.

📚 **Boundary Made Useful** — token claims, lifecycle fields, support/admin lookup, and offline-first verification now have a public contract.

🔧 **One Precise Fix** — `token.merchant.merchant` became `token.merchant.provider`, and the contract stopped looking like it had tripped over its own shoelaces.

## Impact Metrics

- 1 focused issuer spec added.
- 2 existing Phase 7b documents pointed at it without becoming copies of it.
- 11 acceptance criteria mapped.
- 3 plan iterations absorbed the important uncertainty before docs changed.
- 1 fix loop, 0 remaining review findings.

## Handoff And Reliability Snapshot

- Planner, reviewers, arbiter, builder, fixer, and re-review all produced handoffs.
- Claude bridge silence was handled by artifact checks and real runner timeouts.
- Claude usage limit during final re-review fell back to Codex without losing the review gate.
- Final canonical review backlog: empty.

## Quality Tier: Gold

This was not Diamond because the plan had to sharpen twice and the first review caught one real naming ambiguity. It earns Gold because the uncertainty was handled before implementation, the fix was small, and the final review came back clean.

> "Re-reviewed the issuer-spec fix; code-reviewer-a-001 is resolved and no remaining blocker or must-fix issues were found."
>
> — Code Reviewer A fallback, final verdict

## Victory Narrative

This quest did not build a license issuer. That restraint was the work. It drew the line between public verifier and private authority, between support lookup and app entitlement, between future business models and today's token contract. The result is a spec future quests can stand on without dragging merchant secrets, customer records, or accidental infrastructure into daylight.

— Jean-Claude, who is not often impressed but is today
