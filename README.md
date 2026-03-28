# doc2md
Document to Markdown

# Why this tool? 
This began from a very practical question from people newly starting to use AI workflows:

> _How do I turn an Excel doc or a PDF or a Word document into Markdown?_

Instead of answering that question repeatedly with one-off tools, commands, or workarounds, the idea became to create a small but high-quality example utility: a browser-based converter that feels polished, privacy-friendly, and easy to trust.

The point is not just file conversion. The point is lowering friction for people entering AI-assisted workflows and showing what a well-scoped, honest, professional AI-adjacent tool can look like.


---
# Client-side Document → Markdown Tool

## Purpose

Build a **clean, simple, professional, board-level quality** web tool that converts supported document formats into Markdown (`.md`).

The tool should be easy for people who are new to AI-assisted workflows and want a frictionless way to take a file they already have — such as an Office document, PDF, spreadsheet, presentation, HTML file, text file, or JSON file — and turn it into Markdown for tools like Claude Code, coding agents, internal AI workflows, or general text-first editing.

This should feel like a **high-quality example project**:

* useful in practice
* easy to understand
* privacy-friendly
* technically elegant
* professional without being noisy

The core product story is:

> Drop in a file, convert it locally, review the result, and download Markdown.

## Why this exists

This started from a simple recurring question from people who are not yet comfortable with AI tools:

> “How do I turn an Excel doc or a PDF or a Word document into a `.md` file?”

The insight was that the core need is actually straightforward:

* people already have documents in common formats
* AI tools often work better with Markdown
* many users do not want to install CLI tools or learn document-conversion workflows
* a browser-based tool lowers the barrier dramatically

So instead of explaining multiple one-off solutions, we want a single polished utility that demonstrates:

* practical AI enablement
* strong UX taste
* privacy by design
* clear scope boundaries
* honest handling of imperfect formats like PDF

This should also include enough context that a downstream agentic system can generate a short clickable **About** section that explains how the project idea originated and why it is useful.

## Product principles

1. **Client-side first**
   Files should be processed locally in the browser whenever possible.

2. **Privacy-forward**
   The default and primary experience should not upload files to a server.

3. **Simple over clever**
   Support common cases well rather than claiming perfect support for everything.

4. **Honest over magical**
   Especially for PDFs, be explicit about limitations and output quality.

5. **Professional UX**
   Clean, restrained, premium, trustworthy. No gimmicks. No visual clutter.

6. **Markdown quality matters more than styling fidelity**
   We want useful Markdown, not pixel-perfect reconstruction.

7. **Graceful failure**
   Unsupported or low-quality conversions should fail clearly and politely.

## Hosting / deployment choice

### Primary deployment

Host the frontend as a **static site on GitHub Pages**.

### Important constraint

GitHub Pages is static hosting only. It does **not** run Docker containers or backend services.

### Architectural implication

This project should be designed primarily as:

* static frontend
* browser-based conversion
* no backend required for v1

A future optional backend may be added later for heavier conversion tasks, but that is **outside the initial scope**.

## Supported input formats

The tool should support the following input formats:

* `.docx`
* `.xlsx`
* `.pdf` (**text PDFs only**)
* `.csv`
* `.tsv`
* `.pptx`
* `.html`
* `.txt`
* `.json`

## Mixed format support

The tool should allow **mixed-format batch input**.

Examples:

* one `.docx` and one `.pdf`
* several `.csv` files plus one `.xlsx`
* a `.pptx`, `.html`, and `.json` together

### Expected behavior

Users can upload one or more files in a single session, regardless of supported format mix.

For each file, the system should:

* detect the format
* run the appropriate conversion pipeline
* show per-file status
* provide output preview
* allow download of each resulting `.md`
* optionally allow download of all outputs together as a bundle later if desired

### Important note

Mixed-format support means **multiple supported file types in one conversion session**.
It does **not** mean merging multiple source documents into one giant Markdown file by default.

Default behavior should be:

* one input file → one output Markdown file

A future enhancement may allow concatenation/export packaging, but that is not required for v1.

## Scope boundaries

### In scope

* client-side conversion for supported formats
* mixed-format batch upload
* per-file conversion status
* Markdown preview
* Markdown download
* clear format-specific handling
* graceful feedback when conversion quality is limited
* strong empty / loading / success / error states
* premium but quiet UI

### Explicitly out of scope for v1

