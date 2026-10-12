# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

This is shared product context for the repository. The web app and the mature macOS DMG app share a React interface and document converters. The Mac app wraps the interface in a Swift/SwiftUI WKWebView shell with native file operations and menus. The platform value describes the shared interface; Mac-specific work must also respect native desktop behavior. The Node package and CLI provide automation around the same converters.

## Users

The primary audience is people entering AI-assisted workflows who need to turn existing documents into editable Markdown for coding agents, AI tools, and text-first editing. The product should also feel approachable to a broader audience using document conversion and Markdown editing without specialist knowledge.

## Product Purpose

Make local document conversion, review, and Markdown editing straightforward. Success means users can obtain useful output, understand conversion limitations, and confidently take the result into their next workflow.

The web and Mac apps are functional, mature products with several previous rounds of improvement. The current UX goal is broader appeal and a natural, appealing experience while preserving reliable behavior and established workflows. Whether that requires small adjustments or larger changes remains an open decision to be informed by review of the actual interface and tasks.

## Positioning

Local document processing, reviewable Markdown, and explicit conversion warnings are the product's practical strengths. The browser app, Mac app, and Node API/CLI reuse a shared conversion engine. Do not imply perfect document fidelity or invent competitive superiority claims.

## Operating Context

- Web: open or drop local documents, convert them in the browser, review and edit the result, and download Markdown or a self-contained HTML export.
- Mac: use the shared interface with native open, save, save-as, Finder, and menu workflows. Desktop persistence and licensing behavior belong to the Mac surface.
- Automation: use `@doc2md/core`, the CLI, or its skill wrapper for local files and direct remote document URLs. Remote fetches run on the machine running Node.
- The existing web stack is React, TypeScript, and Vite. Run `npm run dev` from the repository root; the configured web base path is `/doc2md/`.

## Capabilities and Constraints

- Supported conversion formats include Markdown, DOCX, XLSX, PDF, CSV, TSV, PPTX, HTML, TXT, and JSON.
- Local document conversion runs locally without a doc2md upload backend. Do not generalize this into a claim that every app feature is network-free.
- Conversion is intentionally lossy where source formats cannot map faithfully to Markdown. Preserve meaningful warnings and PDF quality signals; do not present conversion as magical or complete.
- Shared converters live in `src/converters/`. Shared interface changes must account for both web and desktop consumers.
- Keep native file persistence, bridge operations, and license behavior within their desktop boundaries. Preserve the distinction between browser downloads and desktop saves.
- The conversion engine, hosted web app, and Node package/CLI are MIT-licensed; desktop-specific code is source-visible shareware. `LICENSE` and `docs/licensing.md` remain authoritative for terms.
- Public npm publication is not currently planned; installation documentation describes local tarballs and package/CLI use.

## Brand Commitments

Preserve the existing name, `doc2md`. Product communication should remain plain, honest about limitations, and understandable to people new to Markdown and AI-assisted workflows.

## Evidence on Hand

- `README.md`: audience, getting started, supported formats, local processing, and product principles.
- `docs/architecture.md`: shared converters, runtime surfaces, and ownership boundaries.
- `apps/macos/README.md`: native capabilities and desktop workflows.
- `packages/core/README.md` and `docs/using-doc2md-core.md`: automation and output contracts.
- `src/`, `apps/macos/`, and existing tests: current implementation and behavior; verify older descriptive documentation against these before proposing changes.
- `test-fixtures/` and `examples/output/`: conversion examples and verification material.
- `LICENSE` and `docs/licensing.md`: license terms and boundaries.

These sources establish product behavior, not user-research results or proof of broad-market appeal. No new testimonials, adoption metrics, or usability findings are established by this initialization.

## Product Principles

1. Keep document processing local and explain the actual privacy boundaries.
2. Make the common conversion, review, edit, and output tasks easy to understand.
3. Surface limitations clearly so users can judge the result.
4. Preserve reliable workflows while using evidence to determine the scale of UX changes.
5. Make the interface self-explanatory through familiar controls, direct actions, and useful empty states. Do not add a separate newcomer introduction, tutorial, or explanatory hero to compensate for unclear interaction.

## Confirmed interface preferences

- Use familiar icons for recurring toolbar actions such as Open, New, Find, and Copy. Provide precise labels on hover and keyboard focus plus accessible names; avoid permanent explanatory labels that consume toolbar space.
- Keep document content prominent at ordinary and narrow desktop widths. Avoid redundant workspace subtitles and unnecessary desktop toolbar rows; preserve compact wrapping on narrow screens when needed to keep controls usable. Evaluate revisions against the existing app at matched viewport, content, mode, sidebar, and search states.
- Keep the existing width animation unless observed behavior establishes a problem.
