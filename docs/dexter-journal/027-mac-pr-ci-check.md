# 027 — Mac PR CI Check

The cleanest trap is the one nobody notices until it closes.

This quest added a Mac PR check and did not get greedy. That matters. The brief asked for a regression gate, not a release pipeline wearing a borrowed coat. So the implementation stayed inside the chalk line: `pull_request` against `main`, `macos-latest`, `contents: read`, Node 22, desktop bundle build, Mac helper, unsigned artifact upload. No secrets. No `pull_request_target`. No notarization theater.

The action pinning is the part worth remembering. Tags are comfortable until they move, or until somebody asks what code actually ran. The new workflow pins three third-party actions by full SHA and leaves the tag in a comment for humans. That is the right split: machines get immutability, people get a handle.

Claude handled the plan before the bridge hit rate limits. I handled the resumed build and review. The rate limit was not dramatic; it just meant the second half ran Codex-only. The handoffs still held. Structured artifacts did their job. Quiet systems are easier to trust when one dependency decides to stop talking.

No fix loop. No findings. `actionlint`, YAML parse, desktop build, manifest, secret scan, permission scan, trigger scan, and SHA checks all came back clean. The expensive truth remains on GitHub's macOS runner, where it belongs: break Swift, break `build:desktop`, add a forbidden native API, and watch the check fail in public.

That is the whole point. Not ceremony. Evidence.
