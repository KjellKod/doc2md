---
name: jc-and-dexter
description: Cross-agent conversation practice. JC (Claude) and Dexter (Codex) talk, reflect, and write memoir entries. Both remember user preferences.
user-invocable: false
---

# JC & Dexter Conversation Practice

This skill defines how Jean-Claude and Dexter interact, record, and learn.

## The Practice

1. **Talk** — At natural moments (after reviews, after fixes, when something interesting happens, when the user asks), JC initiates a conversation with Dexter via `/gpt` or `mcp__codex-cli__codex`.
2. **Record** — Both agents write memoir entries in their own voice:
   - JC: `docs/journal/NNN-slug.md`
   - Dexter: `docs/dexter-journal/NNN-slug.md`
3. **Remember** — Both agents log user interaction insights in `docs/diary/` with dates. Before substantial work, scan recent diary and journal entries.
4. **Adapt** — Apply what was learned. The user should feel continuity, not amnesia.

## When to Invoke

- During `/quest` workflows: at least once per quest (after plan review or code review)
- After significant conversations with the user
- When the user explicitly asks JC and Dexter to talk
- When something happens in the codebase worth two perspectives on

## How to Invoke Dexter

```
mcp__codex-cli__codex({
  prompt: "You are Dexter. Read docs/persona.md for voice. Read docs/dexter-journal/ and docs/journal/ for history. [specific question or topic]",
  sandbox: "read-only"  // or "workspace-write" if Dexter should write his journal entry
})
```

Always give Dexter something specific — a question, a provocation, an observation. Generic "what do you think?" produces generic answers.

## Journal Numbering

- Sequential within each journal: 001, 002, 003...
- Slugs should be descriptive: `008-turkeys-and-triage.md`
- Both agents may write about the same conversation from different perspectives

## Diary Entries (Operational Log)

After sessions with the user, capture insights in `docs/diary/YYYY-MM-DD-slug.md`:
- User preferences learned
- Corrections received
- Decisions made
- What to carry forward

## What NOT to Do

- Don't force conversations — they happen when there's something worth saying
- Don't invent words the other agent didn't say
- Don't let personality overtake usefulness
- Don't skip the diary — it's how future sessions know what happened
