---
title: GitHub Flavored Markdown Reference
purpose: Records the GFM behaviors doc2md relies on for preview rendering, paste conversion, and regression tests.
audience: contributors and AI agents
scope: Markdown behavior validation
status: active
owner: maintainers
---

# GitHub Flavored Markdown Reference

doc2md treats GitHub Flavored Markdown as the reference dialect for user-facing Markdown preview behavior.

Primary source:

- GitHub Flavored Markdown Spec: `https://github.github.com/gfm/`
- Local research copy, when present: `.ws/gfm.md`

The local research copy records GFM version `0.29-gfm (2019-04-06)`. The GFM spec is licensed under Creative Commons Attribution-ShareAlike 4.0, and is based on the CommonMark Spec by John MacFarlane. Keep attribution in `apps/macos/THIRD_PARTY_NOTICES.md` when copied or adapted GFM spec material is distributed in shipped docs or tests.

## Validation Rule

When changing Markdown parsing, rendering, paste conversion, or Markdown regression tests, validate behavior against the GFM spec before treating local output as correct.

Use the spec especially for:

- task list items
- strikethrough
- tables
- autolinks
- list continuation and indentation

Prefer small repo-authored summaries like this file over copying the full spec into `docs/`. If exact spec text is copied, keep the copied section minimal and preserve the Creative Commons attribution and share-alike requirements.

## Task Lists

GFM task list items are normal list items whose first paragraph starts with a task marker. The valid markers are unchecked `[ ]`, checked `[x]`, and checked `[X]`, followed by whitespace before the item text.

Preview rendering must treat the marker as a semantic checkbox, not as literal text. For example:

```markdown
- [x] Ship fix
- [ ] Write docs
```

Expected preview behavior:

- one list
- two list items
- each task item renders a disabled checkbox
- checked markers render as checked checkboxes
- unchecked markers render as unchecked checkboxes
- no bullet marker is visible in addition to the checkbox

The editor Markdown text should remain Markdown. The semantic checkbox behavior belongs to preview rendering and copy/export paths that explicitly render Markdown to HTML.

## Raw HTML and anchors

doc2md targets GFM syntax and GitHub-familiar safe raw HTML behavior. Explicit anchors work with ordinary fragment links:

```markdown
[Jump](#7-2-prove-the-ci-commercial-dmg-build-path)

<a id="7-2-prove-the-ci-commercial-dmg-build-path"></a>

### 7.2 Prove the CI commercial DMG build path
```

Preview and HTML export render the empty anchor as an invisible target and keep the jump inside the document.

Deliberate differences from GitHub:

- Raw HTML passes through doc2md's explicit sanitizer. Explicit `<a id>` targets plus raw `h2` and `li` author IDs are rewritten into an internal `user-content:` namespace and matching fragment and ARIA references follow that rewrite. IDs on other raw elements are removed, leaving fragment links that target them inert.
- Safe non-allowlisted containers are unwrapped, preserving sanitized child content. Executable or content-active elements and their contents are removed.
- Supported external `http`, `https`, `mailto`, and `tel` links open outside doc2md.
- Repository-relative links remain disabled because doc2md has no repository context for resolving them.
- Standalone HTML export strips all image sources so exported documents remain self-contained.
- The virtualized large-document fallback renders independent passes around large tables. Raw anchors and fragment links resolve within one pass, not across a virtualized table boundary.
