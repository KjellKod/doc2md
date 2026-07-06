# Spin-off prompt: commercial distribution via the shared cross-app pattern

Status: ready-to-run prompt (paste into an agent session in this repo when starting Phase 7b commercial work)
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
