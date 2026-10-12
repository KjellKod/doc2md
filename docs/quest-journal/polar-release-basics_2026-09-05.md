# Quest Journal: Polar Release Basics

- Quest ID: `polar-release-basics_2026-09-05__1518`
- Slug: polar-release-basics
- Completed: 2026-09-05
- Mode: workflow
- Quality: Gold
- Celebration: [`../dexter-journal/057-requiem-polar-release-basics.md`](../dexter-journal/057-requiem-polar-release-basics.md)
- Outcome: Official unsigned builds receive and verify the public Polar organization UUID, developers have an isolated Debug-only Polar sandbox build, and Mac recovery opens the correct support email with subject.

## What Shipped

- Fail-closed production UUID validation from GitHub Actions variable through the built plist.
- Fixed production and sandbox Polar hosts selected at compile time.
- Debug-only sandbox build with separate UUID, Polar persistence namespace, bundle identifier, and visible non-production names.
- Exact `mailto:support@candidtalentedge.com?subject=doc2md%20support` recovery destination and purchase-email guidance.
- Focused regression coverage for configuration, separation, support, workflow, and artifact plist contracts.

## Validation

- 43 focused Python tests passed.
- Targeted production and sandbox Swift suites passed.
- Real Release and sandbox artifacts passed plist assertions.
- `actionlint` and `python3 scripts/security_ci_guard.py` passed.
- Both code reviewers returned zero findings after one fix iteration.
- Manual Finder, application-menu, and offline document smoke remains unchecked after Computer Use returned `cgWindowNotFound`.

## Files Changed

- `.github/workflows/release-mac.yml`
- `scripts/build-mac-app.sh`
- `apps/macos/README.md`
- `apps/macos/doc2md.xcodeproj/project.pbxproj`
- `apps/macos/doc2md/Info.plist`
- `apps/macos/doc2md/Licensing/LicenseController.swift`
- `apps/macos/doc2md/Licensing/PolarLicenseClient.swift`
- `apps/macos/doc2md/Licensing/PolarLicensePersistence.swift`
- `apps/macos/doc2mdTests/Licensing/PolarLicenseClientTests.swift`
- `apps/macos/doc2mdTests/Licensing/PolarLicenseControllerTests.swift`
- `apps/macos/doc2mdTests/Licensing/PolarLicensePersistenceTests.swift`
- `tests/unit/test_build_mac_native_api_guard.py`
- `tests/unit/test_release_polar_configuration.py`
- `docs/implementation/mac-commercial-distribution-and-licensing.md`
- `docs/implementation/mac-commercial-distribution-decision-record.md`
- `docs/dexter-journal/057-requiem-polar-release-basics.md`
- `docs/dexter-journal/058-polar-release-basics.md`
- `docs/dexter-journal/README.md`
- `docs/diary/2026-09-05.md`

## Iterations

- Plan iterations: 2
- Fix iterations: 1
- Dual plan reviews: 2 rounds
- Dual code reviews: 2 rounds

## Agents

- Planner: gpt-5.6-sol
- Plan Reviewer A: claude-opus-5 via background-agent
- Plan Reviewer B: gpt-5.6-terra
- Arbiter: claude-opus-5 via background-agent
- Builder: gpt-5.6-sol
- Code Reviewer A: claude-opus-5 via background-agent
- Code Reviewer B: gpt-5.6-terra
- Review Arbiter: claude-opus-5 via background-agent
- Fixer: gpt-5.6-terra

## Carry-Over Findings

No findings were inherited and none were deferred.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "planner", "model": "gpt-5.6-sol", "role": "The Planner"},
    {"name": "plan-reviewer-a", "model": "claude-opus-5", "role": "The A Plan Critic", "transport": "background-agent"},
    {"name": "plan-reviewer-b", "model": "gpt-5.6-terra", "role": "The B Plan Critic"},
    {"name": "arbiter", "model": "claude-opus-5", "role": "The Plan Judge", "transport": "background-agent"},
    {"name": "builder", "model": "gpt-5.6-sol", "role": "The Implementer"},
    {"name": "code-reviewer-a", "model": "claude-opus-5", "role": "The A Code Critic", "transport": "background-agent"},
    {"name": "code-reviewer-b", "model": "gpt-5.6-terra", "role": "The B Code Critic"},
    {"name": "review-arbiter", "model": "claude-opus-5", "role": "The Review Judge", "transport": "background-agent"},
    {"name": "fixer", "model": "gpt-5.6-terra", "role": "The Fixer"}
  ],
  "claude_transport_counts": {"background-agent": 12},
  "achievements": [
    {"icon": "[RELEASE]", "title": "Fail Closed", "desc": "Official artifacts reject missing and malformed Polar UUIDs"},
    {"icon": "[SANDBOX]", "title": "Two Worlds Apart", "desc": "Sandbox host, identity, and Polar persistence are isolated"},
    {"icon": "[SUPPORT]", "title": "Correct Address", "desc": "Recovery uses the exact requested mailto destination"},
    {"icon": "[FIX]", "title": "One Pass", "desc": "Both medium review findings resolved in one fix iteration"}
  ],
  "metrics": [
    {"icon": "🧪", "label": "43 focused Python tests plus production and sandbox Swift suites"},
    {"icon": "🔒", "label": "Release and sandbox artifact plist assertions passed"},
    {"icon": "🚌", "label": "Claude transport: background-agent x12"}
  ],
  "quality": {"tier": "Gold", "grade": "B"},
  "inherited_findings_used": {"count": 0, "summaries": []},
  "findings_left_for_future_quests": {"count": 0, "summaries": []},
  "test_count": 43,
  "files_changed": 19
}
```
<!-- celebration-data-end -->
