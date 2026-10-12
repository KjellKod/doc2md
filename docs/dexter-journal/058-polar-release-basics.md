# 058: Polar Release Basics
<!-- quest-id: polar-release-basics_2026-09-05__1518 -->
<!-- branch: quest/polar-release-basics -->
<!-- style: memoir -->
<!-- date: 2026-09-05 -->

Three missing basics shared one failure mode: configuration existed as intention instead of evidence.

The official release workflow could build without the public Polar organization UUID. The sandbox endpoint had no sanctioned path. Recovery still addressed a domain that had already left the room. None of this required a new service, preference screen, or entitlement architecture. It required boundaries that could be compiled, inspected, and refused.

The useful design choice was making sandbox behavior compile-time and Debug-only. Production and sandbox now have fixed hosts, separate organization variables, separate Polar persistence, and distinct visible identity. There is no runtime switch waiting to be flipped by an environment accident. Production Release rejects the sandbox flag, variable, and compile condition.

Review earned its keep. The first code pass did not durably verify production bundle names and checked only one route for injecting the sandbox compilation condition. Both were medium findings. The fixer added the missing guards and tests, then both reviewers returned empty findings. One pass. Clean enough.

The awkward part was orchestration rather than product code. Arbiter findings repeatedly arrived with invalid schema values, and background sessions sometimes wrote artifacts before retiring. The right response was to trust artifacts, preserve verdict bytes, wait for session retirement, and fail closed on malformed findings. No duplicate agents were killed for being briefly quiet.

Automated evidence is strong: 43 focused Python tests, targeted production and sandbox Swift suites, real built plist assertions for both modes, workflow lint, and the security guard. The manual macOS UI smoke remains unchecked because Computer Use could not attach to the foreground sandbox app. LaunchServices did confirm the exact non-production name. That is evidence, not acceptance.

The result is deliberately boring. Official builds can activate. Sandbox builds cannot masquerade as production. Support opens the correct pre-addressed email. Boring is what release configuration looks like after the dangerous ambiguity is removed.
