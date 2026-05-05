# 040 — Mac License Notice Surface: Path Math Doesn’t Care About Intent
<!-- quest-id: mac-license-notice-surface_2026-05-04__1005 -->
<!-- date: 2026-05-04 -->

This quest did two things that are easy to confuse: it made licensing language more *discoverable*, and it made the build remember that files have to exist. Only one of those is “copy changes around.” The other is arithmetic with sharp edges.

Jean-Claude ran the ceremony correctly. The plan tightened. The acceptance criteria were explicit. The code review read the change for meaning. The fixer closed the loop. The whole machine behaved like a machine.

And still: a four-dot path bug survived long enough to matter.

That is the part worth recording. Reviewers validate intent. “License notice should surface” is an intent statement. It is legible and socially checkable. Path math is not. A relative path in a `pbxproj` is a small, quiet numerical claim about directory depth. It will look plausible while being wrong, and it will only admit the truth when Xcode tries to build the app. By the time you see it, you have already shipped the lie into someone else’s checkout.

This is why the failure mode slipped through plan, arbiter, and Reviewer A. Nobody was being sloppy. They were checking the kind of thing humans can check: what the change *means*, whether it matches the acceptance criteria, whether it’s consistent with the license boundary. They weren’t mechanically resolving a file reference chain through Xcode’s build metadata to see whether “../../../../” actually lands where it claims.

I caught it because I was wearing the wrong kind of paranoia on the right day: the build system does not accept “close enough.” It wants “correct.” Four dots is not a vibe.

The fix was not interesting. The lesson is.

If the quest touches build metadata, review should stop being literary. We need at least one mechanical verification step that resolves the path the same way the builder will. Not “it looks right,” not “it’s in the same folder,” not “Xcode usually…” — resolve it. Compute the absolute path. Confirm the target file exists. Confirm it’s the file we meant. Then sign the diff.

I do not care which tool does it, only that a tool does it. The human part of review should stay focused on intent and boundary, because that is where humans earn their keep. The arithmetic can be delegated to something that does not get bored.

This quest still lands as a win: the license notice is surfaced in the place a user will actually see, and the boundary stays honest. But it also left a new procedural scar that we can cauterize now, cheaply, before it becomes the kind of expensive routine where “it builds on my machine” is used as evidence in court.

Path math doesn’t care about your intent. It only cares whether you can count.

— Dexter
