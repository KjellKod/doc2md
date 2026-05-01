# Mac Commercial Distribution And Licensing Research

Status: Research
Owner: maintainers
Roadmap: `ideas/mac-desktop-app-roadmap.md` Phase 7
Date: 2026-05-01

## Question

Would a Sublime-style paid license with occasional reminders work for `doc2md.app`, and how does it compare with the Phase 7 roadmap suggestion?

Short answer: yes. The right fit is a direct-DMG, offline-verifiable, Sublime-style license for the Mac app only, sold through a merchant-of-record checkout. The verifier should live in the Swift Mac shell, and the issuer should be private server-side infrastructure. Do not make hosted web or npm depend on licensing.

## Reference Model

A practical reference model for this kind of desktop-app licensing is:

- Open-core split: a future public engine crate, a private proprietary app, and a private license issuer.
- Commercial behavior: free indefinitely, periodic nag, paid license removes nag, no feature crippling, no time bomb.
- Distribution: direct notarized DMG and optionally Homebrew Cask; Mac App Store handled only as a separate distribution track.
- License crypto: Ed25519-signed offline tokens with an embedded public key and `key_id` for rotation.
- Payment vendor: Lemon Squeezy as merchant of record, with Paddle as fallback.
- Issuer: Cloudflare Worker that receives purchase webhooks, verifies webhook authenticity, signs token claims, stores support records, and emails a license file/deep link.
- Activation: deep link, paste token, or drag/drop license file.
- Offline behavior: license verification never phones home; revocation is soft and best-effort.

## External Research

Lemon Squeezy is a strong fit for the roadmap's merchant-of-record preference. Its docs say it acts as merchant of record and handles payment-related liability such as sales tax, refunds, chargebacks, and PCI compliance. Its licensing docs support generated license keys, activation limits, license duration, subscription-linked license status, and a License API for activation, validation, and deactivation.

Paddle is also a plausible fallback, especially for SaaS/app billing and tax handling, but its Mac app licensing help page is explicitly for Paddle Classic and says Paddle does not allow third-party licensing together with its own Mac SDK. That makes Paddle less clean if the desired shape is "MoR checkout plus our own offline signed token issuer."

Apple App Store distribution is possible only as a separate track. Apple's guidelines allow subscriptions and define rules for external purchase links, but App Store builds bring review, sandboxing, StoreKit/IAP expectations, and separate purchase/restore semantics. The existing doc2md roadmap already says App Store distribution would need a separate packaging/review path.

Sources:

- Lemon Squeezy Merchant of Record: https://docs.lemonsqueezy.com/help/payments/merchant-of-record
- Lemon Squeezy generated license keys: https://docs.lemonsqueezy.com/help/licensing/generating-license-keys
- Lemon Squeezy License API: https://docs.lemonsqueezy.com/api/license-api
- Lemon Squeezy validate endpoint: https://docs.lemonsqueezy.com/api/license-api/validate-license-key
- Paddle Mac app licensing help: https://www.paddle.com/help/start/intro-to-paddle/selling-a-mac-app-with-trials-and-licensing
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

## Fit Against The Roadmap

This model matches Phase 7 well:

- It keeps hosted web and npm free.
- It lets the Mac app remain usable without payment.
- It supports occasional reminders without data hostage behavior.
- It keeps license checks offline-friendly.
- It can store a local license file/token without sending document contents anywhere.
- It lets a merchant of record handle tax, receipts, refunds, chargebacks, and payment compliance.

The main mismatch is repository/licensing structure. `doc2md` currently contains the hosted app, shared converter code, npm package, and Mac shell together. Before shipping paid Mac licensing, decide whether:

1. Keep this repo MIT/open and accept that license UI/verifier code is visible.
2. Split the Mac app shell/licensing into a private repo while keeping hosted web and `@doc2md/core` open/free.
3. Keep source public but move only the issuer, private signing key, and commercial operations private.

Option 3 is the simplest and probably enough for honest-user licensing. Option 2 is stronger commercially but adds repo, build, and release coordination overhead. Option 1 is transparent but makes nag removal trivial from source builds.

## Recommendation

Use the smallest practical version for Phase 7:

1. Direct signed/notarized DMG first; defer Mac App Store.
2. Lemon Squeezy first-choice merchant of record; Paddle as operational fallback only.
3. Private license issuer, likely Cloudflare Worker or similar small HTTPS service.
4. Offline Ed25519-signed license token:
   - `doc2md-license-v1.<claims>.<signature>`
   - claims: version, key id, license id, purchaser email or display name, tier, issued-at, optional expiry, merchant customer/order id.
5. Store token in `~/Library/Application Support/doc2md/license.doc2md` or Keychain.
6. Verify in Swift using embedded public keys. Keep Sparkle update keys and license signing keys completely separate.
7. Add Mac-only activation UI:
   - `Enter License...` menu item/dialog.
   - Paste token support.
   - Optional `doc2md://activate?key=...` deep link later.
   - Optional drag/drop license file later.
8. Nag cadence:
   - no nag for first several launches,
   - at launch only,
   - dismissible,
   - no interruptions during conversion/edit/save,
   - paid license suppresses nag.
9. Revocation:
   - skip hard revocation for MVP,
   - optionally add a best-effort public revocation list later,
   - never block document access because a revocation check fails.
10. Keep hosted web unchanged: no license UI, no checkout UI, no localStorage licensing.

This satisfies the roadmap's "simple paid license with occasional reminders in the spirit of Sublime Text" without adding account login, server-side document handling, subscription lock-in, or hard activation dependencies.

## Public Repo And Key Safety

