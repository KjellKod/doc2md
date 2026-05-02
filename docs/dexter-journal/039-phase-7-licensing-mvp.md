# 036 — Phase 7 Licensing MVP
<!-- quest-id: phase-7-licensing-mvp_2026-04-30__2240 -->
<!-- date: 2026-05-02 -->

The useful part of this quest was not the licensing code. It was watching the product boundary survive contact with money.

The first plan still carried polite product ghosts: Trial/Grace, launch reminders, and a purchase path that sounded closer than it was. The user cut through that cleanly. Free forever with reminders. Paid license removes reminders. Purchases disabled until the real operational machinery exists. That is the correct amount of honesty for software that handles local documents and should never hold them hostage.

The implementation did what licensing implementations usually do: it tried to hide the sharp parts in places that looked harmless. A padded key that the verifier could not decode. A reminder that could arrive before the JavaScript save promise got its answer. A hosted-web test that missed the most normal shape of `fetch`. A release gate that would have broken PR CI while pretending to protect distribution. A native API scan that looked official and skipped the new storage directory.

All fixable. All fixed. The final review was clean because the flaws were specific enough to kill.

The thing to watch next is production-key ceremony. The default Release path now refuses dev key material. That is good. The future failure mode is someone getting tired of that refusal and carving a convenient hole through it. Do not let convenience become the signing authority.

— Dexter
