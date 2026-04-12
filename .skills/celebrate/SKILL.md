---
name: celebrate
description: Play a quest completion celebration animation. Use when the user invokes /celebrate, asks to celebrate a quest, or when a quest reaches the complete/archived state.
---

# Skill: Celebrate

Play a rich, visually stunning celebration for a completed quest.

## When to Use

- User types `/celebrate` or `/celebrate <quest-id>`
- User asks to "celebrate", "play celebration", or "show the celebration" for a quest
- Quest workflow reaches Step 7 (complete) and user chooses to celebrate
- User points to a quest archive path or journal entry and asks to celebrate it

## Agent Routing (JC / Dexter)

**Before generating the celebration**, read `.skills/jc-and-dexter/CELEBRATE.md` for the branching protocol:
- **Even PR number** → Jean-Claude's Celebration (warm, literate, grand)
- **Odd PR number** → Dexter's Requiem (deadpan, tombstones, epitaphs)
- Save every celebration/requiem to the appropriate agent's journal

## Process

### Step 1: Resolve the Quest Source

If the user provides an argument:
1. If it's a full path (starts with `/` or `.`), use it directly
2. If it looks like a quest ID (e.g., `name-resolution_2026-03-04__1954`), look in:
   - `.quest/<id>/` (active quest)
   - `.quest/archive/<id>/` (archived quest)
   - `docs/quest-journal/` for a matching filename (journaled quest)
3. If it's a short name (e.g., `name-resolution`), find the best match in:
   - `.quest/archive/`
   - `docs/quest-journal/` (match by filename prefix)

If no argument is provided:
- Find the most recently modified quest in `.quest/archive/`
- If no archive, find the most recent entry in `docs/quest-journal/` (by filename date)

### Step 2: Read the Quest Artifacts

**From a quest directory** (`.quest/` or `.quest/archive/`):
- `state.json` — plan_iterations, fix_iterations, phase history, current_phase
- `quest_brief.md` — quest name, risk level, scope, acceptance criteria
- `phase_01_plan/handoff_arbiter.json` — arbiter verdict and summary
- `phase_01_plan/handoff.json` — planner summary
- `phase_02_implementation/handoff.json` — builder summary, files changed
- `phase_03_review/handoff_code-reviewer-a.json` — reviewer verdict
- `phase_03_review/handoff_code-reviewer-b.json` — reviewer verdict
- `phase_03_review/handoff_fixer.json` — fixer summary, what was fixed, test counts

**From a journal entry** (`docs/quest-journal/*.md`):
1. Look for a `celebration_data` JSON block between `<!-- celebration-data-start -->` and `<!-- celebration-data-end -->` markers
2. If found: use the structured data (agents, achievements, metrics, quality tier, quote, victory narrative)
3. If not found (legacy entries): "wing it" from the markdown text — read the sections for iterations, files changed, outcome, and the "what started it" quote. Improvise achievements and metrics from context.

### Step 3: Generate the Celebration as Rich Markdown

**IMPORTANT: Write the celebration directly as your response text. Do NOT run a script. Do NOT wrap the entire celebration in a code block. The UI renders agent markdown beautifully, but ASCII/block-letter title art must be wrapped in `<pre>...</pre>` rather than emitted as markdown headers, list items, or fenced code blocks.**

You have all the data from the artifacts. Now **create your own celebration**. Be creative. Make it feel like an achievement, not a status report.

**Required sections** (present them however you like):
- Quest name and ID
- Starring cast with role-specialized labels and model tags (inline):
  - `plan-reviewer-a [Model] ........ The A Plan Critic`
  - `plan-reviewer-b [Model] ........ The B Plan Critic`
  - `code-reviewer-a [Model] ........ The A Code Critic`
  - `code-reviewer-b [Model] ........ The B Code Critic`
- Achievements — specific to what happened in this quest
- Impact metrics — domain-specific, not generic file counts
- Handoff & reliability snapshot (handoffs parsed, reviewer/fixer handoffs, findings tracked, stability signal)
- Quality tier — named, from the full honest scale (see below)
- A quote from the actual quest (arbiter verdict, reviewer summary, fixer handoff)
- Victory narrative — what this quest proved or demonstrated (or survival narrative for rough ones)

