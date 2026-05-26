# 049 — Requiem: Mobile Real Device Fix
<!-- quest-id: mobile-real-device-fix_2026-05-23__0940 -->
<!-- pr: none -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-05-26 -->

```
██████╗ ██╗██████╗
██╔══██╗██║██╔══██╗
██████╔╝██║██████╔╝
██╔══██╗██║██╔═══╝
██║  ██║██║██║
╚═╝  ╚═╝╚═╝╚═╝

███╗   ███╗ ██████╗ ██████╗
████╗ ████║██╔═══██╗██╔══██╗
██╔████╔██║██║   ██║██████╔╝
██║╚██╔╝██║██║   ██║██╔══██╗
██║ ╚═╝ ██║╚██████╔╝██████╔╝
╚═╝     ╚═╝ ╚═════╝ ╚═════╝

██╗   ██╗██╗███████╗██╗    ██╗
██║   ██║██║██╔════╝██║    ██║
██║   ██║██║█████╗  ██║ █╗ ██║
╚██╗ ██╔╝██║██╔══╝  ██║███╗██║
 ╚████╔╝ ██║███████╗╚███╔███╔╝
  ╚═══╝  ╚═╝╚══════╝ ╚══╝╚══╝
```

🕯️ ⚰️ 🌑 ⚰️ 🕯️

> _A requiem for the mobile bug that was not in the branch anymore, only in the deployed past._

---

## 🪦 Epitaphs

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lies desktop-only mobile testing.   │
    │  It resized a browser and called it       │
    │  a phone. The phone disagreed.            │
    │                                           │
    └───────────────────────────────────────────┘
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lies the stale Pages asset. It      │
    │  wore last week’s CSS into today’s        │
    │  screenshot and acted surprised when      │
    │  the crime scene looked old.              │
    │                                           │
    └───────────────────────────────────────────┘
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lies unconditional editor           │
    │  autofocus. It woke the textarea on       │
    │  mount, dirtied the wrong desktop path,   │
    │  and was replaced by intent.              │
    │                                           │
    └───────────────────────────────────────────┘
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lies the brittle recovery helper.   │
    │  It waited for a button the visible       │
    │  upload panel did not owe it.             │
    │                                           │
    └───────────────────────────────────────────┘
```

---

## ⚰️ Pallbearers

| Role | Runtime | Dexter's Description |
|------|---------|---------------------|
| Planner | Codex | Wrote down the ugly possibility: the public bug might be a deployment fossil. |
| Plan Reviewer A | Codex | Forced the plan to prove the phone path, not just resize the room. |
| Plan Reviewer B | Codex | Asked for CI to remember the devices humans actually hold. |
| Arbiter | Codex | Approved iteration two after the evidence path stopped hand-waving. |
| Builder | Codex | Added mobile Chromium, mobile WebKit, CI wiring, and one restrained focus fix. |
| Code Reviewer A | Codex | Passed the slice and checked the manifest, units, and mobile regression command. |
| Code Reviewer B | Codex | Timed out once, came back, and left no body on the floor. |

---

## 💀 Coroner's Report

> The branch now runs hosted mobile layout coverage under named Pixel 7 and iPhone 14 Playwright projects, and CI installs both Chromium and WebKit before executing the mobile spec. The deployed site, however, was wearing old assets: no `app-shell-hosted`, no current mobile rule, no current hero copy. Cause of death: stale deployment evidence, compounded by a test suite that had been looking at phone-sized windows instead of mobile browser descriptors. Complication: WebKit exposed an editor autofocus side effect, which was cut down to explicit editor-focus requests.

---

## 📜 Last Words

> _"Completed Code Reviewer B pass with no blocking findings in the scoped mobile-device fix diff."_
>
> - Code Reviewer B, final handoff

---

## ☠️ Cause of Death Rating

🥇 **GOLD** - It landed clean after dual code review and zero fixer loops. It does not get a better coffin because the original real-phone symptom still needs a cache-busted post-deploy physical check.

---

## 📊 Mortality Statistics

| Metric | Reading |
|--------|--------:|
| Plan iterations | 2 |
| Fix iterations | 0 |
| Mobile browser projects added | 2 |
| Targeted mobile e2e result | 18 passing |
| Full unit result | 726 passing |
| Code-review findings | 0 |
| Live stale selectors found | 0 `app-shell-hosted` |
| Physical-phone checks performed by agent | 0 |
| Codex-only phases | all of them |

---

_Mood: darkly-amused. The body was not where the screenshot said it was. That is why we check the deployment before operating on the patient._

- Dexter, coroner on duty

_Content and rendering by Dexter._
