# Mac Commercial Phase 7b Implementation Plan

Status: Ready (implementation-ready phase plan)
Owner: KjellKod <kjell@candidtalentedge.com>
Date: 2026-07-07
Roadmap: `ideas/mac-desktop-app-roadmap.md` Phase 7b
Related: [Decision record (amended 2026-07-07)](mac-commercial-distribution-decision-record.md), [Private issuer spec (deferred, v1 interim issuer section)](mac-private-license-issuer-spec.md), [Spin-off prompt and sharpen origin](../../ideas/commercial-pattern-spinoff-prompt.md)

## Summary

This plan sequences the in-repo work to make the Mac app sellable through Polar, following the decisions locked in the 2026-07-07 sharpen (diary: `docs/diary/2026-07-06.md`, `docs/diary/2026-07-07.md`):

- Polar merchant of record, Paddle fallback; Polar license keys are the v1 issuer.
- Single SKU: $20/yr auto-renewing subscription, cancel anytime, access until period end.
- One-time activation at license entry; revalidation only in the 14-day window around `expires_at` (7 before, 7 after); every licensing call non-blocking for document work.
- Degradation ladder `licensed → grace → expired-reminder`; reminders resume, licensed conveniences pause, core document operations never touched.
- First licensed convenience: the Document Library. Free tier keeps shipped recents and session restore.
- Purchases stay dark until explicit maintainer go-live approval.

## Human Prerequisites (out of repo, maintainer-owned)

