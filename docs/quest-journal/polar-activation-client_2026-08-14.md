# Quest Journal: Polar Activation Client

- Quest ID: `polar-activation-client_2026-08-09__2131`
- Slug: polar-activation-client
- Completed: 2026-08-14
- Mode: workflow
- Quality: Tin
- Celebration: [`celebrations/polar-activation-client_2026-08-14.md`](celebrations/polar-activation-client_2026-08-14.md)
- Outcome: Add the Polar activation client and wire it to the Mac license entry window. Goal: Implement Phase 2 of `docs/implementation/mac-commercial-phase-7b-plan.md`: the Polar customer-portal license clie...

## What Shipped

**Problem:** The Mac app has the shipped Phase 1 cached-entitlement state machine, but license entry still accepts dormant Ed25519 tokens and no Polar activation, validation, deactivation, credential split, retry policy, or recovery UI exists.

**User impact:** A packaged Mac build can activate a...

## Files Changed

- `.quest/polar-activation-client_2026-08-09__2131/phase_01_plan/arbiter_verdict.md.next`
- `.quest/polar-activation-client_2026-08-09__2131/phase_01_plan/review_findings.json.next`
- `.quest/polar-activation-client_2026-08-09__2131/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/polar-activation-client_2026-08-09__2131/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/polar-activation-client_2026-08-09__2131/phase_01_plan/plan.md`
- `.quest/polar-activation-client_2026-08-09__2131/phase_02_implementation/pr_description.md`
- `.quest/polar-activation-client_2026-08-09__2131/phase_02_implementation/builder_feedback_discussion.md`
- `.quest/polar-activation-client_2026-08-09__2131/phase_03_review/review_code-reviewer-a.md`
- `.quest/polar-activation-client_2026-08-09__2131/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/polar-activation-client_2026-08-09__2131/phase_03_review/handoff_code-reviewer-a.json`
- `.quest/polar-activation-client_2026-08-09__2131/phase_03_review/review_code-reviewer-b.md`
- `.quest/polar-activation-client_2026-08-09__2131/phase_03_review/review_findings_code-reviewer-b.json`
- `.quest/polar-activation-client_2026-08-09__2131/phase_03_review/review_fix_feedback_discussion.md`
- `apps/macos/doc2md/Licensing/LicenseController.swift`
- `apps/macos/doc2md/Licensing/PolarLicensePersistence.swift`
- `apps/macos/doc2mdTests/Licensing/PolarLicenseControllerTests.swift`
- `apps/macos/doc2mdTests/Licensing/PolarLicensePersistenceTests.swift`

## Iterations

- Plan iterations: 2
- Fix iterations: 3

## Agents

- **The Judge** (arbiter):
- **The Implementer** (builder):

## Quest Brief

Add the Polar activation client and wire it to the Mac license entry window.

Goal:
Implement Phase 2 of `docs/implementation/mac-commercial-phase-7b-plan.md`: the Polar customer-portal license client (`activate`, `validate`, `deactivate`), feeding the Phase 1 state machine that already shipped. Mocked-API tests gate this merge; sandbox e2e is deferred validation and is not part of this quest.

Context:

- Read `AGENTS.md` first.
- Read the Phase 2 section of `docs/implementation/mac-commercial-phase-7b-plan.md` in full. It is the contract for this quest and survived nine rounds of adversarial review; do not re-decide anything it locks.
- Read the V1 Interim Issuer section of `docs/implementation/mac-private-license-issuer-spec.md` and the Licensing Mechanics section of `docs/implementation/mac-commercial-distribution-decision-record.md`.
- Existing surface: `apps/macos/doc2md/Licensing/`. `LicenseState.swift` already has `grace(LicenseClaims)` and `expiredReminder(LicenseClaims)` with the 7-day grace period from Phase 1. `KeychainLicenseStore.swift` and `ApplicationSupportLicenseStore.swift` exist for storage. `LicenseWindow.swift` is the entry UI. `LicenseController.swift` orchestrates.

Scope in:

