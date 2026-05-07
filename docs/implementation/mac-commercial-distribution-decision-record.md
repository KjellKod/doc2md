# Mac Commercial Distribution Decision Record

Status: Accepted
Owner: KjellKod <kjell@candidtalentedge.com>
Date: 2026-05-06
Roadmap: `ideas/mac-desktop-app-roadmap.md` Phase 7b
Related: [Mac commercial distribution and licensing research](mac-commercial-distribution-and-licensing.md), [Mac private license issuer spec](mac-private-license-issuer-spec.md), [Mac desktop app roadmap](../../ideas/mac-desktop-app-roadmap.md)

## Decision

The first paid Mac launch path is direct signed and notarized DMG distribution for the Official App. Mac App Store distribution is deferred as a separate future channel because it would need separate packaging, review, purchase/restore, receipt-validation, and policy work.

`doc2md.dev` is the public Mac commercial surface for product information, downloads, support, licensing, pricing, privacy, and terms. The hosted web app remains separate at `https://kjellkod.github.io/doc2md/` and must not expose Mac purchase, download, or registration links until explicit commercial go-live approval.

Lemon Squeezy is the preferred merchant-of-record path. Paddle is the fallback if Lemon Squeezy approval, live-mode readiness, or operational fit blocks launch. The MVP must choose one merchant path; it must not build Lemon Squeezy and Paddle integrations in parallel.

## Scope And Boundaries

This decision applies only to the Mac app commercial launch path. It does not change the licensing or availability of the hosted web app, npm package surfaces, shared converters, or MIT-marked files.

The Mac app remains source-visible shareware under `LicenseRef-doc2md-Desktop`. The hosted web app, `@doc2md/core`, shared conversion logic, npm surfaces, and MIT-marked files remain MIT/free and must not depend on checkout, issuer, purchase, or registration behavior.

The Official App remains evaluation-friendly when unregistered:

- no fixed trial period,
- no feature lockout,
- no document lock-in,
- no data hostage behavior,
- occasional reminders only,
- a paid license removes reminders.

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

Use Lemon Squeezy first because the commercial preference is a merchant-of-record path. Use Paddle only as the fallback if Lemon Squeezy blocks launch operationally.

This record intentionally does not restate detailed vendor claims. Vendor-specific implementation details can change and belong in the later payment/issuer integration work, where the current vendor documentation should be verified again before live integration.

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
2. Define the private issuer outside this public repo using the [Mac private license issuer spec](mac-private-license-issuer-spec.md): merchant webhook verification, license-token signing, customer/license support records, email/support license recovery, key rotation, and secret ownership.
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
- Unregistered evaluation has no feature lockout.
- Unregistered evaluation uses occasional reminders only.
- A paid license removes reminders.
- License checks do not block opening, editing, converting, saving, or exporting local documents.

Commercial docs follow-up acceptance criteria:

- `doc2md.dev` publishes privacy, terms, refund, support, restore, and license-delivery pages before paid go-live.
- `support@doc2md.dev` is available before taking money.
- Customer-facing language stays aligned with `LICENSES/LicenseRef-doc2md-Desktop.txt`, `docs/licensing.md`, and root `LICENSE`.

## Validation

This quest is documentation-only. Validation should confirm:

- `git diff --check origin/main...HEAD` exits 0.
- New internal documentation links resolve.
- The decision record covers direct DMG first, `doc2md.dev`, Lemon Squeezy preferred/Paddle fallback, disabled purchase affordances, hosted-web no-link gate, operational ownership, follow-up sequence, MIT boundary, and evaluation-only shareware behavior.
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