| Step | Needed before | Notes |
|---|---|---|
| Polar account + org, sandbox mode | Phase 2 sandbox e2e (deferred validation, does not gate the Phase 2 merge) | Configure $20/yr subscription product with license keys enabled (activation limit, expiry from subscription period, revoke on cancellation). |
| Polar due-diligence sign-off | go-live | Business check: re-verify current Polar terms and fees. Findings go in the decision record Amendment Log. (The technical re-verification of the customer-portal endpoint auth model is in-repo work, already part of Phase 2's scope.) |
| `doc2md.dev` DNS + hosting | Phase 5 | Commercial pages surface. The Cloudflare Workers deploy-prep work builds the rails; see [Cloudflare Workers deployment](cloudflare-workers-deployment.md). |
| `support@doc2md.dev` | go-live | Must exist before taking money. |
| Go-live approval | Phase 6 | Explicit, recorded, per decision record. |

No phase below requires secrets in this repo. The app embeds no merchant tokens; Polar customer-portal calls are keyed by the license key itself.

## Phase 1: License state machine extension

Extend `apps/macos/doc2md/Licensing/` from the shipped `Licensed / Unlicensed / Invalid / License Check Failed` states to add `grace` and `expiredReminder`, evaluated at moment of use from stored license state. No network code in this phase.

In scope:

- State evaluation derives from cached claims **including Polar's key status** (`granted`, `revoked`, `disabled`), and the cached `expires_at` is authoritative: a successful validation affects state only through the snapshot it writes (a new `expires_at`, a new status). "Revalidated" never extends a license past its cached expiry.
- Before `expires_at` → `licensed`; the attempts in the 7 days before expiry are opportunistic renewal pickup, nothing more.
- After `expires_at`, never `licensed` from a stale snapshot: within 7 days after expiry with no post-expiry definitive answer → `grace` (a renewal may exist that we could not reach). A definitive post-expiry answer showing no renewal (`granted` with an unchanged past expiry, `revoked`, or `disabled`), or the end of those 7 days → `expiredReminder`.
- A cached `revoked` or `disabled` status (a definitive answer, unlike a network failure) preserves `licensed` through `expires_at` (cancellation keeps access until the paid period ends) but skips `grace` entirely: at `expires_at` the state goes straight to `expiredReminder`, so a revoked key can never remain licensed indefinitely.
- `expiredReminder` re-enables the shipped reminder cadence (`LicenseReminderController.swift`) and exposes a "licensed conveniences paused" signal for later phases.
- No scheduled timers or background jobs; expiry "happens" when state is next read.
- `expiredReminder` is not terminal: a later successful revalidation (Phase 2) refreshes the cached snapshot and the next state read returns `licensed`. Only a definitive `revoked`/`disabled` answer, or the user removing the license, ends the retry path.

Acceptance criteria:

- State transitions are pure functions of (claims, keyStatus, now, lastValidatedAt) and are unit-tested for boundary times: 8/7/1 days before expiry, expiry instant, 1/7/8 days after, plus the existing 5-minute clock-skew behavior, plus revoked-before-expiry and revoked-after-expiry cases, plus the two validation-recency traps: a pre-expiry validation with an unchanged `expires_at` must not extend `licensed` past expiry, and a post-expiry validation returning an unchanged past expiry must land in `expiredReminder`, not `grace`.
- `grace` and `expiredReminder` never block or delay open, edit, convert, save, or export.
- Existing verifier tests stay green; the dormant Ed25519 path is untouched.

Validation: Xcode unit tests (`apps/macos/doc2mdTests`), `npm run build:mac` and manual File → Open smoke, `npm run lint && npm run typecheck && npm test -- --run` for any `src/desktop/` surface touched.

## Phase 2: Polar activation client

Add the Polar customer-portal client and wire it to the license entry window.

In scope:

- License entry accepts a Polar license key; on entry the app calls `POST /v1/customer-portal/license-keys/activate` once, then stores the key + **the returned activation ID** in the non-syncing Keychain **only**. The Application Support fallback holds only non-secret cached validation metadata (key status, expiry, last-validated timestamp), never the raw key or activation ID: a Polar key is a reusable bearer credential, and the fallback file is exposed to backups and ordinary filesystem access. If the Keychain is unavailable, the app degrades to asking the user to re-enter the key (a re-enterable secret; loss is harmless re-entry). The activation ID is required for later validation of activation-limited keys.
- Revalidation calls (`/validate`) send key + activation ID and fire silently when the app is open and online: inside the 14-day window, and **also whenever the cached entitlement is already expired without a definitive answer** (throttled, once per launch or per day). The state stays `expiredReminder` until a validation succeeds; success refreshes the snapshot and the next state read returns `licensed`. Without this, a renewed customer who does not open the app during the window would stay expired forever.
- Timeout, offline, and 5xx failures are indistinguishable from "no network" to the user: no modal errors during document work, state degrades per Phase 1 ladder.
- No merchant secret, org token, or API credential in the app or repo. Confirm against live Polar docs during implementation; if the endpoints turn out to require any org credential, stop and re-plan (that would break the boundary).

Acceptance criteria:

- Activation, revalidation, and failure paths covered by tests against a mocked API; no test talks to live Polar.
- A licensed user can enter/restore a license without editing config files; key, activation ID, and validation snapshot all survive relaunch (existing acceptance carried forward, extended with the activation ID).
- Offline launch and all document operations work with the network cable pulled, in every license state.
- Security guard passes: `python3 scripts/security_ci_guard.py`.

Validation: mocked-API unit tests gate the Phase 2 merge. Sandbox end-to-end is deferred validation, run once the human prerequisite lands and required before Phase 4 purchase UX goes live: activate, relaunch, simulated expiry (crafted snapshot), renewal pickup, cancellation revoke.

## Phase 3: Document Library

The first licensed convenience. Desktop-only code (`apps/macos/`, `src/desktop/`), building on the existing `SessionStore` recents plumbing.

In scope:

- Unlimited history of opened/converted documents: name, path, last-touched timestamp, searchable, one click to reopen; persists across sessions.
- Free tier keeps the shipped short recents list and session restore, byte-for-byte unchanged behavior.
- Gating: recording new entries requires `licensed` or `grace`; browsing and reopening always work in every license state. In `expiredReminder` the library stays fully browsable and reopenable but stops recording new entries. Nothing is ever deleted by a license state change.
- MIT boundary: no license awareness enters shared `src/` code, `@doc2md/core`, or hosted-web behavior. New files carry `SPDX-License-Identifier: LicenseRef-doc2md-Desktop`.

Acceptance criteria:

- Library is not a conversion feature and no conversion behavior changes with license state (keeps `LICENSES/LicenseRef-doc2md-Desktop.txt` §6 true as written).
- Expired-state behavior tested: recording stops, browsing works, entries survive.
- Hosted web build output is unchanged (`npm run build` artifact diff clean for web surfaces).

Validation: `npm run lint && npm run typecheck && npm test -- --run`, Xcode tests, `npm run build:mac` + manual validation (open app, build library entries, flip license state via test hooks, verify gating).

## Phase 4: Purchase and registration UX scaffolding (inert until go-live)

In scope:

- Mac-only purchase affordances that visibly read as unavailable: no navigation, no data collection, no pricing promotion, per the decision record's go-live gate.
- Copy alignment pass across License window, About, reminders: "removes reminders and enables licensed conveniences", renewal transparency wording, recovery via `support@doc2md.dev`. Check against `LICENSES/LicenseRef-doc2md-Desktop.txt`, `docs/licensing.md`, root `LICENSE`.
- Honest security copy: never claim "we cannot read X" unless cryptographically true; licensing copy claims only what the offline-first design delivers.

Acceptance criteria: the decision record's "Purchase and registration UX follow-up acceptance criteria" section, verbatim.

Validation: UX review pass (`/ux-review`) on the license/purchase surfaces, copy cross-check against the three license documents, full test suite.

## Phase 5: Commercial docs on doc2md.dev

Privacy, terms, refund, support, license recovery, and license-delivery pages. Depends on the Cloudflare deploy-prep rails and `doc2md.dev` DNS (human prerequisite). Hosted web app at `kjellkod.github.io/doc2md/` stays silent about the paid Mac app; the GitHub README and `doc2md.dev` are the talking surfaces.

Acceptance criteria: the decision record's "Commercial docs follow-up acceptance criteria" section, plus: no page promises automatic restore, self-service lookup, accounts, or revocation polling.

## Phase 6: Go-live coordination

Maintainer-owned. Storefront live-mode readiness, support workflow documented, refund path documented, explicit approval recorded. Only after approval: enable purchase affordances, publish download/pricing links on `doc2md.dev`. Everything before this point ships dark.

## Sequencing and dependencies

```
Phase 1 (state machine)  ──► Phase 2 (Polar client) ──► Phase 4 (UX scaffolding) ──► Phase 6 (go-live)
                          └─► Phase 3 (Document Library, needs Phase 1 states) ──┘
Phase 5 (docs pages) runs parallel, gated on doc2md.dev DNS + Cloudflare rails
Polar sandbox account needed only for Phase 2's deferred e2e (gates no merge)
```

Phases 1 through 3 are individually small, reviewable PRs and can land without any human prerequisite. Each phase is a separate quest/PR; do not batch them.

## Out of scope

- Custom Ed25519 issuer implementation (deferred, v2 contingency in the issuer spec).
- Perpetual-until-next-major SKU (deferred; claim contract already supports it).
- Accounts, SSO, activation-seat UI, revocation polling, anti-tamper hardening.
- Mac App Store distribution.
- Any change to hosted web, `@doc2md/core`, or npm surface behavior.
