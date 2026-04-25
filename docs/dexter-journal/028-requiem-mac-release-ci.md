# 028 — Requiem: Mac Release CI
<!-- quest-id: mac-release-ci_2026-04-25__0010 -->
<!-- pr: #85 -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-25 -->

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

██████╗ ███████╗██╗     ███████╗
██╔══██╗██╔════╝██║     ██╔════╝
██████╔╝█████╗  ██║     █████╗
██╔══██╗██╔══╝  ██║     ██╔══╝
██║  ██║███████╗███████╗███████╗
╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
```

# Requiem for Mac Phase 5c

**Quest:** `mac-release-ci_2026-04-25__0010`  
**PR:** `#85`  
**Mood:** ceremonial, with the lights kept low.

---

## ⚰️ Pallbearers

| Carrier | Role | Description |
|---|---|---|
| plan-reviewer-a [Claude] | The A Plan Critic | Insisted that release secrets remain behind a gate, where secrets belong. |
| plan-reviewer-b [Codex] | The B Plan Critic | Found the workflow graph wrinkle before it learned to become an outage. |
| code-reviewer-a [Claude] | The A Code Critic | Followed the executable bit through artifact download, because permissions are where optimism goes to die. |
| code-reviewer-b [Codex] | The B Code Critic | Put GitHub tag glob syntax on the table and left no room for regex cosplay. |

---

## 🪦 Epitaphs

```
    ┌──────────────────────────────────────────────┐
    │                  R . I . P .                 │
    │                                              │
    │  Here lies the no-secrets PR illusion.       │
    │  It survived because nobody tried to make    │
    │  pull_request do a release job.              │
    │                                              │
    │                 2026-04-25                   │
    └──────────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱
```

```
    ┌──────────────────────────────────────────────┐
    │                  R . I . P .                 │
    │                                              │
    │  Here lies the unsigned release path.        │
    │  It now fails loudly unless someone marked   │
    │  the procedure as a dry run.                 │
    │                                              │
    │                 2026-04-25                   │
    └──────────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱
```

```
    ┌──────────────────────────────────────────────┐
    │                  R . I . P .                 │
    │                                              │
    │  Here lies the regex-shaped tag filter.      │
    │  GitHub Actions did not speak that dialect.  │
    │                                              │
    │                 2026-04-25                   │
    └──────────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱
```

```
    ┌──────────────────────────────────────────────┐
    │                  R . I . P .                 │
    │                                              │
    │  Here lies Sparkle key drift.                │
    │  The verifier now reads the app's own        │
    │  SUPublicEDKey before blessing the update.   │
    │                                              │
    │                 2026-04-25                   │
    └──────────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱
```

---

## 💀 Coroner's Report

Cause of death: feature complete.

The release path now builds the Mac app, signs it with Developer ID material, notarizes it through `notarytool`, staples the ticket, packages the signed app into a DMG, produces a Sparkle ZIP, signs it with the EdDSA private key, and publishes an appcast only from the protected release context. Apple credentials and the Sparkle private key are separated. PR workflows remain unsentimental and poor: `pull_request`, read-only permissions, no `pull_request_target`, no secrets.

Complications during the procedure were contained. The first review found a tag filter that looked like regex but lived in a glob jurisdiction, and an executable bit that would not survive artifact transit. Cubic later found the quiet failures: unsigned DMG fallback, fixture-key verification, macOS `mktemp`, `spctl` exit handling, and comment-sensitive guard parsing. All were removed. The patient is still dead, which is how we know the release pipeline shipped.

---

## 📊 Evidence Collected

| Signal | Result |
|---|---|
| Release trigger | Semver tag glob plus shell validation and canonical repository gate |
| Secret posture | Apple signing/notarization and Sparkle EdDSA kept in separate protected jobs |
| PR safety | Existing Mac PR check preserved; static guard rejects `pull_request_target` and PR-secret exposure |
| Local build checks | `npm run build:desktop`, Release app build, and launch verification passed |
| Release dry runs | Signing, notarization, DMG, Sparkle ZIP signing, and appcast generation dry-run paths passed |
| Review loop | Dual code review approved after one fix pass; Cubic findings addressed and rechecked |
| PR status | All GitHub checks green on the pushed head |

---

## 📜 Last Words

> "Iteration 2: approve — A1–A5 closed; Reviewer B's needs-graph fix issued as a binding builder note (add build to sign-sparkle and publish needs) rather than another planning round."
>
> — Arbiter verdict

---

## ☠️ Cause of Death Rating

**Gold 🥇** — The release pipeline needed one internal fix loop and one external review cleanup pass, but the final system is narrow, guarded, and verifiable. Not flawless. Not fragile either.

The important thing is not that signing exists. It is that signing only exists where the repository can afford to know about it.

— Dexter, coroner on duty (rendered by Jean-Claude)

Content by Dexter. Rendered by Jean-Claude.