1. Polar customer-portal client:
   `POST /v1/customer-portal/license-keys/activate`, `/validate`, `/deactivate`. Both carry the public `organization_id` as build-time configuration. `/activate` sends a privacy-safe device label: generic hardware model plus a short persistent non-secret installation suffix, for example `MacBook Pro (14-inch) · 7Q2F`. The suffix is generated at first activation and stored with non-secret metadata in Application Support so it survives Keychain loss. Never send the personalized hostname or username.
2. Storage split: key plus returned activation ID in the non-syncing Keychain only. Application Support fallback holds only non-secret validation metadata: key status, expiry, and last-validated timestamp. It never stores the raw key or activation ID.
3. License entry flow: entering a Polar key triggers one `/activate`, caches the validated snapshot, then the state machine takes over. Activation-limit failure must show recovery guidance through Polar customer-portal self-service deactivation and `support@doc2md.dev`, never a bare or silent error.
4. Revalidation loop: `/validate` sends key plus activation ID, silently, only while the app is open and online. It fires inside the 14-day window around `expires_at`, and whenever cached entitlement is expired while key status remains `granted`, throttled once per launch or per day. Only `revoked` or `disabled`, or license removal, stops retries. An expired and unchanged `granted` answer ends grace but never the retry loop. Success refreshes the snapshot and the next state read returns licensed.
5. Removal and replacement: call `/deactivate` with key, `organization_id`, and activation ID, best-effort and non-blocking, before clearing local credentials. Offline removal still completes locally and surfaces an occupied-slot note with the Polar portal recovery path.
6. Failure semantics: timeout, offline, and 5xx are indistinguishable from no network. No modal errors during document work. State degrades through the Phase 1 ladder.
7. Verify against live Polar docs that customer-portal endpoints require no organization credential. If they do, stop and re-plan.

Scope out:

- No live Polar tests.
- No sandbox e2e.
- No purchase UX, checkout links, or pricing copy.
- No Document Library.
- No changes to dormant Ed25519 verifier paths.
- No merchant secrets, organization tokens, or API credentials anywhere in the repo.

Acceptance criteria:

- Mocked-API coverage of activation, revalidation, and failures, including late renewal: expired `granted`, then validation with a new `expires_at`, returns to licensed.
- Keychain-loss recovery: re-entry after simulated loss, and activation-limit failure shows Polar portal plus `support@doc2md.dev` guidance.
- Removal and replacement: online deactivates before clearing; offline clears locally without blocking and shows the occupied-slot note.
- Two same-model installations produce distinguishable device labels.
- Key, activation ID, and validation snapshot survive relaunch. License entry and restore require no configuration file edits.
- Offline launch and all document operations work with the network cable pulled, in every license state.
- `python3 scripts/security_ci_guard.py` passes.
- Xcode unit tests under `apps/macos/doc2mdTests` pass.
- If `src/desktop/` is touched: `npm run lint`, `npm run typecheck`, and `npm test -- --run` pass.
- `npm run build:mac` succeeds with a manual File to Open smoke.

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- Full celebration: [`celebrations/polar-activation-client_2026-08-14.md`](celebrations/polar-activation-client_2026-08-14.md)
- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/polar-activation-client_2026-08-14.md`

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {
      "name": "arbiter",
      "model": "",
      "role": "The Judge",
      "transport": "background-agent"
    },
    {
      "name": "builder",
      "model": "",
      "role": "The Implementer"
    }
  ],
  "claude_transport_counts": {
    "background-agent": 3
  },
  "achievements": [
    {
      "icon": "[BUG]",
      "title": "Gremlin Slayer",
      "desc": "Tackled 27 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 9 reviews"
    },
    {
      "icon": "[PLAN]",
      "title": "Plan Perfectionist",
      "desc": "Iterated plan 2 times"
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
      "label": "Plan iterations: 2"
    },
    {
      "icon": "🔧",
      "label": "Fix iterations: 3"
    },
    {
      "icon": "📝",
      "label": "Review rounds: 9"
    },
    {
      "icon": "🚌",
      "label": "Claude transport: background-agent ×3"
    }
  ],
  "quality": {
    "tier": "Tin",
    "grade": "T"
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
  "files_changed": 17
}
```
<!-- celebration-data-end -->
