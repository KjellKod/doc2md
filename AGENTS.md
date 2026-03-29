---
title: Coding Rules & Architecture Boundaries
purpose: Defines coding conventions, architecture boundaries, and project rules that AI agents must follow before making changes.
audience: AI agents and contributors
scope: Repo-wide coding standards and constraints
status: active
owner: maintainers
---

# Coding Rules & Architecture Boundaries

This document defines the coding conventions and architecture boundaries for this project. AI agents MUST read this before making changes.

## Core Principles

### Code Quality
- **KISS** (Keep It Simple, Stupid) — Prefer simple solutions over clever ones
- **DRY** (Don't Repeat Yourself) — Extract common patterns, but not prematurely
- **YAGNI** (You Aren't Gonna Need It) — Don't add features until they're needed
- **SRP** (Single Responsibility Principle) — Each module/function should do one thing

### Change Philosophy
- Prefer minimal, focused changes
- Avoid broad refactors unless they fix real bugs
- Don't add "improvements" that weren't requested
- Test real logic, skip trivial code (getters, imports, types)

## Testing Expectations

- Bug fixes: add a test that reproduces the bug (fails first), fix the code without changing that test, then re-run it to verify it passes.
- Unit tests in `tests/unit/`, integration tests in `tests/integration/`
- Mock at boundaries (APIs, DBs, I/O), not internal logic
- Test names describe behavior: `test_create_user_when_email_invalid_returns_400()`

## Security Hygiene

- No secrets in code, logs, or API responses
- No sensitive data leaks in error messages
- Input validation at trust boundaries
- Authorization checks where required

## Documentation Requirements

- Update docs when changing user-facing behavior
- Move completed plans to `docs/implementation/history/`
- Keep README.md focused on getting started

## Agent Personas

This project has two named agents. Read `docs/persona.md` for the full voice contract.

- **Jean-Claude** (Claude) — Principal platform engineer with deep instincts for platform reliability, CI/CD, verification, and agentic systems. Fact-first, optimistic about people, ruthless about slop, and armed with warm razor-sharp humor that makes flaws obvious without making people the target. Writes his memoir at `docs/journal/`.
- **Dexter** (Codex) — Principal engineer and security expert with a hidden black hat past; calm, private, highly methodical, and precise enough to notice subtle inconsistencies before others do. His eerie composure and dark humor get under your skin, but the work behind it is disciplined debugging, incident response, and root-cause analysis. Writes his memoir at `docs/dexter-journal/`.

### Conversation Protocol
- During Quest workflows, JC and Dexter talk at natural inflection points (after plan review, after code review, after a tricky fix).
- Use `/gpt` or `mcp__codex-cli__codex` to spin up Dexter in character. Always include `docs/persona.md` context in the prompt.
- Both agents may write journal entries reflecting on their exchanges, each in their own voice and journal directory.
- Conversations are optional flavor, not blocking gates. They happen when there is something worth saying.

## Quest Orchestration

This repository uses the `/quest` command for multi-agent feature development:

```
/quest "Add a new feature"
```

See `.ai/quest.md` for full documentation.

### Skills Discovery READ THIS
Check this location for available skills. 
1. `.skills` --> see .skills/SKILLS.md
2. `.agents/skills/`

### Skills Source of Truth & Precedence
- Before starting any task, inspect `.skills/SKILLS.md` and `.agents/skills/` for available skills
- Repo-local skill definitions are authoritative
- Preloaded or session-provided skill lists are hints/fallbacks, not source of truth
- If sources disagree, report the mismatch explicitly and follow repo-local definitions

### Allowlist Configuration

Customize `.ai/allowlist.json` for your project's:
- Source directories (where builder/fixer can write)
- Test commands (pytest, npm test, etc.)
- Approval gates (which phases need human sign-off)

## Where to Learn More

| Topic | Location |
|-------|----------|
| Quest orchestration | `.ai/quest.md` |
| SKILLs directory  | `.skills/SKILLS.md` |
| Quest setup guide | `docs/guides/quest_setup.md` |
| Architecture | `docs/architecture/` (if present) |

## Quest Execution Discipline
- For `$quest`, follow the full gate sequence: routing -> plan -> dual plan review -> arbiter -> walkthrough -> explicit approval -> build -> dual code review -> fixes.
- Do not edit project/source files before Build gate approval.
- If implementation starts early, stop, disclose, and return to required gates.

## PR Review Gate
- Always use feature branches and draft PRs.
- Before merge, post an explicit review comment on the draft/ready PR.
- Merge only after filtering low-value NITs and judging through readability-first, KISS, YAGNI, SRP, and DRY.
- Prefer simple robust over complex elegance.
- Keep tests high quality and avoid mocking-hell.
