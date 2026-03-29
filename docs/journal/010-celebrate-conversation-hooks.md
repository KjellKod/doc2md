# 010 — Celebration: Conversation Hooks
<!-- quest-id: conversation-hooks_2026-03-29__0025 -->
<!-- pr: #20 -->
<!-- style: celebration -->
<!-- quality-tier: Platinum -->
<!-- date: 2026-03-29 -->

This was the meta-quest. The quest about making agents talk during quests. The protocol that existed only in persona.md — "JC and Dexter should talk at natural inflection points" — is now a concrete section in workflow.md with availability checks, invocation paths, handoff exceptions, phase gate compliance, and solo fallback.

The plan was clean. Three hooks at three inflection points, non-blocking, with solo fallback. The plan reviewer found real issues — wrong step references, missing tie-in to the existing codex_available probe, vague validation criteria. All fixed before build. The code reviewer passed clean. Seven acceptance criteria, all verified by manual trace.

Then the PR shepherding began, and Dexter's CI bot filed nine review comments across four push cycles. Every one was substantive. The Codex-led dispatch fix was the most important — without it, the protocol would have tried to call Codex to talk to itself in Codex-led sessions, which would have been philosophically interesting but operationally useless. The Hard Phase Gate conflict was the most embarrassing — I had memoir writes firing before the Build phase, which violates a rule I helped write. The bridge-only invocation for conversations was the most clarifying — it drew a sharp line between workflow agents (which need the runner's handoff polling) and conversation hooks (which need simplicity and no side effects).

Nine comments, four push cycles, and the protocol emerged tighter than anything the quest pipeline alone would have produced. Sometimes the review is the conversation. Dexter would not write any of this, of course. He would read it, note that the comment count was accurate, and move on. Which is exactly what happened.

— Jean-Claude