* server-side conversion
* Docker-hosted backend as part of GitHub Pages
* OCR
* scanned PDF support
* password-protected files
* macro-heavy Office support
* perfect preservation of layout or styling
* image-to-Markdown semantic extraction
* old binary Office formats like `.doc`
* collaborative editing
* storage of uploaded files
* user accounts
* telemetry-heavy productization

### Out-of-scope examples that must be handled gracefully

* PDF that is mostly scanned pages/images
* PDF with complex multi-column magazine-style layout
* image-heavy presentation where text is embedded in images
* encrypted / password-protected documents
* malformed or corrupted files
* huge files that exceed practical browser memory limits

## How we handle difficult formats gracefully

### PDF philosophy

PDF is not a naturally semantic document format. Because of that, PDF conversion should be presented as **best effort**, not guaranteed high fidelity.

### Expected PDF handling

#### Good fit

* text-based PDFs
* normal linear reading order
* documents with selectable text
* simple headings, paragraphs, and lists

#### Poor fit

* scanned PDFs
* image-only PDFs
* tables with complex structure
* forms
* multi-column layouts
* footnotes / sidebars / floating content

### Required UX behavior for PDFs

When a PDF is uploaded, the system should:

1. attempt text extraction
2. detect whether usable text appears to exist
3. if text extraction is weak or clearly image-based, warn the user clearly
4. avoid pretending that the result is high quality if it is not

### Example graceful feedback language

* “This PDF appears to contain little or no selectable text. Scanned/image-based PDFs are not supported in this version.”
* “Conversion completed, but this PDF layout is likely to produce imperfect Markdown. Please review before use.”
* “Tables and multi-column PDF layouts may not convert cleanly.”

### Image-heavy documents

For documents where meaning is primarily inside images:

* do not claim full conversion success
* convert whatever text is safely available
* clearly mark that image/OCR extraction is not part of v1

## Output philosophy

The goal is **useful Markdown**, not visual mimicry.

Markdown output should prioritize:

* headings
* paragraphs
* bullet lists
* numbered lists
* code blocks when obvious
* tables where practical
* readable section separation
* reasonable whitespace normalization

### Format-specific output guidance

#### `.docx`

Focus on semantic structure rather than visual styling.

#### `.xlsx`, `.csv`, `.tsv`

Convert sheets/data into readable Markdown tables. For `.xlsx`, represent sheets clearly with section headings.

#### `.pptx`

Represent slides as structured Markdown sections, likely one section per slide, preserving titles and bullets where available.

#### `.html`

Convert HTML to semantic Markdown.

#### `.txt`

Keep simple. Normalize line endings and preserve readability.

#### `.json`

Support two output modes if practical:

1. fenced code block containing pretty-printed JSON
2. lightweight Markdown summary for simple object structures later if useful

For v1, a fenced `json` code block with pretty-printing is acceptable and reliable.

## Technical choices

### Frontend

* **React + TypeScript + Vite**

This gives a modern, maintainable, static-site-friendly stack that works well on GitHub Pages.

### Styling / UI approach

Keep styling:

* minimal
* premium
* restrained
* enterprise-ready
* calm and trustworthy

Avoid:

* loud gradients
* flashy animations
* excessive shadows
* dashboard clutter
* consumer-app gimmicks

A good target feeling is:

* polished
* high-signal
* clean spacing
* clear hierarchy
* strong typography
* quiet confidence

### Suggested conversion libraries / approaches

#### `.docx`

* `mammoth.js` to extract clean semantic HTML
* `turndown` to convert HTML to Markdown

#### `.xlsx`, `.csv`, `.tsv`

* `SheetJS` for parsing spreadsheet data
* custom Markdown table generation

#### `.pdf`

* `PDF.js` for text extraction
* custom heuristics for Markdown cleanup
* no OCR in v1

#### `.pptx`

Use a browser-compatible parsing approach if stable enough; otherwise isolate this as the most experimental supported format and keep output expectations modest.

#### `.html`

* `turndown`

#### `.txt`

* native text handling in browser

#### `.json`

* native JSON parsing / pretty-printing in browser

## UX requirements

## Overall design direction

The UI must be:

* clean
* simple
* impressive
* professional
* board-level quality
* not noisy

It should look credible in front of:

* executives
* engineers
* design-aware product people
* users who are skeptical of AI gimmicks

## UX behavior

### Main workflow

1. user lands on page
2. user immediately understands what the tool does
3. user drags and drops or selects files
4. user sees per-file processing state
5. user sees results and warnings clearly
6. user previews Markdown
7. user downloads individual outputs