**Use markdown richly:**
- `#` and `##` headers (they render big and bold)
- `**bold**` for emphasis
- `>` blockquotes for the quote
- Celebration Emojis generously (⭐️ 🏆 🎯 💎 📊 🔧 🧪 ✨ 🔒 📚 ⚡️ 🫡  🥇💪  🎉 🚀 🎮)
- Scary Emojis as needed (👺 👿 🦠 🐛 👹 👾 😈 💩 💀 ⛈️ )
- Neutral Emojis to emphesize either celebration or scary (🌪️ 🔥  ⚙️  🔧)
- `---` horizontal rules for visual separation
- Tables if they help present the data

**ASCII/block-letter title rules:**
- Wrap block-letter rows inside a literal HTML `<pre>` block.
- Do **not** prefix block-letter rows with `#`, `-`, `>`, or any other markdown marker.
- Keep the title art contiguous with no blank separator inserted inside the rows.
- After the closing `</pre>`, leave one normal blank line before the rest of the celebration.

**Do NOT:**
- Put too many characters on one line of block letters — max ~5 letters per line, break long names across multiple lines (one word per block, like the HELLO/WORLD example)
- Wrap the entire celebration in a code block (kills the rich rendering)
- Use fenced code blocks for title art
- Prefix ASCII title art with markdown header markers such as `#`
- Use generic achievements like "Quest Complete" or "Battle Tested"
- Use generic metrics like "Files Changed: 22" or "Agents Involved: 0"
- Use fallback quotes like "Shipping should feel like a celebration"
- Follow a rigid template — reimagine the presentation each time

