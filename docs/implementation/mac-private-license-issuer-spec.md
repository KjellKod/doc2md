# Mac Private License Issuer Spec

Status: Deferred, v2 contingency (amended 2026-07-07; v1 uses Polar's license-key API as the interim issuer, see below)
Owner: KjellKod <kjell@candidtalentedge.com>
Date: 2026-05-06
Roadmap: `ideas/mac-desktop-app-roadmap.md` Phase 7b
Related: [Mac commercial distribution decision record](mac-commercial-distribution-decision-record.md), [Mac commercial distribution and licensing research](mac-commercial-distribution-and-licensing.md), [Mac desktop app roadmap](../../ideas/mac-desktop-app-roadmap.md)

## V1 Interim Issuer: Polar License-Key API (Amended 2026-07-07)

The 2026-07-07 amendment to the [decision record](mac-commercial-distribution-decision-record.md) defers the custom private issuer. For v1, Polar (the selected merchant of record) acts as the issuer through its built-in license keys:

- Purchase on Polar issues a license key with activation limits, `expires_at` tracking, and automatic revocation when the subscription is cancelled (effective at paid-period end).
- The Mac app performs a **one-time online activation** when the user enters the key (`/v1/customer-portal/license-keys/activate`). The key and the returned activation ID are stored in the non-syncing Keychain only; the Application Support fallback holds only non-secret validation metadata (key status, expiry, last-validated timestamp), never the raw key, because a Polar key is a reusable bearer credential. Later `/validate` calls send key + activation ID. If the Keychain is unavailable, the app asks the user to re-enter the key.
- **Revalidation is quiet while licensed**: silent background attempts start 7 days before `expires_at` and continue through the 14-day window (7 before, 7 after). A renewed subscription picks up a new expiry invisibly. Once the cached entitlement is expired without a definitive answer, throttled attempts (once per launch or per day) continue until validation succeeds or returns `revoked`/`disabled`, so a renewed customer who missed the window recovers to licensed automatically. The cached `expires_at` is authoritative: a successful validation affects entitlement only through the snapshot it writes, and never extends a license past its cached expiry. There is no phone-home while validly licensed and far from expiry. Validation uses `/v1/customer-portal/license-keys/validate`.
- These customer-portal endpoints are designed for client-side calls keyed by the license key itself. The app must embed **no merchant secret, organization token, or API credential**. The integration quest must verify this property against current Polar documentation before shipping.
- **Every licensing network call is non-blocking for document operations.** Launch, open, edit, convert, save, and export never wait on, or fail because of, licensing traffic. This is the one narrow exception to this spec's original no-online-validation rule, and it extends no further.
- Degradation ladder when revalidation cannot succeed: `licensed` → `grace` (calm banner, everything works) → `expired-reminder` (evaluation reminders resume, licensed conveniences pause, core document operations untouched, all user data readable and exportable).
- A definitive `revoked` or `disabled` validation answer (cancellation) is not a network failure: access is preserved through `expires_at` (paid period honored), then the state moves straight to `expired-reminder` with no `grace` window, so a revoked key cannot stay licensed indefinitely.
- License recovery remains email support via `support@doc2md.dev`, plus Polar's own purchase-email key re-delivery.

Everything below this section is the **v2 contingency**: the custom Ed25519 issuer contract, kept current as the exit plan if Polar's terms, API, or ownership change unacceptably. The Ed25519 verifier already shipped in the app (PR #110) stays in place, dormant but tested, so switching issuers later does not require inventing a new token model.

## Purpose

This is the public contract for the future private Mac license issuer. It defines the trust boundary, license-token semantics, support/recovery expectations, and follow-up acceptance criteria without implementing issuer infrastructure in this public repository.

The private issuer implementation, customer/license records, merchant credentials, webhook secrets, signing keys, and issuer operational data must stay outside this public repo.

## Already Decided By PR #108

The [Phase 7b decision record](mac-commercial-distribution-decision-record.md) remains the binding commercial distribution decision. This spec inherits these decisions without re-deciding them:

- direct signed and notarized DMG distribution first;
- `doc2md.dev` as the Mac commercial surface;
- Polar preferred, Paddle fallback only (amended 2026-07-07 from Lemon Squeezy);
- Mac app source-visible shareware under `LicenseRef-doc2md-Desktop`;
- hosted web, npm package surfaces, shared converters, and MIT-marked files remain MIT/free;
- purchases are disabled until explicit commercial go-live approval;
- private issuer secrets, credentials, signing keys, and records stay outside this public repo.

## What This Spec Adds

This document consolidates the issuer-specific contract so future private issuer, Mac verifier/token-storage, Mac purchase/registration UX, and commercial docs quests share the same boundary.

It does not choose the final price or business model, publish checkout links, implement a server, choose Cloudflare-specific storage schemas, or add customer-facing self-service recovery.

## Public And Private Boundary

The issuer is private commercial infrastructure. It may run under `license.doc2md.dev`, but this public repo should treat that domain as private issuer/API territory until a later implementation quest defines it outside this repo.

The public Mac app may contain:

- public verification keys;
- token parsing code;
- offline signature verification;
- local token storage and validation behavior;
- user-facing license entry and local status UI;
- links or copy directing users to `support@doc2md.dev`.

The public Mac app and this public repo must not contain:

- private license-signing keys;
- merchant credentials;
- webhook secrets;
- customer/license databases or support records;
- issuer database credentials;
- private issuer implementation code;
- production license tokens, sample secrets, real customer records, or merchant account identifiers.

Hosted web, npm package surfaces, shared converters, and MIT-marked files must not depend on checkout, issuer, purchase, registration, or license validation behavior.

## Private Issuer Responsibilities

The private issuer is responsible for:

- receiving merchant purchase or refund-related events from the selected merchant path;
- verifying merchant webhook authenticity before trusting payloads;
- rejecting unsigned, malformed, replayed, duplicate, stale, or wrong-event payloads;
- deriving license claims only from verified merchant events and private issuer records;
- signing license tokens with a private signing key;
- assigning stable license identifiers for support and re-delivery;
- storing customer/license support records outside this public repo;
- supporting private admin/support lookup by license id, purchaser email, and merchant customer/order identifiers;
- sending or re-sending license delivery email through the chosen private delivery process;
- keeping records sufficient for `support@doc2md.dev` license recovery;
- rotating signing keys without breaking existing valid licenses unnecessarily;
- keeping signing keys, webhook secrets, merchant credentials, customer records, and issuer operational data private.

The issuer must not receive document contents. License issuance and support lookup are commercial/account operations, not document processing operations.

## License Token Contract

The public token contract defines required claims and verification semantics. It does not lock the exact byte-level serialization envelope. A later implementation quest may choose canonical JSON or another deterministic signed payload format.

Expected signing family: Ed25519 or an equivalent asymmetric signature scheme approved by a later implementation decision. The app verifies with public keys only. It never signs tokens.

Required claims:

| Claim | Purpose |
|---|---|
| `version` | Token contract version, initially a v1 value. |
| `key_id` | Identifies which public verification key verifies the signature. |
| `license_id` | Stable issuer license id for support lookup and re-delivery. |
| `purchaser` | Object containing purchaser display/email claims. |
| `tier` | Product/license tier. |
| `issued_at` | Issuance timestamp. |
| `entitlement` | Lifecycle category such as `perpetual`, `annual`, `subscription`, or `support_term`. |
| `merchant` | Merchant correlation object for private support lookup. |

Purchaser claim shape:

- `email`: purchaser email when available from the verified merchant event;
- `display_name`: optional purchaser display name;
- the public app may display these values but must not treat user-entered values as authoritative license claims.

Merchant claim shape:

- `customer_id`: merchant customer identifier when available;
- `order_id`: merchant order identifier when available;
- `provider`: selected merchant identifier such as `lemon_squeezy` or a later fallback value;
- these identifiers are for support correlation and private lookup, not public app access to merchant systems.

Optional lifecycle claims:

| Claim | Purpose |
|---|---|
| `expires_at` | Optional hard license expiry. Likely useful for one-year or subscription-like licenses. |
| `support_through` | Optional support eligibility date. |
| `updates_through` | Optional update eligibility date. |
| `major_version_limit` | Optional major-version entitlement boundary. |

Lifecycle guidance:

- Perpetual license: no `expires_at`; may include `support_through`, `updates_through`, or `major_version_limit`.
- One-year or other term license: likely includes `expires_at`.
- Annual updates/support: may omit `expires_at` while using `support_through` or `updates_through`; the app can keep working while support/update eligibility changes.
- Subscription-like license: likely includes `expires_at` and requires private issuer renewal/reissue behavior in a later implementation quest.

This spec does not choose the final business model. It keeps the token contract compatible with a likely `expires_at` model while preserving perpetual and support/update-term options.

## Webhook And Security Requirements

The private issuer must:

- verify merchant webhook signatures using private webhook secrets;
- reject unsigned webhook payloads;
- reject malformed or schema-invalid payloads;
- reject replayed, stale, duplicate, or wrong-event payloads;
- reject events that do not map to a supported product/tier;
- never accept client-supplied license claims as authoritative;
- never issue a license from app-provided purchaser, tier, or merchant claims;
- keep webhook secrets, signing keys, merchant API credentials, issuer credentials, and customer/license records outside this public repo.

Key rotation expectations:

- Tokens include `key_id`.
- The public Mac app can trust multiple public verification keys during a transition.
- Private issuer key rotation should allow issuing new tokens with a new key while existing active licenses remain verifiable until a deliberate retirement plan is complete.
- Release CI must not need the private license-signing key.
- Sparkle update keys and license signing keys remain separate.

## License Recovery And Support

Customer-facing license recovery for v1 is email support through `support@doc2md.dev`.

The public spec and public Mac app should not promise:

- automatic restore;
- self-service license lookup;
- account login;
- app-driven recovery;
- activation seats;
- online entitlement validation;
- revocation polling.

The private issuer and support process should still make support lookup and re-delivery possible. Private support/admin lookup by purchaser email, license id, or merchant customer/order identifiers is allowed and expected outside this public repo.

## Online Lookup Boundary

Online support/admin lookup is normal private issuer behavior. It is not the same as making the public app depend on online entitlement checks.

For this contract:

- the Mac app entitlement check is offline-first local verification against cached license state;
- normal launch, open, edit, convert, save, and export behavior must not require network or issuer availability;
- customer-facing recovery is email support through `support@doc2md.dev`;
- the v1 interim issuer section above grants the only approved online calls: one-time activation at license entry and revalidation inside the 14-day expiry window, both non-blocking;
- further self-service lookup, always-on validation, activation seats, revocation polling, and app-to-issuer recovery APIs remain future explicit decisions;
- future online app calls, if approved later, must be non-blocking for document operations and must not expose merchant credentials, signing keys, customer database access, or private issuer authority to the public app.

This is honest-user licensing, not anti-tamper DRM. A source-visible app can be modified, but that does not allow forging official licenses without compromising the private signing key or issuer environment. The commercial trust boundary is verified purchases, private token signing, official signed/notarized builds, Sparkle updates, support, and customer trust.

## Follow-Up Acceptance Criteria

Private issuer implementation:

- Issuer implementation lives outside this public repo.
- Issuer verifies merchant webhook signatures before trusting purchase/refund events.
- Issuer rejects unsigned, malformed, replayed, duplicate, stale, or wrong-event payloads.
- Issuer derives license claims only from verified merchant events and private issuer records.
- Issuer signs tokens with a private key that never enters this public repo or PR CI.
- Issuer stores customer/license support records outside this public repo.
- Issuer supports private support/admin lookup for license recovery.
- Issuer can rotate signing keys using `key_id` without immediately invalidating active licenses.
- Issuer does not receive document contents.

Mac verifier and token storage:

- Public Mac app contains only public verification keys, token parser/verifier, and local storage logic.
- App verifies tokens offline using `key_id`, required claims, lifecycle fields, and signature validity.
- App handles unknown key, malformed token, invalid signature, unsupported version, expired token, and future lifecycle fields deterministically.
- App does not require network or issuer availability for launch, open, edit, convert, save, or export.
- App has no merchant credentials, private signing key, customer database access, or private support lookup authority.
- Local token entry/recovery behavior works without editing config files.

Mac purchase and registration UX:

- UX is Mac-only and does not add checkout, purchase, registration, or license UI to the hosted browser app before go-live.
- Hosted web and npm surfaces remain independent from licensing, checkout, issuer, and registration behavior.
- Customer-facing recovery copy directs users to `support@doc2md.dev`.
- Any future app-facing online licensing behavior requires a separate explicit decision.
- Disabled pre-go-live purchase controls remain inert, non-promotional, and unable to navigate or collect payment/license data.

Commercial docs and go-live readiness:

- `doc2md.dev` publishes privacy, terms, refund, support, license recovery, and license-delivery pages before paid go-live.
- `support@doc2md.dev` exists before taking money.
- Support workflow, refund handling, merchant readiness, issuer readiness, key ownership, and customer-record handling are documented outside this public repo where private details are required.
- Customer-facing language stays aligned with `LICENSES/LicenseRef-doc2md-Desktop.txt`, `docs/licensing.md`, and root `LICENSE`.

## Out Of Scope

- Private issuer implementation.
- Cloudflare Worker, server, database, or email-provider code in this public repo.
- Payment vendor integration.
- Checkout links.
- Mac purchase UI implementation.
- Hosted-web checkout or licensing behavior.
- Self-service recovery.
- App-facing online license validation.
- Activation seats.
- Revocation polling.
- Final price or business model.
- Production secrets, sample secrets, real customer records, merchant credentials, or production license tokens.
