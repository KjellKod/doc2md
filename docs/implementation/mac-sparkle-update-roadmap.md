# Mac Sparkle Update Roadmap

Status: Planned
Owner: KjellKod <kjell@candidtalentedge.com>
Date: 2026-06-08
Related: `apps/macos/doc2md/SparkleController.swift`, `apps/macos/doc2md/Info.plist`, `.github/workflows/release-mac.yml`, `scripts/release/generate_appcast.py`, `docs/implementation/mac-commercial-distribution-decision-record.md`, `docs/implementation/cloudflare-workers-deployment.md`

## Purpose

Make installed `doc2md.app` copies reliably discover, download, and install
new Mac releases without sending users to GitHub Actions artifacts or requiring
manual replacement of the app bundle.

The first implementation should use Sparkle's standard updater behavior as much
as possible. Sparkle already owns the hard parts: signed update verification,
skip-this-version semantics, download/install state, and install-and-relaunch
flow. Custom UI should be added only where Sparkle's standard startup prompt is
not good enough after manual testing.

## Current State

The Mac app already links Sparkle 2 and starts an updater:

- `apps/macos/doc2md/SparkleController.swift` creates
  `SPUStandardUpdaterController`.
- `checkForUpdates()` backs the `Check for Updates...` menu item.
- Startup can call `checkForUpdatesInBackground()` through the existing
  `UpdateCheckPolicy`.
- `apps/macos/doc2md/Info.plist` has the production Sparkle public key in
  `SUPublicEDKey`.
- The committed `SUFeedURL` is still the local fixture URL:
  `http://127.0.0.1:47654/appcast.xml`.
- `.github/workflows/release-mac.yml` already builds the Sparkle ZIP, signs it
  with `SPARKLE_EDDSA_PRIVATE_KEY`, generates `appcast.xml`, and uploads the
  DMG, ZIP, and appcast to the GitHub Release.

The missing pieces are production feed hosting, production `SUFeedURL`, release
validation against the public feed, and an explicit UX contract for startup
update prompts.

## Desired User Contract

The installed app should behave this way:

| Scenario | Required behavior |
|---|---|
| App starts and no update exists | Check silently in the background. Do not block launch, document open, conversion, save, or export. |
| App starts and a newer version exists | Show the user that an update is available. |
| User chooses download/update | Let Sparkle download and verify the update ZIP. |
| Update has downloaded | Present an `Install & Restart` path. If the user quits instead, Sparkle should still know about the pending update on a later launch. |
| User dismisses/cancels the update prompt | Check again on the next eligible startup. |
| User chooses `Ignore This Version` / skip | Do not prompt again for that same version. Prompt again only when the feed advertises a newer version. |
| Feed is offline or malformed | Launch normally, log/debug as appropriate, and try again on the next eligible startup. |
| User manually selects `Check for Updates...` | Always run an immediate visible Sparkle check, including when a startup check was recently attempted. |

## Product Decision

Recommended policy:

- Run startup checks frequently by default.
- Preserve the current licensed-user monthly throttle only if we still want a
  paid-user opt-down preference.
- If the product requirement is literal "check every startup for every user",
  remove or revise the `Monthly Update Checks` menu item and update the
  existing tests/docs that describe that licensed-user cadence.

Do not let this remain implicit. The code currently has a persisted monthly
cadence option for licensed users, so the implementation PR must either
preserve that behavior deliberately or remove it deliberately.

## Hosting Decision

Use `https://updates.doc2md.dev/appcast.xml` as the production feed URL.

The appcast may continue to point its enclosure at the GitHub Release ZIP:

```text
https://github.com/KjellKod/doc2md/releases/download/<tag>/doc2md-<version>.zip
```

The DMG remains the first-install artifact. Sparkle updates should use the ZIP,
not the DMG.

### Temporary Fallback

If Cloudflare is not ready but a working updater is needed sooner, use GitHub's
latest appcast URL temporarily:

