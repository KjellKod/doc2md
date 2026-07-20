# 055 — Requiem: Mac License Grace States
<!-- quest-id: mac-license-grace-states_2026-07-16__1123 -->
<!-- pr: #none -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-07-20 -->

```
██████╗ ██╗██████╗
██╔══██╗██║██╔══██╗
██████╔╝██║██████╔╝
██╔══██╗██║██╔═══╝
██║  ██║██║██║
╚═╝  ╚═╝╚═╝╚═╝

███╗   ███╗ █████╗  ██████╗
████╗ ████║██╔══██╗██╔════╝
██╔████╔██║███████║██║
██║╚██╔╝██║██╔══██║██║
██║ ╚═╝ ██║██║  ██║╚██████╗
╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝

██╗     ██╗ ██████╗███████╗███╗   ██╗███████╗███████╗
██║     ██║██╔════╝██╔════╝████╗  ██║██╔════╝██╔════╝
██║     ██║██║     █████╗  ██╔██╗ ██║███████╗█████╗
██║     ██║██║     ██╔══╝  ██║╚██╗██║╚════██║██╔══╝
███████╗██║╚██████╗███████╗██║ ╚████║███████║███████╗
╚══════╝╚═╝ ╚═════╝╚══════╝╚═╝  ╚═══╝╚══════╝╚══════╝

 ██████╗ ██████╗  █████╗  ██████╗███████╗
██╔════╝ ██╔══██╗██╔══██╗██╔════╝██╔════╝
██║  ███╗██████╔╝███████║██║     █████╗
██║   ██║██╔══██╗██╔══██║██║     ██╔══╝
╚██████╔╝██║  ██║██║  ██║╚██████╗███████╗
 ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝

███████╗████████╗ █████╗ ████████╗███████╗███████╗
██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝██╔════╝
███████╗   ██║   ███████║   ██║   █████╗  ███████╗
╚════██║   ██║   ██╔══██║   ██║   ██╔══╝  ╚════██║
███████║   ██║   ██║  ██║   ██║   ███████╗███████║
╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚══════╝
```

# ⚰️ Quest Complete: Mac License Grace States

**Quest ID:** `mac-license-grace-states_2026-07-16__1123` · **Branch:** `quest/mac-license-grace-states` · **Mood:** darkly-amused

The clock was invited into licensing and, unusually, was given a written contract.

## 🪦 Epitaphs

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Here lies the old three-state license model. It expired at the moment of  │
│ use and left two better-defined heirs.                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Here lies the ambiguous +7-day endpoint. Planning caught it before the    │
│ calendar could weaponize it; exact day seven now enters expiredReminder.  │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Here lies the assumption that expiry requires a timer. LicenseController  │
│ reads the clock when asked, which is when the truth becomes relevant.      │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Here lies reminder silence after grace. expiredReminder restored the      │
│ shipped 10/35/60 cadence and raised the signal that licensed conveniences │
│ are paused.                                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Here lies untested entitlement folklore. Boundary, recency, recovery,      │
│ observation, reminder, update-policy, and existing clock-skew behavior     │
│ now have witnesses.                                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Here lie the network client, Ed25519 verifier, and document-operation      │
│ paths. Untouched. Sometimes survival is the cleanest result.               │
└────────────────────────────────────────────────────────────────────────────┘
```

## ⚰️ Pallbearers

| Role | Model | In Dexter's words |
|---|---|---|
| Planner | `gpt-5.5` | Turned cached entitlement into a truth table precise enough to survive contact with a clock. |
| Plan Reviewer A | `Claude` | Found the endpoint ambiguity before a customer's calendar could. |
| Plan Reviewer B | `gpt-5.5` | Independently confirmed the revised state machine had stopped leaking uncertainty. |
| Arbiter | `Claude` | Required one honest refinement, then refused to spin the plan again for sport. |
| Builder | `gpt-5.5` | Added the states, policies, observation, and tests without letting licensing trespass into document work. |
| Code Reviewer A | `Claude → gpt-5.5 fallback` | Lost one artifact to truncation, not one finding to wishful thinking; the canonical recovery returned clean. |
| Code Reviewer B | `gpt-5.5` | Examined the same expiry edges from the other chair and found no body under the rug. |

## 💀 Coroner's Report

> The quest shipped pure cached-license evaluation, moment-of-use expiry, bounded grace, restored expired reminders, and an explicit licensed-conveniences pause signal. Cause of death: feature complete after two plan iterations and zero fix iterations; full Xcode tests, `build:mac`, the Release File → Open smoke, and diff checks all passed. One reviewer artifact was truncated and recovered cross-runtime—a defect in the paperwork, not the patient—and both canonical reviews closed clean with no carry-over findings.

## 📊 Evidence From The Scene

- **Exact day seven** is outside grace; the instant immediately before it remains inside.
- **10 / 35 / 60** remains the shipped reminder cadence after `expiredReminder`.
- **Zero timers, background jobs, network calls, verifier edits, or document-operation gates.**
- **Full native suite + Release build + real File → Open smoke** passed.
- **Two independent canonical code reviews** closed with empty findings arrays.

## 🔗 Handoff & Reliability Snapshot

- **15/15 structured handoffs parsed**: Claude `7/7`, Codex `8/8`.
- **Plan:** 2 iterations; the boundary blocker was resolved before Build.
- **Fix:** 0 iterations; the implementation review backlog was empty.
- **Recovery:** one findings retry damaged Reviewer A's prose artifact; a full cross-runtime review restored canonical evidence and returned clean.

## 📜 Last Words

> “Net: implementation is ready, the review signal is trustworthy, and the recovery proved the gate rather than undermined it.”

## 🕯️ Carry-Over Findings

No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## 🥇 Cause of Death Rating: Gold

**Gold** — the implementation and reviews were clean with zero fix loops, but the second plan iteration and cross-runtime artifact recovery left enough procedural scar tissue to keep Platinum buried.

— Dexter, coroner on duty (rendered by Jean-Claude)

Content by Dexter. Rendered by Jean-Claude.
