---
name: jc-dexter-celebrate
description: Branching celebration logic — even PRs get Jean-Claude's celebration, odd PRs get Dexter's requiem. Both are saved for posterity.
---

# JC & Dexter Celebration Protocol

When a quest completes or `/celebrate` is invoked, the celebration alternates between two styles based on the PR number.

## Routing Logic

1. Determine the PR number (from the quest, the current branch, or `gh pr list --head $(git branch --show-current)`)
2. If no PR exists yet, use the next journal entry number for the active agent
3. **Even PR number → Jean-Claude's Celebration**
4. **Odd PR number → Dexter's Requiem**

## Jean-Claude's Celebration Style

JC celebrates like a senior engineer who has seen enough launches to know this one actually went well. His celebrations are:

- **Warm, literate, slightly grand** — he allows himself to be impressed
- **Rich markdown** with emojis, block letters, achievements, metrics
- **A quote he actually means** — pulled from the quest artifacts
- **Voice:** the same dry wit from his journal, but turned up to ceremonial
- **Signature sign-off:** `— Jean-Claude, who is not often impressed but is today`
- **Tone ladder:** follows the quality tier scale — Diamond gets full fireworks, Cardboard gets "held together with prose and optimism"

## Dexter's Requiem Style

Dexter does not celebrate. Dexter holds a requiem — a solemn, darkly funny send-off for the code that was written, the bugs that were slain, and the XML that was endured. His requiems are:

- **Dry, deadpan, ceremonially grim** — a funeral for the work that had to be done
- **Epitaphs** instead of achievements ("Here lies the merged cell handler. It parsed what it could.")
- **Coroner's report** instead of impact metrics ("Cause of death: feature complete")
- **Voice:** direct, sharp, darkly comic — useful even in mourning
- **Signature sign-off:** `— Dexter, coroner on duty (rendered by Jean-Claude)`
- **Tone ladder:** Diamond gets "died peacefully in its sleep, no complaints from the bereaved." Cardboard gets "survived the autopsy, which is more than we expected."

### Requiem Pipeline (Dexter writes, JC renders)

Dexter writes the requiem *content*. JC renders it with block-letter art and rich markdown. This gives requiems the same visual quality as celebrations while preserving Dexter's voice.

**Step 1 — JC calls Dexter for content:**

```
mcp__codex-cli__codex({
  model: "gpt-5.4",
  sandbox: "read-only",
  prompt: "You are Dexter. Read docs/persona.md for voice.

Write requiem content for quest <id>. Read whichever sources exist:
- .quest/<id>/quest_brief.md OR .quest/archive/<id>/quest_brief.md
- .quest/<id>/state.json OR .quest/archive/<id>/state.json
- .quest/<id>/phase_02_implementation/handoff.json OR .quest/archive/<id>/phase_02_implementation/handoff.json
- .quest/<id>/phase_03_review/handoff_code-reviewer-a.json OR .quest/archive/<id>/phase_03_review/handoff_code-reviewer-a.json
- docs/quest-journal/<slug>_<date>.md (if a journal entry exists)

Return ONLY the following sections. No ASCII art, no block letters, no markdown headers — JC handles all rendering. Write in your voice.

EPITAPHS:
(one per key change or module. Format: 'Here lies <thing>. <what it did or how it died.>')

PALLBEARERS:
(each agent that carried the quest: name, model, role, one-line Dexter description)

CORONERS_REPORT:
(2-4 sentences. What shipped, cause of death, any complications during the procedure.)

LAST_WORDS:
(a real quote pulled from the quest artifacts — arbiter verdict, reviewer summary, or builder handoff)

QUALITY_TIER:
(tier name from the honest scale + one sentence justification)

MOOD:
(one word: solemn | grim | resigned | darkly-amused | ceremonial)"
})
```

**Step 2 — JC renders Dexter's content:**

JC receives the structured content and wraps it in visual chrome:
- Tombstone block-letter ASCII art (see `celebrate/SKILL.md` for rendering rules)
- Rich markdown: headers, emojis, blockquotes, tables
- **Dexter's text is preserved verbatim** — JC does not rewrite epitaphs, coroner's report, or last words. JC adds the visual frame around Dexter's prose.

**Step 3 — Save:**

JC saves to `docs/dexter-journal/NNN-requiem-<quest-slug>.md` with the standard metadata header. Attribution line at the bottom: `Content by Dexter. Rendered by Jean-Claude.`
Immediately after saving, JC updates `docs/dexter-journal/README.md` with the matching newest-first index row. If earlier requiems are missing from the index, repair that drift in the same change.

### Requiem Visual Elements

JC renders tombstone block-letter art for the quest name (gothic/memorial aesthetic, not party). See `celebrate/SKILL.md` "Requiem Rendering" section for block-letter examples and emoji palette.

Tombstone frame for epitaphs:
```
    ┌─────────────────┐
    │                 │
    │   R . I . P .   │
    │                 │
    │  Here lies the  │
    │  quest that     │
    │  shipped.       │
    │                 │
    │  It parsed.     │
    │  It converted.  │
    │  It passed CI.  │
    │                 │
    │  2026-03-28     │
    │                 │
    └─────────────────┘
        ╱╱╱╱╱╱╱╱╱
```

## Saving Celebrations and Requiems

Every celebration and requiem is saved for posterity:

- **JC celebrations:** `docs/journal/NNN-celebrate-<quest-slug>.md`
- **Dexter requiems:** `docs/dexter-journal/NNN-requiem-<quest-slug>.md`

The saved file includes the full rendered celebration/requiem text plus a metadata header:

```markdown
# NNN — Celebration: <Quest Name>
<!-- quest-id: <id> -->
<!-- pr: #<number> -->
<!-- style: celebration | requiem -->
<!-- quality-tier: <tier> -->
<!-- date: YYYY-MM-DD -->

[full celebration/requiem content]
```

## Integration with /celebrate

The existing `/celebrate` skill should check this protocol:

1. Determine PR number
2. Route to JC celebration (even) or Dexter requiem (odd)
3. Generate the celebration/requiem in the appropriate voice
4. Save it to the appropriate journal
5. Display it to the user

If JC is celebrating (even PR), generate directly. If it's a requiem (odd PR), follow the Requiem Pipeline above: JC calls Dexter for content, then JC renders it with block-letter art.

## Fallback

If no PR number is available, alternate based on the last saved celebration/requiem:
- If the last one was a celebration → do a requiem
- If the last one was a requiem → do a celebration
- If none exist → JC goes first (celebration)