```text
https://github.com/KjellKod/doc2md/releases/latest/download/appcast.xml
```

That can ship in one app PR. Moving from GitHub to `updates.doc2md.dev` later
requires a second app release because installed apps read `SUFeedURL` from the
bundle they already have.

Recommended launch path: finish the Cloudflare update endpoint first, then ship
one app PR that points directly at `updates.doc2md.dev`.

## PR Split

This can be one PR if the Cloudflare endpoint exists before implementation
starts.

Recommended one-PR scope after Cloudflare setup:

1. Point the app at `https://updates.doc2md.dev/appcast.xml`.
2. Finalize startup-check policy and tests.
3. Add release workflow validation for the public feed.
4. Add release notes support to the appcast if not already present.
5. Update Mac docs.

If Cloudflare setup is not ready, split it:

| PR | Scope | Blocks |
|---|---|---|
| PR 1: GitHub-backed production updater | Use GitHub latest appcast URL, startup behavior, tests, release validation. | Does not require Cloudflare. |
| PR 2: Cloudflare update host migration | Add/activate `updates.doc2md.dev`, point `SUFeedURL` there, validate the public endpoint. | Requires human Cloudflare setup. |

Avoid a third PR unless manual testing shows Sparkle's standard UI is not good
enough and custom gentle reminder UI is needed.

## Step 1 - Human Cloudflare Setup

Do this only if the recommended `updates.doc2md.dev` path is chosen.

Mirror the sketch2md pattern: CI direct-deploys a Worker, and the dashboard is
used for the API token plus custom domain attachment.

Use `docs/implementation/cloudflare-workers-deployment.md` as the shared
Cloudflare trust-posture reference: no-secret build jobs, fresh token-bearing
deploy jobs, pinned Wrangler, public-safe docs, and no committed account or
secret material. This update endpoint is a separate Worker/domain from the
hosted web app, but should follow the same operational posture.

- [ ] Confirm `doc2md.dev` is in the intended Cloudflare account.
- [ ] Create a scoped Cloudflare API token.
  - Minimum expected permissions for CI Worker deploy:
    `Account > Workers Scripts > Edit` and `Account > Account Settings > Read`.
  - If a future implementation stores feed files in R2 or KV, add only that
    specific storage permission then, not now.
  - Do not add broad zone permissions if the custom domain is attached manually.
- [ ] Note the Cloudflare Account ID.
- [ ] Create a GitHub Environment for update-host deploys, for example
  `cloudflare-updates-production`.
- [ ] Add environment secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- [ ] After the Worker exists, attach `updates.doc2md.dev` as a Worker custom
  domain in Cloudflare:
  `Workers & Pages` -> Worker -> `Settings` -> `Domains & Routes` ->
  `Add` -> `Custom Domain`.
- [ ] Wait for TLS to become active.
- [ ] Verify:

```bash
curl -I https://updates.doc2md.dev/appcast.xml
curl -fsSL https://updates.doc2md.dev/appcast.xml | xmllint --noout -
```

Do not commit account IDs, zone IDs, token IDs, dashboard screenshots, or
account-specific bypass notes.

## Step 2 - Cloudflare Update Worker

Recommended first implementation: a tiny Worker that proxies the canonical
GitHub Release appcast.

Required behavior:

- `GET /appcast.xml`
  - Fetches
    `https://github.com/KjellKod/doc2md/releases/latest/download/appcast.xml`.
  - Returns the upstream body with `Content-Type: application/xml`.
  - Uses conservative caching, for example `Cache-Control: public, max-age=300`.
  - Does not require authentication.
  - Does not mutate XML.
- `GET /health`
  - Returns `200 OK` with a small plain-text body.
- Other paths
  - Return `404`, or redirect only if a deliberate download surface is added.

Rationale:

- GitHub Releases remains the source of truth for signed release assets.
- Cloudflare gives the app a stable public update domain.
- We avoid building a second artifact mirror before there is a real need.

Future option:

