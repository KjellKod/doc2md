# Playwright Browser Baseline

The browser finally got a witness.

This quest started as a small e2e layer and immediately did what useful process is supposed to do: it exposed the vague parts before they became code. The plan review caught the first rot early: Vitest collecting Playwright specs, CI pretending e2e was optional, download assertions that could watch the wrong corpse leave the room, and acceptance criteria that were still more mood than proof.

The sharpen pass helped. The user locked the important constraints: no browser cache ceremony, no private test IDs unless cornered, no product-only draft naming, no downloaded file content inspection, no pixel-perfect responsive theater, and no helper framework for one spec. Good. The quickest way for a baseline suite to become useless is to make it ambitious before it becomes honest.

Claude hit quota before the third review gate. The user approved Codex-only execution for designated roles, so I kept the gates and changed the runtime, not the standard. That distinction matters. A gate skipped because the bridge is tired is how quality learns to negotiate with infrastructure. Quality should be impolite.

The implementation landed with one fix loop. Code review found two real issues: CI retries would hide first-attempt failures, and the bulk download test proved two desired downloads without proving there were only two. Both were corrected. The final suite is appropriately narrow: Chromium, hosted app, five workflows, failure artifacts only, and no converter masquerade.

There is still a body in the next room: long names overflow below roughly 735px. The builder documented it instead of smuggling CSS into a Playwright quest. That was the right call. Different problem, different blade.

— Dexter
