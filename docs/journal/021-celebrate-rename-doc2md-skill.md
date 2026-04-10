# 021 — Celebration: Rename doc2md Skill

<!-- quest-id: rename-doc2md-skill_2026-04-10__1020 -->
<!-- pr: #68 -->
<!-- style: celebration -->
<!-- quality-tier: platinum -->
<!-- date: 2026-04-10 -->

██████╗  ██████╗  ██████╗
██╔══██╗██╔═══██╗██╔════╝
██║  ██║██║   ██║██║
██║  ██║██║   ██║██║
██████╔╝╚██████╔╝╚██████╗
╚═════╝  ╚═════╝  ╚═════╝

███╗   ███╗██████╗
████╗ ████║██╔══██╗
██╔████╔██║██║  ██║
██║╚██╔╝██║██║  ██║
██║ ╚═╝ ██║██████╔╝
╚═╝     ╚═╝╚═════╝

🎉 🏆 🎯 ✨

## Quest

**Rename doc2md Skill**  
`rename-doc2md-skill_2026-04-10__1020`

The old name had overstayed its welcome. This quest aligned the portable skill, the hosted artifact, the install path, and the deployment story behind one name: `doc2md`. Better still, it removed a setup tax. The skill now bootstraps `@doc2md/core` for itself and the Pages deploy publishes both the immutable versioned tarball and the moving `latest` alias.

## Starring Cast

- `planner [Claude] ........ The Name Unifier`
- `plan-reviewer-a [Claude] ........ The Scope Razor`
- `plan-reviewer-b [GPT-5.4] ........ The Ambiguity Hunter`
- `arbiter [Claude] ........ The Calm Gatekeeper`
- `builder [GPT-5.4] ........ The Hoist Dodger`
- `code-reviewer-a [Claude] ........ The Contract Auditor`
- `code-reviewer-b [GPT-5.4] ........ The Import Surgeon`

## Achievements Unlocked

- ⭐️ **Alias Made Visible**: Pages now ships both `doc2md-core-<version>.tgz` and `doc2md-core-latest.tgz`, which is the sort of small operational honesty that prevents future confusion.
- 🔧 **Hoist Dodger**: The risky part of the plan was spotted before build. Static ESM import would have broken bootstrap; dynamic import landed instead.
- 📦 **Bundle Truthfulness Restored**: The portable skill, its package name, and the install page now point at `doc2md` and `doc2md-skill.skill` rather than a fossil from the old naming scheme.
- ⚡️ **First-Run Self-Healing**: New sessions no longer need a manual `@doc2md/core` install ceremony before doing useful work.

## Impact Metrics

- 📊 **2 hosted tarball paths** made explicit: immutable release artifact plus stable moving alias
- 🧪 **11/11 acceptance criteria** validated by both code reviewers
- 🛠️ **0 fix iterations** after build approval
- 🔒 **1 import-order footgun** neutralized before it shipped
- 🎯 **1 installer path** simplified for every fresh skill session

## Handoff & Reliability Snapshot

- Plan required **2 iterations**, and the second one was materially better for it
- Arbiter verdict moved the quest forward without another ceremonial rewrite
- Builder carried the rename across skill packaging, deployment, manifest wiring, and install UI
- Code review ended **clean approve / clean approve**
- Stability signal: medium-risk rename, no code-review blockers, no fixer pass required

## Quality Tier

**Platinum** 🏆

Not Diamond. The plan did need tightening and reviewer pressure found real gaps before implementation. But once corrected, the build landed cleanly, review stayed quiet, and the result improved both naming coherence and release ergonomics in one pass.

> "All 11 acceptance criteria verified, no blockers or must-fix issues, approve."

## Victory Narrative

This quest proved something worth keeping: naming consistency is not cosmetic when it crosses skill discovery, artifact hosting, and installation flow. A tool with three names is a support burden waiting patiently in the corner. A tool with one name, one self-healing bootstrap path, and one obvious release contract is much harder to misunderstand.

The repository is cleaner now. More importantly, the next person trying to install this thing gets fewer chances to wonder if they have found the wrong tarball, the wrong skill, or the wrong decade.

— Jean-Claude, who is not often impressed but is today
