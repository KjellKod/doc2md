# Phase 7b Track 1: Operational Checklist for Paid Mac Launch

Status: Draft (not yet binding)
Owner: KjellKod <kjell@candidtalentedge.com>
Date: 2026-05-11
Roadmap: `ideas/mac-desktop-app-roadmap.md` Phase 7b
Authoritative references: [Phase 7b decision record](mac-commercial-distribution-decision-record.md), [Mac commercial distribution research](mac-commercial-distribution-and-licensing.md), [Mac private license issuer spec](mac-private-license-issuer-spec.md)

## Purpose

The decision record names every operational artifact that must exist before paid go-live (`support@doc2md.dev`, `doc2md.dev` pages, a merchant account, customer/license records). It does not say *what to do in what order*. This document is that ordered playbook for the code-free track.

Track 1 is everything that does not require writing code in this repo. It runs in parallel with Track 2 (in-repo disabled purchase scaffolding) and Track 3 (private issuer service). All three must complete before paid launch, but Track 1 is the longest-pole because merchant onboarding and DNS/email propagation are calendar-driven, not effort-driven.

## Ordered Steps

Each step is sized to one work session unless noted. Steps marked **calendar-bound** wait on a third party; start them as early as possible.

### Step 1: Register and DNS-configure `doc2md.dev`

Dependency: none. Blocks: Steps 2, 4, 5, 7.

1. Confirm `doc2md.dev` is registered to the operational owner identity in the decision record. If not, register it through any reputable registrar.
2. Plan the subdomain layout. The decision record already names three:
   - `doc2md.dev` — public Mac product/download/support/pricing/legal surface
   - `updates.doc2md.dev` — Sparkle appcast (already in use per Phase 5c)
   - `license.doc2md.dev` — private issuer/API surface (not required to be live in the first paid launch but the DNS record should be reserved)
3. Set up TLS for `doc2md.dev`. If hosting on GitHub Pages, the standard custom-domain TLS path works. Any equivalent host (Cloudflare Pages, Netlify, etc.) is fine.
4. Verify HTTPS resolves on the root domain. Done when `curl -I https://doc2md.dev` returns a 200/3xx (whichever the chosen host serves).

### Step 2: Set up `support@doc2md.dev` alias  (calendar-bound for MX propagation)

Dependency: Step 1. Blocks: Step 3 (Lemon Squeezy needs a working support address), Step 6.

1. Pick an email provider for the alias. Options that work cleanly with a single-owner solo product:
   - Forward-only alias service (Fastmail, ImprovMX, Cloudflare Email Routing) forwarding to the owner's existing inbox. Cheapest, fastest, no full mailbox to manage.
   - Full mailbox via Google Workspace, Fastmail, or similar. Required only if you want `From: support@doc2md.dev` outbound replies that pass SPF/DKIM/DMARC.
2. If outbound replies should appear from `support@doc2md.dev` (recommended for trust), pick a full mailbox provider. Otherwise an alias is enough for v1.
3. Configure DNS: MX records per the chosen provider, plus SPF (TXT), DKIM (TXT), and DMARC (TXT). Most providers give you the exact values.
4. Send a test email to `support@doc2md.dev` from an unrelated address. Confirm it arrives. Reply and confirm the reply lands at the originating address with the expected `From:`.
5. Document the alias-to-inbox mapping in a private operational note (not this repo).

### Step 3: Apply for Lemon Squeezy as a merchant of record  (calendar-bound, longest pole)

