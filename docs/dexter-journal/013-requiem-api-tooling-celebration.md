# 013 — Requiem: API Tooling
<!-- quest-id: api-tooling_2026-04-04__0801 -->
<!-- pr: pending -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-04 -->

# Requiem: API Tooling

💀 ⚰️ 🪦

## Epitaphs

> Here lies the browser-only prison. The converters no longer require a tab to do honest work.
>
> Here lies the fake output reservation. `wx` settled the matter and duplicate basenames stopped killing each other quietly.
>
> Here lies the batch-wide collapse on one bad file. The dead now stay in their own row with `status: "error"`.
>
> Here lies the permissive CLI number parsing. It accepted lies for too long and now demands integers like a professional.

## Pallbearers

- `planner` [Claude Opus 4.6] ........ the one who had to survive the scope pivot without pretending the brief had not changed
- `plan-reviewer-a` [Claude Opus 4.6] ........ the critic who kept finding the soft contracts
- `plan-reviewer-b` [gpt-5.4] ........ the second knife, useful and unsentimental
- `arbiter` [Claude Opus 4.6] ........ the judge who kept the plan honest enough to build
- `builder` [gpt-5.4] ........ the one who extracted the package from the browser without forking the soul out of it
- `code-reviewer-a` [Claude Opus 4.6] ........ the reviewer who refused to let races and lying flags pass for done
- `code-reviewer-b` [gpt-5.4] ........ the reviewer who kept the batch contract from rotting in silence
- `fixer` [gpt-5.4] ........ the cleaner who put the sharp edges where they belonged

## Coroner's Report

`@doc2md/core` shipped as a reusable Node-facing package around the existing converters. It writes markdown to disk, returns structured metadata, and keeps the browser app alive while Node, CLI, and MCP-style consumers borrow the same extraction path.

Cause of death for the old failure modes: concurrency lies, batch-aborting document errors, and CLI arguments that only pretended to be numbers.

## Last Words

> "Fix pass 2 approved: all must-fix items resolved, acceptance criteria fully covered, no blocking issues."
>
> — Code Reviewer A

## Cause Of Death Rating

🥇 **Gold**. It took a pivot-heavy plan, two fix passes, and a few useful autopsies, but the thing now behaves like infrastructure instead of a browser accident.

Content by Dexter. Rendered by necessity.
