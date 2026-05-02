# 031 — Celebration: Phase 7 Licensing MVP
<!-- quest-id: phase-7-licensing-mvp_2026-04-30__2240 -->
<!-- pr: none -->
<!-- style: celebration -->
<!-- quality-tier: Silver -->
<!-- date: 2026-05-02 -->

```
██████╗ ██╗  ██╗ █████╗ ███████╗███████╗
██╔══██╗██║  ██║██╔══██╗██╔════╝██╔════╝
██████╔╝███████║███████║███████╗█████╗
██╔═══╝ ██╔══██║██╔══██║╚════██║██╔══╝
██║     ██║  ██║██║  ██║███████║███████╗
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝

██╗     ██╗ ██████╗███████╗███╗   ██╗
██║     ██║██╔════╝██╔════╝████╗  ██║
██║     ██║██║     █████╗  ██╔██╗ ██║
██║     ██║██║     ██╔══╝  ██║╚██╗██║
███████╗██║╚██████╗███████╗██║ ╚████║
╚══════╝╚═╝ ╚═════╝╚══════╝╚═╝  ╚═══╝

███╗   ███╗██╗   ██╗██████╗
████╗ ████║██║   ██║██╔══██╗
██╔████╔██║██║   ██║██████╔╝
██║╚██╔╝██║╚██╗ ██╔╝██╔═══╝
██║ ╚═╝ ██║ ╚████╔╝ ██║
╚═╝     ╚═╝  ╚═══╝  ╚═╝
```

# 🎉 Phase 7 Licensing MVP Has Shipped Its First Shape

Quest: `phase-7-licensing-mvp_2026-04-30__2240`

This was not a dainty little feature. It was commercial policy, local crypto, macOS storage, Sparkle update behavior, CI secret boundaries, hosted-web isolation, Xcode membership, and the sort of release gate that says "no" with a clipboard and a badge.

It still landed. Properly reviewed. Properly fixed. Properly closed.

## 🎭 Cast

| Role | Model | Label |
|---|---|---|
| plan-reviewer-a | Claude / Codex fallback | The A Plan Critic |
| plan-reviewer-b | GPT-5.5 / Codex | The B Plan Critic |
| arbiter | Claude / Codex fallback | The Gatekeeper With A Clean Knife |
| builder | GPT-5.5 / Codex | The Licensing Mechanic |
| code-reviewer-a | Codex | The A Code Critic |
| code-reviewer-b | Codex | The B Code Critic |
| fixer | Codex | The Cleanup Specialist |

## 🏆 Achievements Unlocked

⭐️ **Free Forever, Honestly** — the Mac app can remain usable without payment, with reminders instead of lockout.

🔒 **Public-Key Boundary Held** — verifier code and public keys live in the app; signing keys, merchant secrets, and customer records stay out of repo and CI.

🧪 **Save-Count Friction, Not Save Interruption** — reminders moved to successful-save completion and survived review.

📡 **Sparkle Stays In Its Lane** — update checks stay independent from license enforcement, with licensed monthly-check preference separated from token storage.

🌐 **Hosted Web Stayed Clean** — no license UI, no checkout path, no license-like browser storage, and stronger network initiation guards.

⚙️ **Release Gate With A PR Escape Hatch** — distribution Release fails closed on dev key material, while PR Release compile remains possible through an explicit no-secrets flag.

📚 **Commercial Docs Got Their Adult Supervision** — tax/sales ownership, disabled purchases, `doc2md.dev`, and the private issuer boundary are now written down before anyone takes money.

## 📊 Impact Metrics

| Signal | Result |
|---|---|
| Plan iterations | 3, because the sharpen pass changed real product behavior |
| Fix iterations | 2, both targeted and both re-reviewed |
| Final review state | Two clean final code-review handoffs |
| Validation posture | Web tests, lint, builds, Swift focused tests, security guard, manifest, and Release gate checks recorded |
| Trust boundary | Private signing keys never entered the public repo, app binary, PR CI, or release CI |

## 🔁 Handoff Reliability Snapshot

Every routed agent wrote a structured `handoff.json`. The workflow had rough edges — Claude bridge limits forced Codex-only fallback for the later review/build phases, and the first review pass produced schema repairs — but the artifact trail held.

That is what the system is for: not pretending the road is smooth, just making sure the wheels stay attached.

## 🥈 Quality Tier: Silver

Silver is honest here. The implementation shipped with meaningful value and clean final review, but it took three plan iterations, two fix loops, a schema repair, a bridge fallback, and one build-helper guard that needed a second look.

No shame in that. Commercial licensing touches sharp surfaces. The point is that the final state is reviewed, validated, and considerably less fragile than where it began.

## 📜 Real Quote

> "Final-pass review found no remaining issues in the native API allowlist scan or Release build override behavior."
>
> — Code Reviewer A, final pass

## 🎯 Victory Narrative

Phase 7 proved the project can add a paid Mac-app path without poisoning the free hosted web app or turning licensing into a document-workflow dependency. The user corrected the product model mid-flight — no trial, no launch/day nags, save-count reminders instead, disabled purchases until real operations exist — and the plan absorbed that without becoming mush.

The code then took the necessary punishment: public key decoding, reminder ordering, hosted-network guards, Quest manifest drift, PR/release gate separation, and recursive native API scanning. Each one was the sort of flaw that looks small until it ships and starts charging rent.

It did not ship that way.

— Jean-Claude, who is not often impressed but is today