This licensing design is compatible with a public repository as long as the commercial trust boundary is explicit:

- The public repo may contain the license verifier, token parser, public verification keys, tests, and nag UI.
- The public repo must not contain the private license-signing key, merchant credentials, webhook secrets, customer/license database credentials, Apple signing credentials, or Sparkle private update keys.
- The Mac app binary must contain only public verification keys. Public keys can be extracted with tools like `strings`, and that is acceptable because they cannot create valid licenses.
- The private license-signing key should live only in the private issuer environment that creates licenses after verified purchases.
- Release CI should not need the private license-signing key unless release CI is also issuing licenses. Prefer keeping license issuance separate from app release builds.
- PR CI must never receive production secrets. Pull request workflows should run without protected environment secrets, matching the existing release-safety posture.

An attacker reading the public repo can learn the token format, verifier logic, public key, and nag behavior. That is acceptable. They still cannot forge valid licenses unless they compromise the private signing key, issuer credentials, merchant webhook secret, customer/license database write access, or the private issuer environment.

The key distinction is signing versus verification:

1. The private issuer receives a purchase event.
2. The issuer signs a license token using the private license-signing key.
3. The user receives the signed token.
4. The Mac app verifies that token using an embedded public key.
5. The Mac app never needs the private signing key.

Because the private signing key is not shipped in the app, `strings` cannot extract it from the binary. Obfuscating or encrypting public keys in the binary would not add meaningful security: the app must be able to use those keys locally, so a determined attacker can recover them anyway. The useful security property is that public keys can verify signatures but cannot mint licenses.

This is honest-user licensing, not anti-tamper DRM. Someone with the public source can remove reminders and build an unofficial copy. That does not let them forge licenses for the official signed/notarized app, compromise customers, or access private commercial systems. The commercial value remains in the official build, Sparkle updates, trust, support, and convenience.

A malicious dependency in a protected release build is a different risk from a malicious pull request. Keep the license-signing key out of release CI, minimize release secrets, pin third-party Actions, and use protected environments for Apple/Sparkle release secrets. If the license-signing key is ever compromised, rotate by generating a new keypair, shipping an app update that trusts both old and new public keys, reissuing active licenses with the new key, then retiring the old key in a later release.

## Repo Split Decision

A private Mac-app split is not required for Phase 7 MVP.

The pragmatic initial structure is:

- Keep hosted web, npm package, converters, shared editor code, and the Mac shell in this public repo.
- Keep only the issuer service, private signing key, merchant credentials, customer/license records, and commercial operations private.
- Treat the public verifier and nag UI as reviewable product code, not as the commercial control boundary.

A private Mac wrapper or app repo may become worthwhile later if:

- the official Mac shell itself needs to be proprietary,
- paid-only functionality is added,
- public nag/verifier code materially hurts conversion,
- commercial copy, licensing UI, vendor integration code, or release packaging should be hidden,
- or the public repo starts constraining product decisions.

Splitting earlier has real cost: duplicated build coordination, harder CI, version drift between shared web/editor code and the Mac wrapper, more release failure modes, and more architecture surface to maintain. For the MVP, the simpler split is public app code plus private issuer/secrets.

If a split becomes necessary later, avoid a broad open-core restructure at first. The clean split would be:

- Public repo: hosted web, converters, npm package, and shared React/editor code.
- Private repo: Mac packaging/licensing wrapper, license UI/nag glue, proprietary release configuration, and issuer integration docs.
- Separate private service/repo: license issuer, signing keys, merchant credentials, and customer/license records.

## Implementation Work Packages

Keep Phase 7 split into reviewable quests:

1. Distribution decision record:
   - choose direct DMG first,
   - document App Store deferral,
   - choose Lemon Squeezy first and Paddle fallback,
   - define privacy and refund/support language.
2. License token verifier:
   - Swift verifier,
   - trusted public-key array with `key_id`,
   - local token storage,
   - tests for valid, invalid, expired, wrong key, malformed, and rotated-key cases.
3. License UI and nag:
   - Mac-only menu/dialog,
   - paste activation,
   - launch-count/snooze state,
   - no hosted-web exposure.
4. Issuer:
   - private repo/service,
   - webhook HMAC verification,
   - token signing,
   - support lookup data,
   - email delivery,
   - no document data.
5. Commercial docs:
   - EULA,
   - privacy statement,
   - refund policy,
   - license support/restore instructions.
6. Release hardening:
   - CI check that no private license signing key is committed,
   - CI check that private issuer credentials are never available to PR workflows,
   - documented key rotation,
   - manual live-mode test purchase.

## Risks And Tradeoffs

- Lemon Squeezy approval/live-mode can block launch. Keep Paddle fallback, but do not build both at once.
- Public verifier code does not protect against modified source builds. This is acceptable if the product goal is honest-user licensing, not anti-tamper DRM.
- A private Mac shell repo gives better commercial protection but increases build/release complexity.
- Keeping the issuer private while the verifier is public is the critical boundary; the private signing key must never ship in the app binary.
- Subscription licensing increases operational surface. A perpetual or annual-support license is simpler for v1.
- Machine-bound activation is not worth it for this product. It creates support pain and undermines offline-friendly behavior.
- Mac App Store is a separate product channel, not a small variation on direct DMG licensing.

## Decision Draft

Adopt this licensing type in principle, but implement the smallest doc2md-specific version:

- direct DMG first,
- Lemon Squeezy merchant of record,
- private issuer,
- offline signed license token,
- Swift verifier,
- local Application Support or Keychain storage,
- dismissible launch-time nags,
- no functional lockout,
- no hosted-web dependency,
- no App Store path until direct sales are proven.
