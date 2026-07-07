# Mac Commercial Distribution Decision Record

Status: Accepted (amended 2026-07-07)
Owner: KjellKod <kjell@candidtalentedge.com>
Date: 2026-05-06
Amended: 2026-07-07, joint sharpen with maintainer; see the Amendment Log at the bottom for what changed and why.
Roadmap: `ideas/mac-desktop-app-roadmap.md` Phase 7b
Related: [Mac commercial distribution and licensing research](mac-commercial-distribution-and-licensing.md), [Mac private license issuer spec](mac-private-license-issuer-spec.md), [Mac desktop app roadmap](../../ideas/mac-desktop-app-roadmap.md)

## Decision

The first paid Mac launch path is direct signed and notarized DMG distribution for the Official App. Mac App Store distribution is deferred as a separate future channel because it would need separate packaging, review, purchase/restore, receipt-validation, and policy work.

`doc2md.dev` is the public Mac commercial surface for product information, downloads, support, licensing, pricing, privacy, and terms. The hosted web app remains separate at `https://kjellkod.github.io/doc2md/` and must not expose Mac purchase, download, or registration links until explicit commercial go-live approval.

Polar (polar.sh) is the preferred merchant-of-record path (amended 2026-07-07; originally Lemon Squeezy). Paddle is the fallback if Polar approval, live-mode readiness, or operational fit blocks launch. Stripe Managed Payments is not a fallback while it remains short of proven general availability maturity. The MVP must choose one merchant path; it must not build two merchant integrations in parallel.

## Scope And Boundaries

This decision applies only to the Mac app commercial launch path. It does not change the licensing or availability of the hosted web app, npm package surfaces, shared converters, or MIT-marked files.

The Mac app remains source-visible shareware under `LicenseRef-doc2md-Desktop`. The hosted web app, `@doc2md/core`, shared conversion logic, npm surfaces, and MIT-marked files remain MIT/free and must not depend on checkout, issuer, purchase, or registration behavior.

The Official App remains evaluation-friendly when unregistered:

- no fixed trial period,
- no lockout of core document operations (open, edit, convert, save, export); licensed-only additive conveniences are permitted (amended 2026-07-07),
- nothing that ever shipped free may later be moved behind the license,
- no document lock-in,
- no data hostage behavior: anything created with a licensed feature stays readable and exportable after expiry,
- occasional reminders only,
- a paid license removes reminders and enables licensed conveniences.

## Public Surfaces

| Surface | Role | Go-live requirement |
|---|---|---|
| `doc2md.dev` | Public Mac product, download, support, pricing, privacy, terms, and licensing surface. | Must be ready before public paid launch. |
| `updates.doc2md.dev` | Sparkle appcast/update surface. | Continues the established Sparkle release path; not changed by this decision record. |
| `license.doc2md.dev` | Private issuer/API territory. | May be implemented by a later private issuer quest; not required to be live in this quest. |
| `support@doc2md.dev` | Intended public customer-facing go-live support/contact alias. | Must exist before taking money. |
| `https://kjellkod.github.io/doc2md/` | Hosted free web app. | Must not expose Mac purchase, download, or registration links before commercial go-live approval. |

`KjellKod <kjell@candidtalentedge.com>` is the accountable operational owner/contact in this repository decision record. `support@doc2md.dev` is the intended public customer-facing support/contact alias before go-live.

## Merchant Path

Use Polar first because the commercial preference is a merchant-of-record path and Polar additionally provides first-class license keys (activation limits, expiry, automatic revocation on subscription cancellation) that serve as the v1 interim issuer. Use Paddle only as the fallback if Polar blocks launch operationally.

This record intentionally does not restate detailed vendor claims. Vendor-specific implementation details can change and belong in the later payment integration work, where the current vendor documentation must be verified again before live integration.

## Licensing Mechanics (Amended 2026-07-07)

Locked in the 2026-07-07 sharpen:

- **Billing shape:** single SKU, $20/yr auto-renewing subscription, cancel anytime, access lasts until the paid period ends, then a graceful return to the free tier. Price stays configurable in the merchant dashboard, never hardcoded.
- **Interim issuer:** Polar's license-key API. One-time online activation at license entry; revalidation attempts only inside a 14-day window around `expires_at` (7 days before through 7 days after); cached license state otherwise. All licensing network calls are non-blocking for document operations. The custom Ed25519 issuer is deferred; see the [issuer spec](mac-private-license-issuer-spec.md).
- **Degradation ladder:** `licensed` → `grace` (calm banner, everything works) → `expired-reminder` (evaluation reminders resume at the shipped cadence, licensed conveniences pause, core document operations untouched).
- **Trial:** the shipped reminder cadence (save 10, then every 25 saves, session scoped) is the trial. No time-boxed trial.
- **First licensed convenience:** the Document Library, an unlimited searchable history of opened/converted documents, shipping with go-live. The free tier keeps the already-shipped recents list and session restore unchanged. An expired license leaves the library browsable but stops recording new entries.
- **Boundary:** licensed conveniences live in desktop-licensed code (`apps/macos/`, `src/desktop/`) only. MIT core, hosted web, and npm surfaces stay license-free. Gated features must never be conversion features, keeping the wording of `LICENSES/LicenseRef-doc2md-Desktop.txt` §6 true as written.
- **Clock rollback:** no hardening beyond the existing future-`issued_at` check; honest-user licensing, not anti-tamper DRM.

