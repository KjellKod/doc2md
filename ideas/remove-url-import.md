# Remove URL Import Functionality

## Context

The DropZone exposes a "URL import" input that fetches a document from a
public URL, converts it in the browser, and adds the result as a Markdown
entry. In practice this path performs poorly and the success rate is low.

Reported issues:

- Most non-trivial URLs are blocked by CORS, leaving the user with an
  opaque error.
- GitHub-hosted documents redirect through raw / HTML viewer URLs and
  the converter cannot disambiguate which one to follow.
- Large documents stall in the import handoff with no progress signal.
- The error path is generic and does not explain why the import failed.

The feature confuses users who expect it to "just work" and currently
costs more support effort than the value it provides.

## Proposed action

Remove URL import from the DropZone and the desktop import bridge.
Keep the file-drop and file-picker paths intact.

## Surfaces affected

- `src/components/DropZone.tsx` — remove the URL form and its handlers.
- `src/hooks/useFileConversion.ts` (and related) — remove `addUrl` and
  callers in `App.tsx` and `DesktopApp.tsx`.
- `src/desktop/*` — remove any URL-import bridge code.
- Tests under `src/components/__tests__/DropZone.test.tsx` and any
  app-level tests that exercise the URL path.
- Hero copy and docs that reference document-URL import.

## Acceptance criteria

- DropZone shows only the file drop area and the "browse from your
  device" button.
- `addUrl` no longer exists in the conversion hook.
- All references to "document URL", "URL import", or "doc URL" are
  removed from user-facing text.
- No test references the removed path.

## Status

Idea. Not yet picked up. Track here so the decision is recorded.
