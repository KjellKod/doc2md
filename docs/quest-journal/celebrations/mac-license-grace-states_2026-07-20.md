<!-- quest-id: mac-license-grace-states_2026-07-16__1123 -->
<!-- style: celebration -->
<!-- quality-tier: Gold -->
<!-- date: 2026-07-20 -->
<!-- journal: ../mac-license-grace-states_2026-07-20.md -->
<!-- origin: step7-original -->

# Quest Celebration: Mac License Grace States

```text
███╗   ███╗ █████╗  ██████╗
████╗ ████║██╔══██╗██╔════╝
██╔████╔██║███████║██║
██║╚██╔╝██║██╔══██║██║
██║ ╚═╝ ██║██║  ██║╚██████╗
╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝

██╗     ██╗ ██████╗███████╗███╗   ██╗███████╗███████╗
██║     ██║██╔════╝██╔════╝████╗  ██║██╔════╝██╔════╝
██║     ██║██║     █████╗  ██╔██╗ ██║███████╗█████╗
██║     ██║██║     ██╔══╝  ██║╚██╗██║╚════██║██╔══╝
███████╗██║╚██████╗███████╗██║ ╚████║███████║███████╗
╚══════╝╚═╝ ╚═════╝╚══════╝╚═╝  ╚═══╝╚══════╝╚══════╝

 ██████╗ ██████╗  █████╗  ██████╗███████╗
██╔════╝ ██╔══██╗██╔══██╗██╔════╝██╔════╝
██║  ███╗██████╔╝███████║██║     █████╗
██║   ██║██╔══██╗██╔══██║██║     ██╔══╝
╚██████╔╝██║  ██║██║  ██║╚██████╗███████╗
 ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝

███████╗████████╗ █████╗ ████████╗███████╗███████╗
██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝██╔════╝
███████╗   ██║   ███████║   ██║   █████╗  ███████╗
╚════██║   ██║   ██╔══██║   ██║   ██╔══╝  ╚════██║
███████║   ██║   ██║  ██║   ██║   ███████╗███████║
╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚══════╝
```

---

## What Started This

Extend the Mac license state machine with grace and expired-reminder states. Goal: Implement Phase 1 of docs/implementation/mac-commercial-phase-7b-plan.md: extend the shipped license states in apps/macos/doc2md/Licensing/ with grace and expiredReminder, evaluated at moment of use from cached license state. No network code in this quest. Context: Read AGENTS.md first. Read docs/implementation/mac-commercial-phase-7b-plan.md (Phase 1 section is the contract for this quest). Read docs/implementation/mac-commercial-distribution-decision-record.md (Licensing Mechanics section) and the V1 Interim Issuer section of docs/implementation/mac-private-license-issuer-spec.md. Existing surface: LicenseState.swift, LicenseVerifier.swift (5-minute clock skew, hard expired result), LicenseReminderController.swift (save 10 then every 25, session scoped), LicenseController.swift. Scope in: 1. State evaluation as a pure function of (claims, now, lastValidatedAt): within 7 days before expires_at through 7 days after without successful revalidation -> grace; past that window -> expiredReminder. 2. expiredReminder re-enables the shipped reminder cadence and exposes a 'licensed conveniences paused' signal for later phases. 3. No timers, no background jobs; expiry happens when state is next read. 4. Unit tests for boundary times: 8/7/1 days before expiry, expiry instant, 1/7/8 days after, plus existing clock-skew behavior. Scope out: No network calls, no Polar client (Phase 2). No Document Library (Phase 3), no purchase UX (Phase 4). No change to the dormant Ed25519 verifier paths. No change to core document operations under any license state. Acceptance criteria: Phase 1 acceptance criteria in mac-commercial-phase-7b-plan.md, verbatim. Xcode unit tests green (apps/macos/doc2mdTests). npm run lint, npm run typecheck, npm test -- --run green for any touched src/desktop/ surface. npm run build:mac succeeds; manual File -> Open smoke passes.

## Starring Cast

- **arbiter** ........ The Judge
- **builder** ........ The Implementer

## Achievements

- [BUG] **Gremlin Slayer** — Tackled 4 review findings
- [TEST] **Battle Tested** — Survived 4 reviews
- [PLAN] **Plan Perfectionist** — Iterated plan 2 times
- [WIN] **Quest Complete** — All phases finished successfully

## Impact Metrics

- Review findings addressed: **4**
- Review rounds completed: **4**
- Plan iterations: **2**
- Fix iterations: **0**

## Handoff & Reliability

- Handoffs parsed: 2
- Reviewer handoffs: 0
- Fixer handoffs: 0
- Review findings tracked: 4
- Reliability signal: high

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## 🥇 Quality Tier: Gold

QUALITY SCORE
----------------------------------------
  [██████████████████░░] 90% (Grade: A)


## Quest Quote

> "No UX findings. The six required defaults remain in canonical order; Mac-only mobile relevance is justified; destructive actions are explicitly none; and empty, loading, and error behavior each receive exactly one concrete sentence."
>
> — Review finding

## Victory Narrative

Extend the Mac license state machine with grace and expired-reminder states. Goal: Implement Phase 1 of docs/implementation/mac-commercial-phase-7b-plan.md: extend the shipped license states in apps/macos/doc2md/Licensing/ with grace and expiredReminder, evaluated at moment of use from cached license state. No network code in this quest. Context: Read AGENTS.md first. Read docs/implementation/mac-commercial-phase-7b-plan.md (Phase 1 section is the contract for this quest). Read docs/implementation/mac-commercial-distribution-decision-record.md (Licensing Mechanics section) and the V1 Interim Issuer section of docs/implementation/mac-private-license-issuer-spec.md. Existing surface: LicenseState.swift, LicenseVerifier.swift (5-minute clock skew, hard expired result), LicenseReminderController.swift (save 10 then every 25, session scoped), LicenseController.swift. Scope in: 1. State evaluation as a pure function of (claims, now, lastValidatedAt): within 7 days before expires_at through 7 days after without successful revalidation -> grace; past that window -> expiredReminder. 2. expiredReminder re-enables the shipped reminder cadence and exposes a 'licensed conveniences paused' signal for later phases. 3. No timers, no background jobs; expiry happens when state is next read. 4. Unit tests for boundary times: 8/7/1 days before expiry, expiry instant, 1/7/8 days after, plus existing clock-skew behavior. Scope out: No network calls, no Polar client (Phase 2). No Document Library (Phase 3), no purchase UX (Phase 4). No change to the dormant Ed25519 verifier paths. No change to core document operations under any license state. Acceptance criteria: Phase 1 acceptance criteria in mac-commercial-phase-7b-plan.md, verbatim. Xcode unit tests green (apps/macos/doc2mdTests). npm run lint, npm run typecheck, npm test -- --run green for any touched src/desktop/ surface. npm run build:mac succeeds; manual File -> Open smoke passes. The quest finished with 2 plan iteration(s), 0 fix loop(s), and a persisted celebration artifact that future readers can open directly from the journal.