Dependency: Step 2 (the application asks for a support contact). Blocks: Step 6 (commercial pages need final pricing), Track 3 (issuer can't be built until the merchant identity and webhook signing secret are known), live go-live.

1. Create the Lemon Squeezy account. Apply as a "store" with the operational owner identity from the decision record. Application form references: <https://lemonsqueezy.com>, vendor docs at <https://docs.lemonsqueezy.com>.
2. Business and tax info: provide the legal name from the decision record (`Kjell Hedstrom` if a legal name is required, per the decision record's note), the support email from Step 2, payout bank/transfer details, and tax classification.
3. Set up the store: product name "doc2md", product type "digital product / software license", pricing model. The decision record's evaluation-shareware constraints require the product to be a one-time or annual purchase that removes reminders, with no feature lockout. A perpetual or annual-support license is simpler for v1 (per the research doc, "Subscription licensing increases operational surface"). Pick one and document the choice.
4. Enable the License Keys add-on/feature. This is what generates and stores the per-customer license keys the issuer will sign tokens against. The research doc explicitly cites this capability.
5. Configure the webhook destination as a placeholder URL that returns 200. The real issuer endpoint is built in Track 3. Lemon Squeezy must be in test mode until live-go is approved. Record the webhook signing secret somewhere safe outside this repo; the issuer will need it.
6. Sit on the application. Lemon Squeezy reviews can take days to weeks. Do not block the rest of the checklist on this.
7. If Lemon Squeezy declines or stalls past an acceptable window, fall back to Paddle (decision record's documented fallback). Do not build both integrations in parallel.

### Step 4: Decide hosting for `doc2md.dev`

Dependency: Step 1. Blocks: Step 6.

1. Pick a host. The simplest, lowest-cost option for a solo product is the same path the hosted web app uses today (GitHub Pages from a static-site generator or hand-rolled HTML/CSS). Alternatives: Cloudflare Pages, Netlify, Vercel.
2. Decide whether `doc2md.dev` lives in this public repo (e.g., `apps/doc2md-dev/`) or a separate repo. Solo-product simplicity argues for same-repo. Public-repo-as-marketing-site is the dominant pattern for indie Mac apps.
3. Confirm hosting choice against the decision record: the hosted free web app at `https://kjellkod.github.io/doc2md/` must remain separate and must not expose Mac purchase, download, or registration links before go-live. The new `doc2md.dev` surface is the only commercial-facing one.

### Step 5: Draft commercial pages for `doc2md.dev`

Dependency: Step 4. Calendar-bound only by writing time. Blocks: go-live.

Pages required by the decision record and research doc, in priority order:

1. **Privacy policy.** What data is collected (currently: none from the Mac app at runtime; potentially license info from Lemon Squeezy). What is stored. Where it is stored (Lemon Squeezy + private operational records). How long. Per the research doc, "no document data" ever touches the issuer.
2. **Terms of service / EULA pointer.** Public-facing terms that match `LICENSES/LicenseRef-doc2md-Desktop.txt` and `docs/licensing.md`. Cite the existing license; do not rewrite it.
3. **Refund policy.** Lemon Squeezy is merchant of record and handles refund mechanics, but the customer-facing window (e.g., 14 days, 30 days, no-questions-asked vs. case-by-case) is the operator's call. Pick one, document it.
4. **Support page.** How to reach support (`support@doc2md.dev`), expected response time, what to include in a request (license email, app version, macOS version, reproduction steps if applicable).
5. **License restore / recovery.** How a paying customer who lost their license recovers it. Lemon Squeezy can email the license key from the customer portal; document the link and the manual fallback (email support).
6. **License delivery.** What happens after purchase: confirmation email, license key by email, how to enter it in the Mac app, screenshots optional.
7. **Pricing and download.** Disabled / "coming soon" before go-live per the decision record. Listed last because it must visibly read as unavailable until go-live approval.

Keep the writing factual. No marketing hyperbole. Pages can be plain HTML/CSS; no framework required for v1.

### Step 6: Decide customer / license record storage  (outside this repo)

Dependency: Step 3 (Lemon Squeezy is the canonical source; this step is about the operator's read-side copy). Blocks: go-live (support needs lookup).

1. Pick where the operational copy of customer/license records lives. Solo-product options:
   - Lemon Squeezy dashboard as primary, no second copy. Simplest. Risk: dashboard outage = support outage.
   - Lemon Squeezy + a private spreadsheet or Notion table for offline lookup. Manual sync. Light overhead.
   - Lemon Squeezy + a tiny private database (the same private repo/service that runs the issuer). Best for automation, requires Track 3.
2. Document the choice and the lookup process. Solo operators are well-served by option 2 for v1.
3. Define a backup approach. If the answer is "Lemon Squeezy is the backup," document that.

### Step 7: Document the support workflow  (internal-facing)

Dependency: Steps 2, 6. Blocks: go-live.

1. Write a short internal SOP (not in this repo) covering:
   - Where support email lands and how often it's checked.
   - The lookup steps for a "I lost my license" request.
   - The escalation/refund path (Lemon Squeezy dashboard → refund button).
   - Response-time expectations (e.g., "best-effort within 2 business days").
2. Do a dry run: send a fake support ticket from an unrelated address, walk through the lookup, send a fake recovery reply.

### Step 8: Internal go-live gate review

Dependency: Steps 1–7 complete, Track 2 disabled-UX scaffolding shipped, Track 3 issuer live in test mode.

1. Confirm every line of the decision record's "Operational Ownership" table is satisfied. Read it as a checklist; do not skim.
2. Decide the launch announcement plan (or decide not to announce; honest-quiet-tool launches don't require fanfare).
3. Flip Lemon Squeezy to live mode.
4. Flip the in-app purchase UX from disabled to live via the `LICENSING_GO_LIVE` switch.
5. Make one real test purchase from an unrelated email/payment method. Confirm: webhook fires, issuer signs token, license email arrives, license entry in the Mac app removes reminders.
6. If the test purchase succeeds end-to-end, public launch is unblocked.

## Critical Path

The longest-pole item is Step 3 (Lemon Squeezy application). Everything else can be done in parallel with that wait. A reasonable solo cadence:

- Week 1: Step 1, Step 2, start Step 3, draft Step 4 decision.
- Week 2: Step 5 (page drafts), Step 6, Step 7 while Lemon Squeezy is reviewing.
- Week 3+: Track 2 (in-repo disabled UX) and Track 3 (issuer) work in this repo and a private repo.
- Go-live: after Step 8 passes.

## What This Document Is Not

- It is not a substitute for the decision record. The decision record is binding; this document is operational guidance.
- It is not legal advice. Sales tax, privacy regulations, and consumer protection rules vary by jurisdiction. Lemon Squeezy as merchant of record absorbs most of the multi-jurisdiction sales-tax surface but does not absorb everything.
- It is not a vendor selection document. Lemon Squeezy is chosen by the decision record; Paddle is the fallback. This document does not re-litigate that choice.

## Maintenance

Update this checklist when:

- A step changes ordering or dependency.
- A step is split, merged, or removed.
- The merchant-of-record changes (decision record would update first).
- Steps are completed (mark them in a follow-up commit or move them to a "Done" section so the active checklist stays scannable).

Operational data (specific account IDs, secrets, customer records, signed agreements) must not be added to this public document. Use a private operational note for those.