### Messaging

The site should communicate:

* this runs locally
* files are not uploaded in the normal flow
* supported file types are clear
* limitations are stated without drama

### Tone

* calm
* precise
* competent
* reassuring
* no hype

### Key UI areas

* hero / intro section
* supported formats summary
* drop zone / file picker
* per-file status list
* preview panel
* download actions
* limitation/help text
* optional About entry

## Error handling requirements

Every failure mode should result in feedback that is:

* specific
* actionable when possible
* non-technical unless detail is useful
* non-alarming

### Example cases

#### Unsupported format

“Unsupported file type. Please upload one of the supported formats.”

#### Corrupt file

“We couldn’t read this file. It may be corrupted or use a structure not supported by this tool.”

#### Scanned PDF

“This PDF appears to be image-based. Scanned PDFs are not supported in this version.”

#### Large file / browser limitation

“This file is too large for reliable in-browser conversion in this version.”

## Testing requirements

Testing should be practical and confidence-building, not performative.

### Unit testing

Add unit tests for:

* file type detection
* per-format routing logic
* Markdown table generation
* JSON pretty-print conversion
* HTML-to-Markdown cleanup rules
* PDF warning detection heuristics where deterministic
* filename output mapping
* error-state handling helpers

### Integration testing

Add integration tests for:

* single-file upload flow
* mixed-format multi-file upload flow
* successful conversion path
* warning path
* unsupported format path
* download action availability after conversion
* preview rendering for converted Markdown

### Smoke testing requirements

We need lightweight smoke tests that confirm the core product still works end-to-end.

#### Required smoke-test scenarios

1. Upload a `.docx` and confirm Markdown is produced
2. Upload an `.xlsx` and confirm at least one Markdown table is produced
3. Upload a `.csv` and confirm table output
4. Upload a `.txt` and confirm plain content appears
5. Upload a `.json` and confirm pretty-printed Markdown output
6. Upload a text-based `.pdf` and confirm output or warning state appears
7. Upload mixed formats in one session and confirm per-file handling works
8. Upload an unsupported file and confirm graceful rejection
9. Upload an image-based/scanned-style PDF fixture and confirm graceful warning/failure behavior

### Manual review checklist

Before considering the project production-worthy as an example:

* UI looks polished and calm
* typography hierarchy feels intentional
* empty state is strong
* drag/drop behavior feels reliable
* warnings are visible but not noisy
* preview is readable
* download naming is sensible
* mixed-format handling feels obvious
* nothing suggests files are uploaded or stored if they are not

## Acceptance criteria

The v1 project is successful if:

* supported files convert locally in browser
* the user can upload multiple supported files in mixed formats
* each file gets a clear status and output
* Markdown is readable and useful
* PDFs degrade honestly and gracefully
* unsupported or low-confidence cases are clearly communicated
* the UI feels professionally designed and restrained
* the tool is suitable to showcase publicly as a thoughtful example project

## Non-goals

The tool is **not** trying to be:

* a universal document converter
* a perfect PDF recovery system
* a full office-suite reimplementation
* an OCR platform
* a cloud document processing product
* a document storage service

## Suggested project narrative for the agentic system

This began from a very practical question from people newly starting to use AI workflows:

“How do I turn an Excel doc or a PDF or a Word document into Markdown?”

Instead of answering that question repeatedly with one-off tools, commands, or workarounds, the idea became to create a small but high-quality example utility: a browser-based converter that feels polished, privacy-friendly, and easy to trust.

The point is not just file conversion. The point is lowering friction for people entering AI-assisted workflows and showing what a well-scoped, honest, professional AI-adjacent tool can look like.

This narrative should be used to help generate a short **About** view or expandable section in the product.

## Implementation guidance for the downstream agentic system

Please use this document as the source of truth for:

* product intent
* scope boundaries
* UX direction
* technical architecture
* testing requirements
* graceful handling of difficult inputs

Where details are still open, prefer:

* simple solutions
* maintainable code
* calm premium UX
* honest messaging
* strong defaults
* low operational complexity

If tradeoffs are needed, bias toward:

* clarity over cleverness
* quality over format count
* graceful limitations over fake completeness
* local privacy-preserving execution over backend complexity

---

**doc2md** is an initiative through CandidTalentEdge and developed with [Quest](https://github.com/KjellKod/quest/blob/main/README.md)
