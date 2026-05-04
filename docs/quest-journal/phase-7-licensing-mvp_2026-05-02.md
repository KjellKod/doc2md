# Quest Journal: Quest Brief — Phase 7: Mac Commercial Distribution and Licensing

- Quest ID: `phase-7-licensing-mvp_2026-04-30__2240`
- Slug: phase-7-licensing-mvp
- Completed: 2026-05-02
- Mode: workflow
- Quality: Bronze
- Outcome: Phase 7: Mac Commercial Distribution and Licensing **Context:** - Branch: `phase-7-commercial-licensing`. - Roadmap source: `ideas/mac-desktop-app-roadmap.md` Phase 7. - Research source: `docs/impl...

## What Shipped

**Problem**: Phase 7 needs the smallest honest-user commercial distribution and licensing MVP for the Mac app without changing the free hosted web app, npm packages, shared converters, or document persistence semantics.

**Impact**: Mac users can keep using the app for free, enter/restore a paid ...

## Files Changed

- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_01_plan/plan.md`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_01_plan/arbiter_verdict.md.next`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_01_plan/review_findings.json.next`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_02_implementation/pr_description.md`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_02_implementation/builder_feedback_discussion.md`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_03_review/review_code-reviewer-a.md`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_03_review/review_code-reviewer-b.md`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_03_review/review_findings_code-reviewer-b.json`
- `.quest/phase-7-licensing-mvp_2026-04-30__2240/phase_03_review/review_fix_feedback_discussion.md`

## Iterations

- Plan iterations: 3
- Fix iterations: 2

## Agents

- **The Judge** (arbiter): 
- **The Implementer** (builder): 

## Quest Brief

Phase 7: Mac Commercial Distribution and Licensing

**Context:**
- Branch: `phase-7-commercial-licensing`.
- Roadmap source: `ideas/mac-desktop-app-roadmap.md` Phase 7.
- Research source: `docs/implementation/mac-commercial-distribution-and-licensing.md`.
- Domain decision: `doc2md.dev` has been purchased and should become the canonical Mac app commercial/download/support/licensing/update domain.
- Hosted web remains at `https://kjellkod.github.io/doc2md/` and must stay free, stateless, and independent.
- npm packages and shared conversion logic remain free.
- Current Mac app stack: Swift + WKWebView + Sparkle, with signed/notarized DMG release pipeline already documented and implemented.
- Current public repo remains public. License issuer, private signing key, merchant credentials, customer/license records, and commercial operations stay private.

**Goal:** Plan and implement the smallest Phase 7 MVP for Mac commercial distribution and honest-user licensing.

**Required scope:**
1. Finalize the distribution decision record:
   - direct signed/notarized DMG first
   - Mac App Store deferred unless there is a strong reason otherwise
   - hybrid path documented as future option
   - Lemon Squeezy first-choice merchant-of-record
   - Paddle fallback only, not dual-built for MVP
2. Document and/or configure the `doc2md.dev` public surface:
   - `doc2md.dev` for product/download/docs/pricing/privacy/terms/support
   - `updates.doc2md.dev` for Sparkle appcasts
   - `license.doc2md.dev` for private issuer API
   - `support@doc2md.dev` for support
   - `licenses@doc2md.dev` for license delivery
   - note `.dev` requires valid HTTPS from day one
3. Add Mac-only honest-user licensing model:
   - states: Licensed, Unlicensed, Trial/Grace, License Check Failed
   - offline signed license token verification
   - public verification key embedded in app
   - private signing key never in repo, app binary, or PR CI
   - license stored in Application Support or Keychain
   - no document contents sent to licensing provider
4. Add Mac-only license UX:
   - menu entry or About-window entry for Enter License
   - paste-token activation
   - visible license state
   - dismissible launch-time reminder/nag for unlicensed users
   - no reminders during edit, convert, open, save, or export
   - paid license suppresses reminders
5. Preserve hosted web behavior:
   - no license UI
   - no checkout UI
   - no localStorage/sessionStorage licensing
   - no dependency on Mac app or license issuer
6. Keep licensing offline-friendly:
   - license checks must not block open/edit/convert/save/export
   - failed network checks degrade to reminder or unchanged local state, never data loss
   - no machine-bound activation for MVP