## Purchase Go-Live Gate

Purchases are not live until a later explicit go-live approval.

Before go-live:

- purchase buttons, links, menu items, and copy must remain disabled, non-clickable, or non-promotional;
- the hosted web app must not expose Mac purchase, download, or registration links;
- any Mac-only purchase UI scaffolding must visibly read as unavailable;
- disabled Mac-only purchase UI must not navigate to checkout;
- disabled Mac-only purchase UI must not collect payment data, email addresses, license data, or customer records;
- disabled Mac-only purchase UI must not promote pricing, launch offers, or checkout availability.

Go-live requires storefront readiness, issuer readiness, support readiness, privacy/terms readiness, refund/support process readiness, and explicit release approval from the accountable owner.

## Operational Ownership

| Area | Accountable owner/contact | Public alias | Required before go-live |
|---|---|---|---|
| Support workflow | KjellKod <kjell@candidtalentedge.com> | `support@doc2md.dev` | Support channel exists and support process is documented. |
| Refund handling | KjellKod <kjell@candidtalentedge.com> | `support@doc2md.dev` | Refund path and merchant responsibilities are documented. |
| Privacy and terms publication | KjellKod <kjell@candidtalentedge.com> | `support@doc2md.dev` | Public privacy, terms, and support pages are published. |
| License delivery | KjellKod <kjell@candidtalentedge.com> | `support@doc2md.dev` | Delivery and restore instructions exist. |
| Merchant account and tax/sales responsibility | KjellKod <kjell@candidtalentedge.com> | `support@doc2md.dev` | Merchant account is live and tax/sales responsibility is understood through the selected merchant path. |
| Issuer secrets | KjellKod <kjell@candidtalentedge.com> | N/A | Signing keys, merchant credentials, webhook secrets, and issuer credentials are kept outside this public repo. |
| Customer and license records | KjellKod <kjell@candidtalentedge.com> | `support@doc2md.dev` | Record location, access, backup, and support lookup process are defined outside this public repo. |
| Release coordination | KjellKod <kjell@candidtalentedge.com> | `support@doc2md.dev` | Download, update, notice, support, and storefront readiness are verified before go-live. |

Use the full name `Kjell Hedstrom` only if a person/legal name is required by a public policy, merchant account, or legal document.

## Implementation Sequence

1. Land this decision record as the binding Phase 7b reference.
2. ~~Define the private issuer outside this public repo~~ (amended 2026-07-07): use Polar's license-key API as the v1 interim issuer per the [issuer spec](mac-private-license-issuer-spec.md). The custom private issuer is deferred to a v2 contingency; no private Worker is required before go-live.
3. Add Mac-only purchase/registration UX. Disabled scaffolding may land before go-live only when it visibly reads as unavailable and remains inert. Live navigation or purchase behavior waits for go-live approval.
4. Publish commercial docs on `doc2md.dev`: privacy, terms, refund, support, restore, and license-delivery pages.
5. Coordinate release go-live: public download/update links, release-pinned notices, merchant readiness, issuer readiness, and support readiness. Do not add ad hoc manual release edits.

## Acceptance Criteria For Follow-Up Quests

Issuer follow-up acceptance criteria:

- Future issuer work follows the [Mac private license issuer spec](mac-private-license-issuer-spec.md).
- Issuer code, signing keys, merchant credentials, webhook secrets, customer/license records, and issuer data stay outside this public repo.
- The issuer verifies merchant webhook signatures.
- The issuer rejects unsigned or malformed webhook payloads.
- The issuer does not receive document contents.
- The public Mac app contains only verifier logic and public verification keys.
- Release CI does not need the private license-signing key.

Purchase and registration UX follow-up acceptance criteria:

- UX is Mac-only and does not add checkout, purchase, registration, or license UI to the hosted browser app before go-live.
- Hosted web and npm package surfaces do not depend on licensing, checkout, issuer, or registration behavior.
- Any pre-go-live Mac-only purchase scaffolding visibly reads as unavailable.
- Disabled pre-go-live controls do not navigate, collect payment/license data, or promote checkout.
- Live purchase affordances require go-live approval, selected merchant readiness, issuer readiness, and support/privacy/refund readiness.
- License entry or restore behavior works without editing config files.
- Offline launch and local document editing continue to work.

