# 048 — Celebration: The Certificate That Held Its Breath

```
   ██████  ██  ██████  ███    ██ ███████ ██████
   ██      ██ ██       ████   ██ ██      ██   ██
   ███████ ██ ██   ███ ██ ██  ██ █████   ██   ██
        ██ ██ ██    ██ ██  ██ ██ ██      ██   ██
   ██████  ██  ██████  ██   ████ ███████ ██████
```

**PR #160 — Fix Mac CI signing: strip whitespace before base64-decoding the P12**

## The Bug, Briefly

The Mac release signing job had never once succeeded. Run after run, all the
way back to 2.3.2. The version and tag fixes (#155, #156) cleared the early
hurdles, and run 2.6.4 finally walked far enough to reach the signing step —
where it promptly faceplanted on:

```
security: SecKeychainItemImport: Unknown format in import.
```

The seduction was "it works locally." It does. But local signing uses an
identity already living in the login Keychain and never decodes a thing. The CI
path is the *only* one that base64-decodes the `MACOS_CERTIFICATE` secret — and
BSD `base64` on the macOS runners chokes on the line-wrapping newlines a
base64-encoded secret carries, writing garbage while cheerfully returning exit
0. The failure surfaced three steps downstream wearing a disguise.

The sibling repo had already solved this and left a note in the margin:
`tr -d '\n\r '`. We were one pipe short.

## What Landed

- Strip `\n\r ` before decoding — matching the proven `candid_talent_edge` path.
- Fail loud at the decode site: empty file, or a first byte that isn't `0x30`
  (the DER SEQUENCE tag every PKCS#12 opens with), now gets an actionable
  message instead of the cryptic security-tool koan.
- The same whitespace strip on the notary `.p8` branch, before the next domino
  could fall.
- A source-guard plus `tests/release/test_p12_decode.sh`, now wired into CI, so
  this exact failure can never sneak back in unobserved.

## Coroner's Counterpoint

Dexter reviewed it before it shipped and, for once, signed off without a single
epitaph. He did leave one tidy note — the keychain password default was spawning
`uuidgen` at source time — which is now scoped inside `create_keychain`. The
corpse, he noted, is in the right drawer.

## Quality Tier: Gold

Gold. The root cause was named from evidence, not vibes; the fix mirrors a
known-good implementation; and even if whitespace wasn't the *whole* story, the
new guard guarantees the next run confesses the real cause instead of mumbling
"Unknown format." We stopped guessing.

> our mac signing doesn't seem to work on the CI. I'm pretty sure it works
> locally [...] We want to analyze this first, not guessing.
>
> — Quest prompt

## Victory Narrative

The best kind of bug: one cryptic error, one disciplined trace, one pipe of
`tr`, and a test so it stays dead. The certificate was valid the whole time. It
had simply learned to hold its breath at column 76, and nobody had asked it to
exhale.

— Jean-Claude, who is not often impressed but is today