7. Keep trust boundaries explicit:
   - public repo may contain verifier, token parser, public keys, tests, and nag UI
   - private issuer holds private signing key and signs customer tokens after verified purchases
   - release CI should not need the license-signing key
   - PR CI must never receive production secrets
   - Sparkle update keys and license-signing keys remain separate
8. Update docs:
   - `docs/implementation/mac-commercial-distribution-and-licensing.md`
   - `ideas/mac-desktop-app-roadmap.md` if implementation decisions change
   - `apps/macos/README.md` if user/developer release or license behavior changes
   - any privacy/support/license docs introduced by the implementation

**Acceptance criteria:**
- Hosted web does not advertise, require, or depend on paid Mac licensing.
- Mac app can run unlicensed with occasional respectful reminders.
- Licensed user can enter/restore a license without editing config files.
- License state survives relaunch.
- Offline launch and document editing still work.
- License verification uses public-key signature verification only.
- No private license-signing key, merchant API key, webhook secret, customer record, Apple secret, or Sparkle private key is committed.
- Release and PR workflows do not expose license issuer secrets to untrusted PR code.
- Pricing and purchase copy are simple and non-deceptive if introduced.
- Tax/sales operational ownership is documented before taking money.
- Existing open/save/import/conversion/Sparkle behavior remains unchanged except where explicitly required for licensing.

**Validation:**
- Run `npm test -- --run`.
- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run build:desktop`.
- Run `bash scripts/build-mac-app.sh --configuration Release`.
- Run `python3 scripts/security_ci_guard.py` if workflows, scripts, or secret-sensitive paths change.
- Add Swift/unit tests for license token parsing and verification if verifier code is implemented.
- Add React tests for license UI capability gating if UI is implemented.
- Manually smoke the Mac app:
  - unlicensed launch shows no destructive blocking
  - reminder is dismissible
  - license entry accepts a valid test token
  - invalid token fails safely
  - licensed state survives relaunch
  - hosted web shows no license UI

**Out of scope unless the plan proves otherwise:**
- Final public price.
- Final production merchant account launch.
- Production customer database with real customer data.
- App Store receipt validation.
- Server-side license API beyond private issuer planning/stub.
- Anti-tamper DRM.
- Machine-bound activation.
- Paid-only document features.
- Moving the Mac app into a private repo.
- Promoting the Mac app from the hosted web main page before the distribution plan is intentionally chosen.

**Constraints:**
- Keep changes focused and reviewable.
- Do not change converter behavior.
- Do not change document import/save semantics.
- Do not broaden filesystem entitlements unless explicitly justified.
- Do not store document contents in any licensing/persistence system.
- Do not commit secrets or placeholder values that look like real secrets.
- Prefer simple honest-user licensing over hard enforcement.

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/phase-7-licensing-mvp_2026-05-02.md`

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {
      "name": "arbiter",
      "model": "",
      "role": "The Judge"
    },
    {
      "name": "builder",
      "model": "",
      "role": "The Implementer"
    }
  ],
  "achievements": [
    {
      "icon": "[BUG]",
      "title": "Gremlin Slayer",
      "desc": "Tackled 4 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 5 reviews"
    },
    {
      "icon": "[PLAN]",
      "title": "Plan Perfectionist",
      "desc": "Iterated plan 3 times"
    },
    {
      "icon": "[WIN]",
      "title": "Quest Complete",
      "desc": "All phases finished successfully"
    }
  ],
  "metrics": [
    {
      "icon": "📊",
      "label": "Plan iterations: 3"
    },
    {
      "icon": "🔧",
      "label": "Fix iterations: 2"
    },
    {
      "icon": "📝",
      "label": "Review findings: 5"
    }
  ],
  "quality": {
    "tier": "Bronze",
    "grade": "B"
  },
  "inherited_findings_used": {
    "count": 0,
    "summaries": []
  },
  "findings_left_for_future_quests": {
    "count": 0,
    "summaries": []
  },
  "test_count": null,
  "tests_added": null,
  "files_changed": 12
}
```
<!-- celebration-data-end -->
