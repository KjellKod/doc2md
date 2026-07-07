# Spin-off prompt: commercial distribution via the shared cross-app pattern

Status: executed 2026-07-07. The sharpen ran (solo pass 2026-07-06, joint session 2026-07-07; see `docs/diary/`), the decision record and issuer spec are amended, and the Phase 7b plan exists at `docs/implementation/mac-commercial-phase-7b-plan.md`. Kept for the research trail and the transferable lessons below.
Date: 2026-07-06
Origin: the shared "get paid" pattern was designed and locked in the sketch2md repo (private), `ideas/commercial-roadmap.md` §6 "Cross-product pattern". doc2md is the second app to adopt it.

> **Public-repo rule:** this repo is public. Keep merchant tokens, webhook secrets, signing keys, customer data, revenue detail, and issuer internals out of this repo entirely — the license issuer lives in a separate private repo/Worker per the accepted decision record.
>
> **How public connects to private:** at runtime over HTTPS only — this app ships the verifier (public key + validation client) and calls the issuer's API. Never link the private repo at the source level (no git submodule/"child repo": it breaks public clones/CI and leaks the private repo's existence). The private issuer is planned to be shared across the app family (extracted from the sketch2md billing module when needed); interim option: Polar's hosted license-key API as the issuer, requiring no private code at all initially.

---

## The prompt

You are working in the doc2md repo on Phase 7b (commercial distribution + license UX) of `ideas/mac-desktop-app-roadmap.md`. The cross-app monetization pattern has already been designed, decision-locked, and documented in the sketch2md repo (private): read `ideas/commercial-roadmap.md` there, especially §6 "Cross-product pattern", plus its worklog for the research trail. Apply it here as follows:

1. **Merchant of record: re-decide in light of new facts.** The accepted decision record (`docs/implementation/mac-commercial-distribution-decision-record.md`) chose Lemon Squeezy (preferred) / Paddle (fallback). Research from 2026-07 found Lemon Squeezy in post-acquisition transition (Stripe; "Stripe Managed Payments" is its successor, public preview Feb 2026) with reported onboarding/support degradation, and the sibling project selected **Polar.sh** as MoR primary (same 5%+50¢ fees; open-source; strong developer API; first-class **license keys** with activation limits, expiry, and auto-revoke — a direct fit for this app's offline license model). Amend the decision record: re-run the due-diligence checklist against Polar (and re-check Stripe Managed Payments GA status at that time), then record the outcome. Do not build against Lemon Squeezy without re-validating it first.
2. **License model stays as specced.** `docs/implementation/mac-private-license-issuer-spec.md` (Ed25519 signed tokens, public-key verifier in the app, private issuer Worker, offline-first, no accounts) remains the design. Evaluate whether Polar's license-key API can serve as the interim issuer (activation/validation calls from the app, cached offline with grace) before building the custom Ed25519 issuer — it may eliminate or postpone the private-issuer build. If the custom issuer is still wanted, the private issuer Worker pattern from the sketch2md repo's billing module is the starting point.
3. **Enforcement stays honest-user and offline-first.** Never require network to open/edit/convert/save/export; failed license checks degrade to reminders, never data loss. (Same rule the sibling apps follow.)
4. **Pricing:** the working hypothesis in the roadmap ($20/yr, optional perpetual-until-next-major) stands unless the maintainer says otherwise; keep prices configurable in the merchant dashboard, never hardcoded.
5. **Sequencing:** follow the existing Phase 7b checklist in `ideas/mac-desktop-app-roadmap.md` (merchant account, issuer, DNS, support email, go-live approval are maintainer-owned, out-of-repo steps). Purchases stay dark until explicit go-live.
6. **No accounts, no SSO** for doc2md v1 (per the issuer spec's explicit rejection). If accounts are ever wanted later, the sketch2md Worker's better-auth instance can act as the OAuth 2.1/OIDC provider (system-browser PKCE + loopback redirect) — do not build a second auth system.

Deliverable: an amended decision record + an implementation-ready phase plan for 7b in this repo's `docs/implementation/`, mirroring the phase/acceptance-criteria/test rigor of sketch2md's `ideas/commercial-roadmap.md`. Ask the maintainer before any irreversible or paid-account action.

## Transferable lessons from the sketch2md sharpen (2026-07-06)

1. **Entitlement liveness, checked at use time.** Model entitlement as one state enum (e.g. `trial | licensed | grace | expired-reminder`) and evaluate "is this allowed?" at the moment of use against the cached/validated license state — never with scheduled cleanup jobs. Expiry then "just happens" with zero moving parts.
2. **Recoverability ↔ secrecy dial.** Re-enterable secrets (license keys, API keys) may use strict cryptography where loss = harmless re-entry. Irreplaceable user data must never be hostage to crypto the user can forget. And never derive encryption keys from an email address — it's security theater.
3. **Honest security copy.** Only claim "we cannot read/decrypt X" when it is cryptographically true (user-held secret). For server/issuer-held keys the honest claim is "encrypted at rest". Keep the two phrasings straight in all user-facing copy.
4. **Graceful degradation is the brand.** Expired license → reminders and read-only-ish nudges, never blocked work or data loss (this repo's own stance — sketch2md's sharpen converged on the same rule independently; treat it as the family-wide invariant).

## Sharpen prompt (run this before planning 7b)

> /sharpen the doc2md commercialization decisions — `docs/implementation/mac-commercial-distribution-decision-record.md` + the Phase 7b section of `ideas/mac-desktop-app-roadmap.md` + `docs/implementation/mac-private-license-issuer-spec.md`. Pressure-test at least: (1) Lemon Squeezy → Polar.sh amendment — does Polar's license-key API (activation limits, expiry, auto-revoke) replace the custom Ed25519 issuer for v1, postpone it, or complement it? (2) pricing shape — $20/yr subscription vs perpetual-until-next-major vs both, and how each maps onto license-token claims; (3) trial/reminder mechanics — is the current "10 saves then every 25" reminder cadence the trial, or is a time-boxed trial cleaner? (4) offline grace duration and clock-rollback handling; (5) what the free web app may say about the paid desktop app without violating the strict free/paid decoupling rule. Come with a recommendation per question.