- Mirror `appcast.xml` and update ZIPs into R2 only if GitHub availability,
  rate limits, analytics, or release control become a real problem.

## Step 3 - App Bundle Changes

Files likely touched:

- `apps/macos/doc2md/Info.plist`
- `apps/macos/doc2md/SparkleController.swift`
- `apps/macos/doc2md/Licensing/UpdateCheckPreferences.swift`
- `apps/macos/doc2mdTests/Licensing/SparkleUpdatePreferenceTests.swift`
- `apps/macos/README.md`

Tasks:

- [ ] Change `SUFeedURL` from the loopback fixture to the chosen production URL.
- [ ] Keep `DOC2MD_SPARKLE_FEED_URL` as the test/local override.
- [ ] Keep `SUPublicEDKey` unchanged unless rotating the Sparkle key.
- [ ] Decide the startup cadence:
  - preserve current licensed monthly opt-down behavior, or
  - remove/revise it so every startup checks for every user.
- [ ] Ensure startup checks run after Sparkle starts and do not block app launch.
- [ ] If the prompt appears too early in app lifecycle, move the scheduled
  check trigger from app init to a post-launch/main-window-ready point.
- [ ] Keep manual `Check for Updates...` visible and user initiated.
- [ ] Do not add update behavior to the hosted web app, `@doc2md/core`, shared
  converters, or npm surfaces.

Implementation preference:

- Start with Sparkle's standard user interface.
- Use Sparkle's standard skip-version and install/relaunch behavior.
- Implement `SPUStandardUserDriverDelegate` gentle reminders only if manual
  testing shows the standard scheduled update alert is too aggressive or not
  visible enough.

## Step 4 - Appcast Improvements

Files likely touched:

- `scripts/release/generate_appcast.py`
- `.github/workflows/release-mac.yml`
- `apps/macos/doc2mdTests/Fixtures/Sparkle/appcast.xml`
- release script/unit tests if present or added

Tasks:

- [ ] Keep the enclosure URL pointed at the Sparkle ZIP, not the DMG.
- [ ] Include human-useful release notes in the appcast.
  - Prefer `sparkle:releaseNotesLink` to the GitHub Release page for the tag,
    or include a short text/markdown release note if Sparkle standard UI handles
    it cleanly.
- [ ] Keep `sparkle:version` mapped to `CFBundleVersion`.
- [ ] Keep `sparkle:shortVersionString` mapped to the public marketing version.
- [ ] Validate the XML with `xmllint`.
- [ ] Validate the ZIP signature with Sparkle tooling where available.

The current appcast generator is intentionally small. Keep additions narrow:
release notes, stronger validation, and clearer generated metadata are useful;
building a full release-page renderer is not.

## Step 5 - Release Workflow Changes

Files likely touched:

- `.github/workflows/release-mac.yml`
- `scripts/release/package_sparkle_zip.sh`
- `scripts/release/generate_appcast.py`
- `scripts/security_ci_guard.py` only if new secret-bearing Cloudflare workflow
  patterns are added.

Tasks:

- [ ] After uploading release assets, verify the public appcast URL is live.
- [ ] Verify the public appcast references the just-published version.
- [ ] Verify the public appcast enclosure URL returns the expected ZIP.
- [ ] Verify the public appcast is not stale after a release upload.
- [ ] If using Cloudflare proxy, validate `https://updates.doc2md.dev/appcast.xml`.
- [ ] If using GitHub directly, validate
  `https://github.com/KjellKod/doc2md/releases/latest/download/appcast.xml`.

Useful release validation commands:

```bash
VERSION="2.8.6"
FEED_URL="https://updates.doc2md.dev/appcast.xml"

curl -fsSL "$FEED_URL" -o /tmp/doc2md-appcast.xml
xmllint --noout /tmp/doc2md-appcast.xml
grep -q "<sparkle:shortVersionString>${VERSION}</sparkle:shortVersionString>" /tmp/doc2md-appcast.xml
```

