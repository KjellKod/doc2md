# Playwright v0 Browser Baseline

## Status

Idea

## Problem

`doc2md` now has enough real browser behavior that jsdom-only coverage is leaving important gaps. Vitest is still the right tool for converters, hooks, shell contracts, and component logic, but it cannot reliably catch layout, focus, keyboard, download, and responsive workflow issues in a real browser.

Recent UI work has made those gaps more visible:

- file-list toolbar actions can drift into awkward visual placement
- checkbox selection must not accidentally activate file rows
- keyboard behavior and focus rings need browser validation
- download actions cross a browser boundary
- responsive sidebar layout can regress without failing unit tests

## Goal

Add a small Playwright v0 suite that proves the hosted browser app's core workflow works in Chromium, locally and in CI.

This is not a replacement for Vitest. It is a thin browser confidence layer for behavior jsdom should not be trusted to model.

## V0 Scope

### Tooling

- Add Playwright with Chromium-only execution for v0.
- Add scripts:
  - `npm run test:e2e`
  - optionally `npm run test:e2e:ui` for local debugging
- Add a CI job that runs after build or in parallel with test/build if runtime stays acceptable.
- Keep traces/screenshots/videos on failure only.

### Baseline Tests

1. **Hosted app smoke**
   - Load the Vite app.
   - Verify Upload, Files, and Preview regions render.
   - Verify the empty file-list and empty preview states are visible.

2. **Scratch draft workflow**
   - Start a scratch draft.
   - Type Markdown.
   - Verify the file appears in the list.
   - Verify the preview/editor reflects the active draft.
   - Verify the save/download action becomes available when content exists.

3. **File-list selection workflow**
   - Create at least three entries.
   - Check one or more row checkboxes.
   - Verify checkbox toggles do not change the active preview.
   - Click row body/button and verify active preview changes.

4. **Bulk clear/download toolbar behavior**
   - With checked files, verify `Clear` removes only checked rows.
   - With no checked files, verify `Clear` removes only the active row.
   - With checked files, verify `Download` targets checked downloadable rows.
   - Verify checked state clears after `Download` and `Clear`.

5. **Responsive sidebar sanity**
   - Run a narrow viewport smoke check.
   - Verify file-list toolbar controls do not overlap file rows or each other.
   - Verify long file names remain truncated instead of forcing horizontal overflow.

## Explicit Non-Goals for V0

- Full visual snapshot testing.
- Cross-browser matrix.
- Mac desktop shell automation.
- Exhaustive converter coverage.
- Re-testing every Vitest component scenario in Playwright.
- Testing native download prompts; assert browser-side download events or generated filenames only.

## CI Shape

Recommended first version:

```yaml
e2e:
  runs-on: ubuntu-latest
  steps:
    - checkout
    - setup node
    - npm ci
    - npx playwright install --with-deps chromium
    - npm run build
    - npm run test:e2e
```

Keep this as a separate required job only after it proves stable. Initially, it can run as an informational PR job if CI runtime or flake risk is unknown.

## Acceptance Criteria

- Playwright is installed and configured for Chromium.
- `npm run test:e2e` passes locally against the built or dev-served app.
- CI runs the Playwright v0 suite on pull requests.
- The v0 suite covers the five baseline scenarios above.
- The suite avoids duplicating converter and hook unit tests already covered by Vitest.
- Failure artifacts are available for debugging without bloating successful CI runs.

## Risks

- **Flake risk**: Browser tests can become noisy if they rely on animation timing or loose selectors.
  - Mitigation: use role/name selectors, deterministic test data, and explicit assertions.
- **Coverage duplication**: E2E can grow into slow re-tests of unit behavior.
  - Mitigation: keep Playwright focused on browser workflows and layout/focus/download boundaries.
- **CI runtime**: Installing browsers increases job time.
  - Mitigation: Chromium-only v0, small test count, and failure artifacts only.

## Recommended Next Move

Create a dedicated quest for Playwright v0 after the opened-file bulk-actions/stat-file work lands. The first implementation should be deliberately small: one Playwright config, one CI job, and one spec file covering the baseline workflows.
