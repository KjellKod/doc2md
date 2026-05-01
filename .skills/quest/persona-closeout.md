# Persona Conversation and Closeout

Quest keeps product workflow mechanics in `delegation/workflow.md`, but the
personas need their own stable contract. Use this addendum whenever the
workflow calls for cross-agent conversation, and during Step 7 after the final
summary/context-health report and before `quest_complete.py` archives the quest
directory.

## Conversation Prompt Contract

Every conversation prompt must name a specific topic: the plan verdict, the code
review findings, the quest outcome, or another concrete inflection point. Do not
send generic "what do you think?" prompts.

Claude-led sessions invoke Dexter with `mcp__codex__codex`:

- Prompt identity: "You are Dexter. Read `docs/persona.md` for voice. Read
  `docs/dexter-journal/` and `docs/journal/` for history."
- Step 3 and Step 5 use `sandbox_permissions: "read-only"`.
- Step 7 may use `sandbox_permissions: "workspace-write"` so Dexter can write
  his own journal entry.

Codex-led sessions invoke Jean-Claude with
`python3 scripts/quest_claude_bridge.py` directly:

- Prompt identity: "You are Jean-Claude. Read `docs/persona.md` for voice. Read
  `docs/journal/` and `docs/dexter-journal/` for history."
- Step 3 and Step 5 pass `--add-dir .quest/<id>/logs` only, not the full repo.
- Step 3 and Step 5 prompts must include: "Do not write files outside
  `.quest/`. Log your response only."
- Step 7 may grant full repo access for memoir writes.

Do not use `quest_claude_runner.py` for conversations. It owns handoff polling
and context-health logging, which do not apply to persona conversation hooks.

## Completion Conversation

Run the Cross-Agent Conversation & Journaling Protocol from `workflow.md` with
the quest as a whole as the topic: what went well, what was hard, what each
agent would watch next. This is non-blocking. If the second model is unavailable
or the call fails, log the failure to `.quest/<id>/logs/conversation.log` and
continue.

## Memoir Entries

The active orchestrator writes its own memoir entry before PR ready/merge:

- Jean-Claude orchestrator: `docs/journal/NNN-<quest-slug>.md`
- Dexter orchestrator: `docs/dexter-journal/NNN-<quest-slug>.md`

If a cross-agent conversation happened during the quest, the other agent may
also write a memoir entry in its own directory. That second entry is optional:
write it only when the quest or conversation produced something worth keeping.

Numbering uses the next sequential number after the highest existing entry in
the matching journal directory.

After writing any memoir entry, update the matching README index immediately:

- Jean-Claude memoirs: prepend a row to `docs/journal/README.md`
- Dexter memoirs: prepend a row to `docs/dexter-journal/README.md`
- Row format: `| NNN | [Title](NNN-slug.md) | One-line theme |`

If a journal README has drifted and older files are missing from the index,
repair that drift in the same change before considering the memoir complete.

## Diary Entry

The active orchestrator writes or appends to `docs/diary/YYYY-MM-DD.md`.
The diary is operational, not literary. Include:

- Quest ID and outcome
- User preferences observed during the quest
- Corrections received
- Decisions made
- Cross-agent conversation summary, if any, referencing
  `.quest/<id>/logs/conversation.log`
- Open questions for the next session

## Bookkeeping Gate

Before marking a quest PR ready for review or merging a docs-only follow-up,
verify:

- `docs/quest-journal/<slug>_<YYYY-MM-DD>.md`
- `docs/quest-journal/README.md` row
- Orchestrator memoir entry in `docs/journal/` or `docs/dexter-journal/`
- Matching memoir README row
- `docs/diary/YYYY-MM-DD.md` entry

Do not treat the quest as fully closed until this bookkeeping pass is complete,
unless the user explicitly waives one of these artifacts.
