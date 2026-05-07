# 036 — Celebration: Mac License Verifier
<!-- quest-id: mac-license-verifier_2026-05-06__1851 -->
<!-- pr: pending -->
<!-- style: celebration -->
<!-- quality-tier: gold -->
<!-- date: 2026-05-06 -->

```
██╗   ██╗███████╗██████╗ ██╗███████╗██╗███████╗██████╗
██║   ██║██╔════╝██╔══██╗██║██╔════╝██║██╔════╝██╔══██╗
██║   ██║█████╗  ██████╔╝██║█████╗  ██║█████╗  ██████╔╝
╚██╗ ██╔╝██╔══╝  ██╔══██╗██║██╔══╝  ██║██╔══╝  ██╔══██╗
 ╚████╔╝ ███████╗██║  ██║██║██║     ██║███████╗██║  ██║
  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
```

# Phase 7b Mac License Verifier

## Starring Cast

| Role | Model | Credit |
|---|---|---|
| planner | GPT-5.5 | The Envelope Cartographer |
| plan-reviewer-a | Claude | The Boundary Critic |
| plan-reviewer-b | GPT-5.5 | The Acceptance Auditor |
| arbiter | Claude (Jean-Claude) | The Bias Toward Action |
| builder | GPT-5.5 | The Three-Segment Surgeon |
| code-reviewer-a | Claude | The Codable Inspector |
| code-reviewer-b | GPT-5.5 | The Date-Claim Skeptic |
| fixer | GPT-5.5 | The Fractional-Second Closer |

## Achievements Unlocked

🔒 **Offline Means Offline** — no `URLSession`, no `license.doc2md.dev`, no merchant SDK, no private key, no checkout, no purchase UI. The verifier asks no one for permission.

🔑 **Empty Trusted Keys By Default** — `LicensePublicKeys.trustedKeys` ships empty until real production keys exist. No placeholder, no sample, no test key escaping into release builds.

📐 **Custom Codable, Pinned Invariants** — date claims decode through `decode(Int.self, ...)` and reject fractional values as malformed. The fixer pass added `testFractionalDateClaimsAreMalformed()` covering all four lifecycle dates.

🧪 **Key Rotation Proven** — two public keys, two `key_id`s, one verifier. The builder caught a real fixture collision during validation and added a `keyID` initializer parameter to `LicenseFixtureFactory` before tests passed.

🧹 **Buy License Scaffolding Gone** — the disabled purchase button left over from earlier phases was removed from `LicenseWindow`. This quest carries no purchase scaffolding it cannot honor.

## Impact Metrics

- 2 plan iterations before arbiter approve.
- 1 fix loop, 1 finding closed (`code-reviewer-b-001`, fractional date claims).
- 1 non-blocking info-level finding noted for future cleanup.
- 0 network calls, 0 issuer URLs, 0 merchant credentials, 0 private keys, 0 production-looking secrets.
- All Phase 3 acceptance criteria covered by focused tests.

## Handoff And Reliability Snapshot

- Planner, reviewers, arbiter, builder, fixer, and re-review all produced handoffs.
- Final canonical review backlog: empty for blocking and must-fix.
- One residual info finding logged for the next agent (see Watch List).

## Quality Tier: Gold

Not Diamond because the plan had to sharpen twice and a fixer pass was needed for fractional date claims. Earns Gold because the uncertainty was handled before implementation, the fix was small and surgical, the final review came back clean on blockers, and the offline boundary held under scrutiny.

## Victory Narrative

This quest did not invent a license format, it implemented one. The contract was already public from PR #109. The work was holding the line: parse only, verify only, refuse only. No checkout temptation, no online activation shortcut, no friendly placeholder key that quietly trusts a fixture. The verifier is small enough to read in one sitting and strict enough that a malformed token has nowhere to hide.

## Watch List For The Next Agent

- `LicensePublicKeys.trustedKeys` is intentionally empty. Production verification will not accept any token until real public keys are added. Do not paper over this with a placeholder.
- `LicenseToken.swift:30` still sets `decoder.dateDecodingStrategy = .secondsSince1970`. After the custom `LicenseClaims.init(from:)` landed it is dead code. The matching encoder line in `LicenseTestSupport.swift:90` has the same property. Optional cleanup, non-blocking.
- Lifecycle fields `expires_at`, `support_through`, `updates_through`, `major_version_limit` parse and verify, but no UI surfaces them yet. When a future quest adds entitlement-aware UI, that is where to wire them.
- Test fixtures use ephemeral `Curve25519.Signing.PrivateKey()` only. Never commit a static private key, even one labeled "test", into the repo.
- The disabled `Buy License` UI was removed in this quest, not deferred. When purchase work begins, do not assume any scaffolding remains.
- Storage tests were adapted to the nested purchaser model. Keep that contract intact when extending storage behavior.

> "Date claim encoding is pinned to integer seconds since the Unix epoch."
>
> — Phase 3 acceptance criterion, now enforced by both the parser and a regression test

— Jean-Claude, who likes a verifier that says no clearly
