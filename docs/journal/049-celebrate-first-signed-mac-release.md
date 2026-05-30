# 049 — Celebration: The First Signed Mac Release

```
   ███████ ██  ██████  ███    ██ ███████ ██████
   ██      ██ ██       ████   ██ ██      ██   ██
   ███████ ██ ██   ███ ██ ██  ██ █████   ██   ██
        ██ ██ ██    ██ ██  ██ ██ ██      ██   ██
   ███████ ██  ██████  ██   ████ ███████ ██████   ·  shipped  2.6.8
```

**Release 2.6.8 — the Mac pipeline crossed the finish line for the first time.**
Build → sign → notarize → DMG → notarize DMG → Sparkle ZIP → appcast → publish.
Every box green. Real artifacts on the releases page: a signed, notarized
`doc2md-2.6.8.dmg`, a Sparkle `doc2md-2.6.8.zip`, and an `appcast.xml` that no
longer 404s. After a long line of failures stretching back to 2.3.2, the wall
is down.

## The Long Hunt, Honestly Told

It opened with a cryptic line — `SecKeychainItemImport: Unknown format in
import` — and I made it harder than it was. For two rounds I theorized about the
secret: base64 whitespace, stray quotes, double-encoding, the environment
scope, the cipher. We re-uploaded `MACOS_CERTIFICATE` clean via the API. Same
error. The secret had been innocent the entire time.

The turn came from Kjell, not me. **"It isn't something silly like it assumes
the .p12 is in a different format?"** That question cut straight through the
noise. It was exactly that: `security import` infers the format from the file
*extension*, and the signer fed it a `mktemp` file with no `.p12` suffix — so it
failed at format inference before it ever read the password. One flag,
`-f pkcs12`, and "Unknown format" was gone.

That uncovered the next honest layer, this time named by our own instrumentation
rather than guessed: `The specified item could not be found in the keychain` —
because `create_keychain` never set the keychain as default or added it to the
search list. Two `security` calls, mirrored from the proven candid_talent_edge
pipeline, and the identity was found.

Both bugs lived in the signing code the whole time. Both were one line.

## Credit Where It's Due

The decisive insight was Kjell's. I chased the inputs; he questioned the tool.
The lesson I'm keeping: when an external command fails cryptically, read the
*exact* invocation and reproduce it locally before theorizing about what you fed
it. The diagnostics we added (decoded byte size, first byte) are the version of
that lesson written into the code — the next failure will name itself.

## Also Landed

PR #164 carried the keychain fix; #163 carried `-f pkcs12` and the
self-diagnosing decode log; #160 started it all with the base64 hardening. And a
follow-up collapses the release from three approval gates to one — three jobs
that each entered `mac-release` are now a single signed-and-published job.

## Quality Tier: Diamond

Diamond. Not because the path was clean — it wasn't, and I own the wrong turns —
but because the outcome is a fully signed, notarized, auto-updatable public
release where there had never been one, every root cause is understood and
reproduced rather than patched by superstition, and the pipeline now explains
itself when it breaks.

> it isn't something silly like it assumes the .p12 is in a different format?
>
> — Kjell, asking the one question that ended the hunt

## Victory Narrative

The certificate was always valid. The bytes were always right. The tool just
needed to be told what it was holding, and pointed at the drawer to put it in.
Two sentences of `security`, and doc2md ships signed.

— Jean-Claude, who is not often impressed but is today