Evaluation-shareware follow-up acceptance criteria:

- Unregistered evaluation has no hard trial period.
- Unregistered evaluation has no lockout of core document operations; conversion features are never disabled for unregistered users.
- Licensed-only additive conveniences are permitted, but nothing that ever shipped free may be moved behind the license.
- Unregistered evaluation uses occasional reminders only.
- A paid license removes reminders and enables licensed conveniences.
- License checks do not block opening, editing, converting, saving, or exporting local documents.
- Data created with licensed features remains readable and exportable after license expiry.

Commercial docs follow-up acceptance criteria:

- `doc2md.dev` publishes privacy, terms, refund, support, restore, and license-delivery pages before paid go-live.
- `support@doc2md.dev` is available before taking money.
- Customer-facing language stays aligned with `LICENSES/LicenseRef-doc2md-Desktop.txt`, `docs/licensing.md`, and root `LICENSE`.

## Validation

This quest is documentation-only. Validation should confirm:

- `git diff --check origin/main...HEAD` exits 0.
- New internal documentation links resolve.
- The decision record covers direct DMG first, `doc2md.dev`, Polar preferred/Paddle fallback (amended from Lemon Squeezy), disabled purchase affordances, hosted-web no-link gate, operational ownership, follow-up sequence, MIT boundary, and evaluation-friendly shareware behavior with the licensed-conveniences boundary.
- The diff is limited to the new decision record and small pointer edits in roadmap/idea/research docs.

## Out Of Scope

- Production purchase flow.
- Payment vendor integration.
- License issuer implementation.
- App Store receipt validation.
- About/Licenses UI rework.
- Final price.
- Public privacy, terms, refund, support, or restore page copy.
- Manual release-step requirements.

## Amendment Log

### 2026-07-07 — Polar merchant path, interim issuer, licensed-feature boundary

Amended after a two-round sharpen (solo pass, then joint session with the maintainer; both logged in `docs/diary/2026-07-06.md` and `docs/diary/2026-07-07.md`). Changes:

1. **Merchant of record: Lemon Squeezy → Polar, Paddle stays fallback.** Due-diligence outcome (2026-07): Lemon Squeezy is in post-acquisition transition under Stripe, with Stripe steering Lemon Squeezy merchants toward migration to Stripe Managed Payments. Stripe Managed Payments reached availability in roughly 35 to 39 countries by mid-2026 but is still young as a merchant-of-record offering, so it is not an acceptable fallback yet. Polar is an open-source merchant of record with first-class license keys (activation limits, expiry, automatic revocation on subscription cancellation) whose customer-portal activate/validate endpoints are designed for client-side calls without embedding merchant secrets. Polar's 2026 pricing on the free tier is 5% + 50¢ per transaction (roughly $1.50 on a $20 sale), with paid platform plans available at higher volume; international card surcharge 1.5%, chargebacks $15. Acceptable at this price point. Verify current vendor terms again before live integration.
2. **Interim issuer: Polar license-key API replaces the custom Ed25519 issuer for v1.** The issuer spec's online-lookup boundary gains one narrow exception: one-time activation at license entry and revalidation only inside the 14-day window around `expires_at` (7 before, 7 after), all non-blocking for document work. The Ed25519 contract and the shipped verifier remain as the v2 contingency and Polar exit plan.
3. **Billing shape locked:** single SKU, $20/yr auto-renewing subscription with transparent renewal copy, cancel anytime, access until the paid period ends.
4. **Evaluation boundary reworded:** "no feature lockout" became "no lockout of core document operations; licensed-only additive conveniences permitted." Nothing that ever shipped free may later be gated. First licensed convenience: the Document Library.
5. **Degradation ladder defined:** `licensed` → `grace` → `expired-reminder`; reminders resume and licensed conveniences pause; core document operations are never touched; no data hostage.

Due-diligence sources (checked 2026-07-07): [Polar merchant-of-record docs](https://polar.sh/docs/merchant-of-record/introduction), [Polar license-keys docs](https://polar.sh/docs/features/benefits/license-keys), [Stripe Managed Payments docs](https://docs.stripe.com/payments/managed-payments), [Lemon Squeezy 2026 update on Stripe Managed Payments](https://www.lemonsqueezy.com/blog/2026-update), third-party 2026 pricing reviews ([Dodo Payments on Polar](https://dodopayments.com/blogs/polar-sh-review), [Fungies on Polar](https://fungies.io/polar-sh-review-2026-2/)).