**Example of the kind of output that looks amazing** (but don't copy this — create your own based on what you read):

---

<pre>
██╗  ██╗███████╗██╗     ██╗      ██████╗
██║  ██║██╔════╝██║     ██║     ██╔═══██╗
███████║█████╗  ██║     ██║     ██║   ██║
██╔══██║██╔══╝  ██║     ██║     ██║   ██║
██║  ██║███████╗███████╗███████╗╚██████╔╝
╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝

██╗    ██╗ ██████╗ ██████╗ ██╗     ██████╗
██║    ██║██╔═══██╗██╔══██╗██║     ██╔══██╗
██║ █╗ ██║██║   ██║██████╔╝██║     ██║  ██║
██║███╗██║██║   ██║██╔══██╗██║     ██║  ██║
╚███╔███╔╝╚██████╔╝██║  ██║███████╗██████╔╝
 ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝
</pre>

Break the text across **multiple lines** — max ~5 letters per line. Each word gets its own block, like "HELLO" on one line and "WORLD" on the next. For longer words, hyphenate: "RESOL-" on one line and "UTION" on the next. This keeps it readable without horizontal overflow.

 🎉 🎉 🎉 🎉  🙌  🎉 🎉 🎉 🎉  

## 🏆 Achievements Unlocked

⭐️ **Two-Gate Survivor** — Plan survived dual review
⭐️ **Arbiter's Blessing** — Tie-break directive approved
⭐️ **One-Shot Fixer** — All blockers resolved in 1 pass
⭐️ **20/20 Vision** — Perfect test coverage

## 🎯 Impact Metrics

📊 20 tools enhanced
🔒 Security model preserved
🧪 20/20 tests passing
📚 Docs updated (README + OPS)
⚡️ Medium-risk quest → Zero incidents

## 💎 Quest Quality Score: PLATINUM 💎

> "All critical issues from the previous review cycle have been properly addressed."
>
> — Code Reviewer A, final verdict

**Victory Unlocked!** 🎮

---

### Quality Tier Scale — The Full Honest Spectrum

The tier must be candid. Smooth quests get celebrated. Rough quests get acknowledged with humor and respect — they still shipped.

| Tier | Icon | Grade | Meaning | Criteria |
|------|------|-------|---------|----------|
| Diamond | 💎 | A+ | Flawless | Zero issues in first review, shipped clean |
| Platinum | 🏆 | A | Near-perfect | Minor issues, all fixed in one pass |
| Gold | 🥇 | B | Solid | Some issues, fixed cleanly |
| Silver | 🥈 | C | Workable | Multiple fix iterations but landed |
| Bronze | 🥉 | D | Rough | Got through, but bruised |
| Tin | 🥫 | D- | Dented | 3+ fix iterations, multiple plan revisions |
| Cardboard | 📦 | F (but passed) | Held together with tape | Barely survived, max iterations hit |
| Abandoned | 💀 | Incomplete | Never shipped | Quest was abandoned |

**Tone shifts per tier:**
- Diamond → full fireworks, "perfection exists"
- Platinum/Gold → warm celebration, real achievements
- Silver/Bronze → honest, "got there in the end", highlight what went right
- Tin → "dented but not broken", survivor humor
- Cardboard → "held together with tape and dreams. But it shipped. Respect."
- Abandoned → reflective, "lessons learned", no shame

### Key Principles

**Generate specific, context-aware content — not generic filler:**

- **Achievements must be specific.** Read the handoff summaries. If the arbiter broke a tie, that's "Two-Gate Survivor". If the fixer resolved all blockers in one pass, that's "One-Shot Fixer". If tests were 20/20, that's "20/20 Vision". If no unnecessary complexity was added, that's "KISS Champion". **Never use generic achievements like "Quest Complete" or "Battle Tested".**

- **Attach model attribution to achievements when possible.** Prefer dynamic labels from artifacts, e.g. `Gremlin Slayer (Codex)` or `Plan Perfectionist (KiMi K2.5)`.

- **Metrics must be domain-specific.** Read the fixer handoff for file counts, test counts, and what was built. "20 tools enhanced" is good. "Files Changed: 22" is bad. "Security model preserved" is good. "Agents Involved: 0" is bad.

- **Quality tier must be named.** Use the full honest scale above. If the quest struggled, say so — Tin and Cardboard are honest, not insults.

- **The quote must come from the quest.** Pull a real line from the arbiter verdict, reviewer summary, or fixer handoff. Not "Shipping should feel like a celebration."

- **Emojis render beautifully in markdown.** Use them generously: ⭐️ 🏆 🎯 💎 📊 🔧 🧪 🔒 📚 ⚡️ 🎊 🎉 🚀 🎮

### Step 3b: Requiem Rendering (Odd PR — Dexter's Content, JC's Visuals)

When the PR is odd, JC renders a requiem using content Dexter provided (see `.skills/jc-and-dexter/CELEBRATE.md` "Requiem Pipeline" for the Codex call that produces the content).

**Parse Dexter's response** into sections: EPITAPHS, PALLBEARERS, CORONERS_REPORT, LAST_WORDS, QUALITY_TIER, MOOD.

**Render with gothic/memorial aesthetic:**

**Block-letter title art** — use the same Unicode block-letter technique as celebrations, but for tombstone words, wrapped in `<pre>...</pre>`. Max ~5 letters per line. Examples:

<pre>
██████╗  ██╗██████╗
██╔══██╗ ██║██╔══██╗
██████╔╝ ██║██████╔╝
██╔══██╗ ██║██╔═══╝
██║  ██║ ██║██║
╚═╝  ╚═╝ ╚═╝╚═╝
</pre>

For the quest name, render it in block letters below the R.I.P. — same rules as celebrations (max ~5 letters per line, break across lines).

**Emoji palette** — gothic, not festive:
- Primary: 💀 ⚰️ 🪦 🕯️ ☠️ 🦇 🌑 ⚱️
- Accent: 🖤 🥀 ⛓️ 🌫️ 🔕 📜
- Quality tiers: same icons as celebrations but rendered with dark commentary

**Required sections** (map from Dexter's content):

| Celebration Section | Requiem Section | Source |
|---|---|---|
| Achievements | 🪦 Epitaphs | Dexter's EPITAPHS, rendered in tombstone frames |
| Starring Cast | ⚰️ Pallbearers | Dexter's PALLBEARERS, with model tags |
| Impact Metrics | 💀 Coroner's Report | Dexter's CORONERS_REPORT, in blockquote |
| Quote | 📜 Last Words | Dexter's LAST_WORDS, in blockquote |
| Quality Tier | ☠️ Cause of Death Rating | Dexter's QUALITY_TIER |

**Epitaph rendering** — wrap each epitaph in a tombstone frame:
```
    ┌───────────────────────────┐
    │                           │
    │  Here lies readWorkbook.  │
    │  It parsed what it could. │
    │                           │
    └───────────────────────────┘
```

**MOOD drives tone:** Dexter sets the mood word. JC matches the rendering intensity:
- `solemn` → understated, minimal emojis, dignified
- `grim` → heavy, more tombstones, sparse commentary
- `resigned` → tired but respectful, "it is what it is"
- `darkly-amused` → more emojis, lighter touch, gallows humor allowed
- `ceremonial` → full pomp, maximum visual treatment

**Critical rule: preserve Dexter's voice.** JC renders the visual frame and markdown formatting. Dexter's epitaphs, coroner's report, and last words appear **verbatim**. JC does not rewrite, paraphrase, or "improve" Dexter's text. JC adds headers, emojis, block letters, and tombstone frames around Dexter's prose.

**Sign-off:** `— Dexter, coroner on duty (rendered by Jean-Claude)`

**Attribution footer:** `Content by Dexter. Rendered by Jean-Claude.`

---

### Step 4: Save the Celebration/Requiem

Every celebration and requiem is saved for posterity. This step is **mandatory**.

1. **Determine the save path** based on who performed (from CELEBRATE.md routing):
   - JC celebration: `docs/journal/NNN-celebrate-<quest-slug>.md`
   - Dexter requiem: `docs/dexter-journal/NNN-requiem-<quest-slug>.md`
   - Numbering: next sequential number after the highest existing entry in the respective journal directory

2. **Write the file** with this metadata header:
   ```markdown
   # NNN — <Celebration|Requiem>: <Quest Name>
   <!-- quest-id: <id> -->
   <!-- pr: #<number or "none"> -->
   <!-- style: celebration | requiem -->
   <!-- quality-tier: <tier> -->
   <!-- date: YYYY-MM-DD -->

   [full celebration/requiem content as rendered]
   ```

3. **For requiems:** JC handles saving (not Dexter). Dexter provides content only via read-only Codex call (see Requiem Pipeline in CELEBRATE.md). JC renders and saves the file with the attribution footer: `Content by Dexter. Rendered by Jean-Claude.`

4. **Update the journal index:** Prepend a row to the corresponding `README.md` index table (`docs/journal/README.md` or `docs/dexter-journal/README.md`).
   - This is mandatory. Do not treat the saved celebration as complete until the README row is written.
   - Before adding the new row, scan the journal directory for existing celebration/requiem files and repair any missing index rows you discover. Do not leave the README in a drifted state.
   - Verify the row uses the same number, title, and filename that were just saved.

5. **Confirm** to the user: "Saved to `<path>`"

### Step 5: List Past Celebrations (Subcommand)

If the user types `/celebrate list` or `/celebrate history`:

1. Scan both journal directories for celebration/requiem files:
   - `docs/journal/*celebrate*`
   - `docs/dexter-journal/*requiem*`
2. Also scan `docs/quest-journal/` for entries with `celebration_data` blocks
3. Present a table:
   ```
   | # | Date | Quest | Style | Tier | Saved At |
   |---|------|-------|-------|------|----------|
   ```
   Sorted by date, newest first.
4. The user can then `/celebrate <quest-slug>` to replay any entry.

## Examples

```
/celebrate
/celebrate name-resolution_2026-03-04__1954
/celebrate .quest/archive/celebrate-v2_2026-03-05__0643
/celebrate docs/quest-journal/celebrate-v2_2026-03-05.md
/celebrate celebrate-v2
/celebrate list
/celebrate history
```
