# Markdown Editing And Rendering Stack

## Summary

`docs2md` should have one coherent markdown pipeline for authoring, previewing, storing, and rendering docs. The same markdown input should behave the same way in edit mode, preview mode, and read mode.

This idea bundles the full markdown UX instead of treating `---` support or preview as isolated features.

## Problem

Markdown handling usually drifts apart in three places:

- the editor accepts text that the renderer does not style correctly
- preview mode renders differently from the final read view
- upload-based docs and inline-authored docs follow different validation paths

That creates a broken trust model for users. If they type markdown once, they expect it to render the same everywhere.

## Goal

Create a single markdown handling approach in `docs2md` that supports:

- inline markdown authoring
- markdown file upload
- preview before save
- consistent final rendering
- safe storage and retrieval
- correct styling for common markdown elements, including horizontal rules via `---`, `***`, and `___`

## Product Direction

Treat markdown as a first-class content type, not just a file attachment.

Users should be able to:

1. upload an existing `.md` file
2. write markdown inline
3. switch between edit and preview
4. save content once
5. view the exact same rendered result later

## Proposed Stack

### 1. One markdown renderer everywhere

Use the same renderer and plugin chain for:

- preview in create flow
- preview in edit flow
- final read/view page

Recommended baseline:

- `react-markdown`
- `remark-gfm`

This gives consistent handling for:

- headings
- lists
- links
- code blocks
- tables
- task lists
- blockquotes
- horizontal rules

### 2. Dual docs input modes

Support both:

- `upload`
- `text`

That should be explicit in the UI and in the submitted payload. Avoid ad hoc detection if both a file and text can appear.

Recommended request shape:

- `docs_mode=upload` with a markdown file
- `docs_mode=text` with `docs_content`

This keeps validation and storage rules predictable.

### 3. Edit / Preview toggle

In inline text mode, add a clear two-state toggle:

- `Edit`
- `Preview`

Requirements:

- preview must render the current unsaved content
- switching between edit and preview must preserve content
- preview should use the exact same markdown renderer as the read page
- empty preview should show a small placeholder like `Nothing to preview yet.`

### 4. Shared visual container

Render markdown inside one shared presentation container, for example a `docs-box` style wrapper, so the same typography and spacing apply in:

- preview
- published/read view
- help or guide pages

The container should style at least:

- paragraphs
- headings
- lists
- code blocks and inline code
- tables
- links
- blockquotes
- horizontal rules

### 5. Horizontal rule support

Support markdown horizontal rules from standard syntax:

- `---`
- `***`
- `___`

Important detail: parsing may already work while styling is still missing. So this should be treated as both:

- renderer support
- CSS support

Minimum styling:

```css
.docs-box hr {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--color-border);
  margin: 0.5rem 0;
}
```

## Validation Rules

Apply the same trust-boundary checks regardless of whether docs come from upload or inline text:

- markdown content must be a string when using text mode
- uploaded docs must be a markdown file
- size limit should apply to both modes
- reject invalid combinations, such as upload + inline text together
- normalize line endings before storage if size checks depend on bytes

Recommended server checks:

- `docs_mode` is required when docs are being changed
- `docs_mode=text` requires non-empty `docs_content`
- `docs_mode=upload` requires a markdown file
- both inputs together should return `400`

## Storage Model

Store one canonical markdown document after validation, regardless of input mode.

Recommended behavior:

- convert uploaded markdown file to a canonical stored document
- convert inline text to the same stored document shape
- persist a single logical markdown artifact, such as `README.md` or another canonical filename

This prevents downstream code from caring whether the source was typed or uploaded.

## Read Path

The view/read route should:

- serve markdown as markdown from storage
- render it through the same UI renderer used by preview
- avoid having a separate “special case” renderer for help pages vs content pages

## UX Details Worth Keeping

- default noisy history/details panels should start collapsed unless there is a strong reason to open them
- preview should be explicit rather than auto-live if simplicity matters
- inline docs should be optional, not forced
- upload should remain available for users who already have a finished markdown file

## Tests

Add focused tests for:

- upload mode success
- text mode success
- reject upload + text together
- reject oversized inline markdown
- render horizontal rules visibly in the shared markdown container
- preview and final read view use the same renderer output for representative samples

Manual verification:

1. author markdown inline with headings, lists, table, code block, and `---`
2. preview it
3. save it
4. reopen in read mode
5. confirm the rendered result matches preview

## Suggested Implementation Order

1. define canonical markdown modes and payload shape
2. build shared markdown render component
3. add inline editor with edit/preview toggle
4. keep upload flow and route it through the same storage path
5. add shared styling for the markdown container, including `hr`
6. add validation and tests

## Editor keybinding gaps absorbed from the archived UX hardening proposal

From the `doc2md-ux-hardening-proposal` archive validation (see `docs/ideas-audit-2026-05-14.md` appendix), these editor-surface gaps remain unimplemented. None individually justify a quest; bundle them whenever the editor surface is touched (especially during `[[doc2md-editor-engine-evaluation]]` execution).

- **Tab and Shift-Tab indent or outdent** for the current item or selection. Currently the textarea passes Tab through to the browser focus chain.
- **Alt-Up / Alt-Down** block move for the current line or selected block.
- **Cmd-D** select next occurrence. Together with Alt-arrows these are the muscle-memory bindings users carry from GitHub, VS Code, and Notion.
- **Opens Find/Replace with Replace pane expanded**: on macOS the convention is `Cmd-Alt-F` (used by Xcode, VS Code, most native editors); on Windows/Linux `Ctrl-H` is conventional in IDEs. Avoid binding `Ctrl-H` globally on macOS because it shadows the native `delete-backward` binding in text fields (Cocoa Emacs-style key equivalents). Today only Cmd/Ctrl-F is bound.
- **Ordered list renumber on insert or remove**. `markdownAutoContinue.ts` emits `n+1` correctly on Enter, but does not renumber trailing items when a middle item is inserted or removed, which makes ordered lists drift after editing.

Trigger to elevate any of these from "if-needed" to "need": a user-visible regression where the absence of the binding caused real friction. Skip until then.

## Why This Matters

This is not just “support horizontal rules.” It is a content trust problem:

- what users type
- what preview shows
- what the app stores
- what the app later renders

should all be the same system.

If `docs2md` gets this right once, future markdown features become much cheaper and much less fragile.
