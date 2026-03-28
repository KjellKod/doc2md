## 17:50 UTC - Quest Handoff: Session Moving to doc2md Repo Context

Context:
Full quest doc2md-ci-and-foundation_2026-03-28__0904 executed in the parent workspace (/Users/kjell/ws/extra). Session is moving to doc2md/ as the working directory. This entry captures everything the next session needs.

Human Inputs to Remember:
- User prefers commas over hyphens/dashes in prose
- User wants Jean-Claude as the default conversational voice, not a neutral assistant
- User wants Jean-Claude personality in PRs, PR comments, and all conversation
- User wants Dexter personality when Codex is used (CI reviews, builder, etc.)
- User prefers targeted PRs over monolithic delivery
- User prefers terse answers with no trailing summaries
- User asked for stacked PRs merged sequentially
- User wants cross-agent conversations between JC and Dexter at natural inflection points
- react-markdown + remark-gfm for preview (content trust decision, not cosmetic)
- 50MB file size limit for browser warning
- Binary test fixtures committed to repo (user-provided)

Changes Made (This Quest):
- Phase 1: Scaffolding + CI + agentic CI + branch protection (merged to main)
- Phase 2: Core UI shell + txt/json converters (PR #2, merged)
- Phase 3: CSV, TSV, HTML converters (PR #3, merged)
- Phase 4: DOCX, XLSX converters (PR #4, merged)
- Phase 5: PDF + PPTX converters with quality detection (PR #5, merged)
- Phase 6: Polish, batch UX, About, smoke tests (PR #6, merged)
- PR #7: Agentic CI test (merged, confirmed working with OPENAI_API_KEY)
- PR #8: Vite 6 + Vitest 3 vulnerability fix (open, JC commented, Dexter's review addressed)
- PR #9: GitHub Pages deploy + slim README + docs restructure (open, JC replied to all 4 Dexter comments, deploy workflow tightened)
- PR #10: Node 22 bump + PDF.js warning fix (open)
- CODEOWNERS: @KjellKod as default owner
- Branch protection: ci, secret-scan, workflow-guard, pr-body-gate required + code owner review
- Full agent infrastructure: .claude/, .codex/, .ai/, .skills/, .agents/, persona.md, diary, both journals

Open PRs:
- #8 fix/dependency-vulnerabilities — ready for owner approval
- #9 feat/pages-deploy-and-readme — ready for owner approval (needs Pages enabled in Settings)
- #10 feat/agent-personas — ready for owner approval

Security Notes:
- codex-ci-review environment configured with OPENAI_API_KEY
- Owner-only gate (KjellKod) verified working
- Deploy workflow gated to main-only with confirmation input
- SheetJS (xlsx) has unfixable prototype pollution advisory, client-side-only limits blast radius

Open Questions:
- GitHub Pages needs to be enabled: Settings → Pages → Source: GitHub Actions
- Chunk size warning from Vite build (dynamic imports would fix, future optimization)
- The ideas/markdown-editing-and-rendering-stack.md references docs2md not doc2md (historical naming)

Next Step:
Continue development in doc2md/ repo context. Three PRs awaiting merge. After that, manual walkthrough against README review checklist, then feature work.

Narrative Hook:
The foundation is laid, the CI is watching, and both agents have moved in. The building has tenants now.
