# How To Make Agentic CI Worth Trusting

Most agentic CI fails in a boring way: it says a lot, proves very little, and disappears exactly when you need it to be honest.

We tightened this repo's CI to do the opposite.

Now the core build checks fail in plain sight as separate jobs. The Codex review lane always leaves a visible PR comment, even when it times out, errors, returns nothing, or has every finding deduplicated away. Review inputs and outputs are saved as artifacts so you can inspect what really happened. And the squishier review lanes stay advisory until they earn the right to block anything.

That is the whole game. Not "more AI in CI." More trust.

## Start with the thing humans actually need

When someone opens a PR, they are usually trying to answer four simple questions:

1. Did the code pass the hard build checks?
2. Did the automated reviewer actually run?
3. If it ran, what did it see and what did it miss?
4. Is this signal strong enough to change my decision?

If your workflow cannot answer those questions fast, the automation is theater.

That is why we split the old monolithic CI job into `lint-and-type`, `test`, and `build`. A red build should say what is red. "CI failed" is not a diagnosis. It is a shrug.

## Make the AI lane tell the truth

The easy mistake is treating "the agent process exited" as the same thing as "the review was useful."

Those are different.

An agentic review lane can:

- time out
- crash
- return garbage
- return an empty array
- produce findings that were already posted earlier
- inspect only part of a large diff

If any of those happen and the PR shows nothing visible, people stop trusting the lane. They should.

So we made the Codex review path leave a summary comment every time. Not only on success. Every time.

That means the workflow now says things like:

- review timed out
- review failed with exit code N
- review ran, no findings
- review ran, but the output was not parseable
- review ran, but every finding was already covered

That kind of honesty sounds small until the first time a reviewer wonders whether the bot silently vanished. Then it matters a lot.

## Pull the logic out of YAML

Huge YAML files are a terrible place to hide behavior you might need to debug.

We moved the review preparation and review posting logic into small Python scripts:

- `scripts/codex_review_prepare.py`
- `scripts/codex_review_post.py`
- `scripts/intent_review.py`

That buys us three things immediately:

- local `--help` support
- unit tests around the real logic
- a workflow file that reads like orchestration instead of a blob of embedded parsing code

This is one of the most practical agentic CI rules: if the behavior matters, put it somewhere you can test and read without scrolling through shell glue for ten minutes.

## Save the evidence

When an AI lane misbehaves, the worst answer is "not sure what it saw."

So the workflow uploads the prompt, metadata, and review output as artifacts. That gives maintainers a paper trail:

- how big the diff was
- whether it was truncated
- what prompt was actually sent
- whether the reviewer returned anything usable

Without artifacts, debugging turns into folklore. With artifacts, you can inspect the run and decide whether the problem was prompt size, bad output, or plain model failure.

## Keep soft checks soft until they mature

We also added an `intent-review` lane that checks whether the PR title/body matches the changed files.

It is intentionally heuristic and intentionally advisory.

Why not make it required right away? Because a check that cries wolf on day one teaches everyone the wrong lesson. People stop reading it, then they stop trusting the required checks nearby too.

The better pattern is:

1. Ship the check as advisory.
2. Watch it on real PRs.
3. Fix the embarrassing false positives.
4. Promote it only after it has been boringly reliable for a while.

That is slower than declaring victory early. It is also how you avoid building an expensive noise machine.

## Alternatives we considered

### One big CI job

It is shorter on paper, but it hides the failure mode. We rejected it because humans should not have to read logs just to learn whether lint, tests, or build broke.

### Keep the review logic inline in workflow YAML

It looks fast at first. Then the first weird edge case shows up and nobody wants to touch it. We rejected it because important behavior deserves tests and named functions.

### Make the AI review lane required now

That would make branch protection look serious, but it would be fake seriousness. We rejected it because unstable automation should not pretend to be law.

### Use an LLM for intent review too

That might be smarter eventually. It is also slower, more expensive, and harder to reason about. We chose a cheap deterministic heuristic first because it is easier to audit and easier to demote if it gets noisy.

## The standard we are aiming for

Good agentic CI should be legible, inspectable, and humble.

Legible: you can tell what failed.

Inspectable: you can see what the automation actually did.

Humble: the workflow admits uncertainty instead of bluffing.

That is the pattern here. Hard checks stay hard. Soft checks stay advisory until proven. AI lanes always leave a visible outcome. And when the bot has limited context, the workflow says so out loud.

If you want agentic CI people will keep using after the novelty wears off, start there.
