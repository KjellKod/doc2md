# Phase 7b Distribution Decision

Date: 2026-05-06
Quest: `phase-7b-distribution-decision_2026-05-05__2059`
Branch: `quest/phase-7b-distribution-decision`
Outcome: Complete

Implemented the Phase 7b commercial distribution decision record before payment, issuer, or registration work.

## What Changed

- Added `docs/implementation/mac-commercial-distribution-decision-record.md` with `Status: Accepted`.
- Documented direct-DMG-first commercial launch with Mac App Store deferred.
- Defined `doc2md.dev` as the public Mac commercial/download/support/licensing surface.
- Recorded Lemon Squeezy as preferred merchant-of-record path and Paddle as fallback.
- Locked the hosted web app boundary: no Mac purchase, download, or registration links before explicit commercial go-live approval.
- Named `KjellKod <kjell@candidtalentedge.com>` as accountable operational owner/contact.
- Kept `support@doc2md.dev` as the only intended public customer-facing go-live support/contact alias.
- Added follow-up acceptance criteria for private issuer work, Mac-only purchase/registration UX, commercial docs, and evaluation-shareware behavior.
- Linked the decision record from the Mac roadmap, ideas index, and commercial distribution research doc.

## Validation

- `git diff --check origin/main...HEAD`
- Internal decision-record link resolution script
- `licenses@doc2md.dev` absence check across implementation docs and ideas
- Solo code review completed with no actionable backlog

## Notes

The Quest intentionally stayed documentation-only. Production purchase flow, payment vendor integration, license issuer implementation, About/Licenses UI work, final pricing, and manual release-step changes remain out of scope.