The token-bearing `mac-release` job must continue to keep Apple signing,
notary credentials, and Sparkle private key in the protected GitHub
Environment. Do not expose those secrets to PR workflows.

## Step 6 - Manual Update UX Validation

This requires two signed releases: an installed older version and a newer feed
version.

Recommended test flow:

1. Install version `A` from the signed/notarized DMG.
2. Publish version `B` with a higher `CFBundleVersion`.
3. Launch version `A`.
4. Confirm startup check finds version `B`.
5. Dismiss/cancel the prompt.
6. Quit and relaunch version `A`.
7. Confirm the prompt appears again.
8. Choose `Ignore This Version` / skip.
9. Quit and relaunch version `A`.
10. Confirm version `B` does not prompt again.
11. Publish version `C` with a higher `CFBundleVersion`.
12. Relaunch version `A`.
13. Confirm version `C` prompts.
14. Choose download/update.
15. Confirm download completes and `Install & Restart` is available.
16. Quit without installing, if Sparkle allows that path.
17. Relaunch and confirm the pending install/update state is still available.
18. Choose `Install & Restart`.
19. Confirm the app relaunches into version `C`.

Also validate offline launch:

1. Block or break the feed URL.
2. Launch the app.
3. Confirm the main window appears and file workflows still work.
4. Confirm manual `Check for Updates...` reports a user-readable failure rather
   than blocking the app.

## Step 7 - Web App Safety Gate

This work should be Mac-only. It must not break the hosted web app.

Expected scope:

- Allowed: `apps/macos/**`, `scripts/release/**`, `.github/workflows/release-mac.yml`,
  Mac docs, tests for release/appcast helpers.
- Avoid: shared converter code, hosted app shell, npm package APIs, browser-only
  install page behavior, Cloudflare hosted web deployment unless the PR is
  explicitly the Cloudflare host migration.

Minimum validation:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run build:desktop
python3 scripts/security_ci_guard.py
```

Mac validation on a maintainer machine:

```bash
npm run validate:mac
```

Use `npm run validate:mac -- --unsigned-only` only for local smoke checks where
signed/notarized validation is intentionally deferred.

## Acceptance Criteria

- [ ] Installed `doc2md.app` checks for updates at startup according to the
  explicit policy chosen in this plan.
- [ ] Manual `Check for Updates...` still works.
- [ ] The production feed URL is HTTPS and public.
- [ ] The feed advertises the latest release with monotonically increasing
  `sparkle:version`.
- [ ] The appcast enclosure points at the signed Sparkle ZIP, not the DMG.
- [ ] Sparkle verifies update signatures with the committed `SUPublicEDKey`.
- [ ] Dismissing/canceling an update causes the app to check again on the next
  eligible startup.
- [ ] Skipping/ignoring a version suppresses only that version.
- [ ] A newer version after a skipped version prompts again.
- [ ] Downloaded update state survives app quit/relaunch according to Sparkle's
  standard updater behavior.
- [ ] `Install & Restart` upgrades the app and relaunches into the new version.
- [ ] Offline or failed update checks do not block launch or document workflows.
- [ ] Hosted web app behavior is unchanged.

## Out Of Scope

- Payment, license purchase, or license restore flows.
- App Store distribution.
- Custom updater implementation that bypasses Sparkle.
- Updating the hosted web app from inside the Mac app.
- R2 mirroring of all release assets unless GitHub Release hosting becomes a
  real problem.
- Forced updates or blocking old versions from running.

## References

- Sparkle `SPUStandardUpdaterController`:
  https://sparkle-project.org/documentation/api-reference/Classes/SPUStandardUpdaterController.html
- Sparkle standard user driver delegate and gentle scheduled reminders:
  https://sparkle-project.org/documentation/api-reference/Protocols/SPUStandardUserDriverDelegate.html
- Sparkle custom user interfaces:
  https://sparkle-project.org/documentation/custom-user-interfaces/
- Existing commercial surface decision:
  `docs/implementation/mac-commercial-distribution-decision-record.md`
