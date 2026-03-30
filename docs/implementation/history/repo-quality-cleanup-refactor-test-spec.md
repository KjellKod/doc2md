---
title: Repo Quality Cleanup, Refactoring, and Test Quality Spec
status: Complete
owner: maintainers
date: 2026-03-29
completed_date: 2026-03-30
---

# Repo Quality Cleanup, Refactoring, and Test Quality Spec

## Overview

**Problem**: The current `doc2md` working tree is in decent shape, but several quality debts remain concentrated in three areas: indirect-only coverage for shared helpers, shallow top-level UI validation, and a growing orchestration hook that is still carrying too many responsibilities.

**Impact**: This work should improve confidence in future changes without changing product behavior. The main outcome is safer refactoring, stronger regression detection, and clearer boundaries in the most change-prone parts of the codebase.

**Scope In**:
- Test-quality improvements for current `src/**` production code
- Behavior-preserving cleanup and refactoring
- Small structural simplifications that are protected by characterization tests
- Documentation updates required by the implementation

**Scope Out**:
- New product features
- UI redesign or copy changes
- Broad converter behavior changes
- PDF extraction algorithm redesign
- Dependency upgrades unless required to keep existing tests running

**Non-Negotiable Constraint**: In all cases, we drive the work so existing functionality does not break. This means characterization tests first, refactor second, and no intentional behavior changes unless explicitly approved.

## Current Baseline

- Current audit artifact: [/Users/kjell/ws/extra/doc2md/.ws/repo-quality-audit.md](/Users/kjell/ws/extra/doc2md/.ws/repo-quality-audit.md)
- Current direct-test coverage: 17 of 34 production modules
- Current baseline validation at spec time:
  - `npx vitest run`
  - `npx vitest run --exclude '.worktrees/**'`
- Current high-signal debt areas:
  - shared helper coverage in `delimited.ts`, `readBinary.ts`, `readText.ts`, `richText.ts`, `office.ts`
  - shallow top-level test coverage in `App.test.tsx`
  - refactor pressure in `useFileConversion.ts`

## Acceptance Criteria

1. Existing user-facing behavior remains unchanged unless a change is explicitly documented and approved.
2. Before any structural refactor, characterization tests exist for the behavior being protected.
3. Direct automated coverage is added for the current high-risk helper layer:
   - `/Users/kjell/ws/extra/doc2md/src/converters/delimited.ts`
   - `/Users/kjell/ws/extra/doc2md/src/converters/readBinary.ts`
   - `/Users/kjell/ws/extra/doc2md/src/converters/readText.ts`
   - `/Users/kjell/ws/extra/doc2md/src/converters/richText.ts`
   - `/Users/kjell/ws/extra/doc2md/src/converters/office.ts` if practical without mock hell
4. A stronger top-level UI flow test exists for the core user journey: upload/select/preview/download readiness.
5. `useFileConversion.ts` is simplified or decomposed in a behavior-preserving way, with direct tests covering its protected behavior.
6. Final validation passes using the repo’s real test command(s), and any test-count drift is explained in the quest artifacts.
7. The implementation stays incremental: small slices, test-backed, reviewable, and bounded.

## Phases

### Phase 1: Lock In Current Behavior

**Goal**: Establish a trustworthy baseline before refactoring.

**Work**:
- Re-baseline the current Vitest suite at quest start and record the observed counts.
- Add or strengthen characterization tests for:
  - current timeout behavior in `/Users/kjell/ws/extra/doc2md/src/hooks/useFileConversion.ts`
  - current top-level App flow behavior
  - current helper behavior where future refactors are planned

**Deliverable**:
- New or expanded tests that define current expected behavior before cleanup work begins

### Phase 2: Helper-Layer Coverage

**Goal**: Add direct tests around shared parsing and file-I/O behavior that multiple converters depend on.

**Target files**:
- `/Users/kjell/ws/extra/doc2md/src/converters/delimited.ts`
- `/Users/kjell/ws/extra/doc2md/src/converters/readBinary.ts`
- `/Users/kjell/ws/extra/doc2md/src/converters/readText.ts`
- `/Users/kjell/ws/extra/doc2md/src/converters/richText.ts`
- `/Users/kjell/ws/extra/doc2md/src/converters/office.ts` if the mocking boundary stays reasonable

**Expected focus**:
- malformed quoted-field handling
- FileReader success and error branches
- Google Docs nested-list reconstruction
- table placeholder replacement/restore behavior
- sheet-reading behavior and edge cases

### Phase 3: App Flow Test Quality

**Goal**: Raise confidence at the product boundary instead of only at leaf modules.

**Target files**:
- `/Users/kjell/ws/extra/doc2md/src/App.tsx`
- `/Users/kjell/ws/extra/doc2md/src/App.test.tsx`
- related UI files only as needed for stable testing

**Expected focus**:
- upload or add-files flow
- selection behavior
- preview readiness
- download button state / availability

**Constraint**:
- Prefer testing-library style interaction tests over brittle implementation-detail assertions.

### Phase 4: Behavior-Preserving Hook Refactor

**Goal**: Reduce the maintenance pressure in `useFileConversion.ts` without changing its external behavior.

**Primary target**:
- `/Users/kjell/ws/extra/doc2md/src/hooks/useFileConversion.ts`

**Refactor direction**:
- Extract pure helpers where it improves readability or isolates queue/state logic
- Keep React-facing public behavior the same
- Preserve current timeout semantics and current non-timeout error semantics unless the quest explicitly widens scope

**Constraint**:
- No “cleanup” that is not defended by tests
- No hidden behavioral rewrites bundled into refactoring

### Phase 5: Low-Risk Cleanup

**Goal**: Apply small cleanup items that improve maintainability without changing behavior.

**Candidate targets**:
- `/Users/kjell/ws/extra/doc2md/src/converters/csv.ts`
- `/Users/kjell/ws/extra/doc2md/src/converters/tsv.ts`
- `/Users/kjell/ws/extra/doc2md/src/converters/json.ts`
- `/Users/kjell/ws/extra/doc2md/src/types/index.ts`
- `/Users/kjell/ws/extra/doc2md/src/components/FormatBadge.tsx`

**Examples**:
- reduce duplicated catch/return structure
- tighten loose format typing if it does not ripple into risky behavior changes

**Constraint**:
- Skip any cleanup item that turns into a broader architectural change

## Implementation Approach

### Critical Files

- `/Users/kjell/ws/extra/doc2md/src/hooks/useFileConversion.ts` — refactor target, high behavioral sensitivity
- `/Users/kjell/ws/extra/doc2md/src/hooks/useFileConversion.test.ts` — direct protection for hook behavior
- `/Users/kjell/ws/extra/doc2md/src/App.test.tsx` — top-level product-flow coverage improvement
- `/Users/kjell/ws/extra/doc2md/src/converters/delimited.ts` — shared parsing logic
- `/Users/kjell/ws/extra/doc2md/src/converters/readBinary.ts` — shared binary I/O boundary
- `/Users/kjell/ws/extra/doc2md/src/converters/readText.ts` — shared text I/O boundary
- `/Users/kjell/ws/extra/doc2md/src/converters/richText.ts` — shared HTML/Google Docs transformation logic
- `/Users/kjell/ws/extra/doc2md/src/converters/office.ts` — shared spreadsheet/document helper

### Key Functions / Areas

- `useFileConversion()` — current state machine for entry creation, conversion, selection, and editing
- `parseDelimitedText()` — shared CSV/TSV parsing behavior
- `readFileAsArrayBuffer()` — browser boundary for binary file reads
- `readFileAsText()` — browser boundary for text file reads
- `convertHtmlFragmentToMarkdown()` / Google Docs nesting helpers — shared HTML-to-markdown behavior
- `readAllSheets()` — workbook sheet loading path

### Data Flow To Protect

1. File(s) enter UI
2. Entry objects are created and selected state is initialized
3. Conversion starts, including timeout/error handling
4. Preview-ready output appears with warnings/status
5. Download state reflects conversion result

## Validation Plan

**Automated Test**: Full repo baseline
- **Run**: `npx vitest run`
- **Covers**: current working-tree baseline
- **Expected**: pass; if counts drift during quest, quest artifacts must explain the new baseline

**Automated Test**: Repo-scoped baseline
- **Run**: `npx vitest run --exclude '.worktrees/**'`
- **Covers**: in-repo suite only
- **Expected**: pass

**Automated Test**: Hook protection
- **File**: `/Users/kjell/ws/extra/doc2md/src/hooks/useFileConversion.test.ts`
- **Run**: `npx vitest run src/hooks/useFileConversion.test.ts`
- **Covers**: timeout behavior, queue progression, future added selection/edit regression tests
- **Mocking**: mock converter boundary only
- **Expected**: pass with no behavior regressions

**Automated Test**: Helper-layer tests
- **Files**:
  - `/Users/kjell/ws/extra/doc2md/src/converters/*.test.ts`
  - new direct helper tests as added
- **Run**: targeted `npx vitest run <file>` during implementation and full suite before close
- **Covers**: parsing, I/O, transformation behavior
- **Mocking**: browser/file I/O boundaries only where needed
- **Expected**: pass

**Automated Test**: App flow test
- **File**: `/Users/kjell/ws/extra/doc2md/src/App.test.tsx`
- **Run**: `npx vitest run src/App.test.tsx`
- **Covers**: top-level interaction path
- **Expected**: pass and meaningfully exercise current product flow

**MANUAL TEST**: Regression spot-check
- **Why manual**: confirm no visible workflow regressions slipped through while refactoring
- **Preconditions**: local app can run
- **Steps**:
  1. Start the app with `npm run dev`
  2. Add representative files from at least two supported formats
  3. Confirm conversion completes and preview appears
  4. Confirm selection and download affordances still behave as before
- **Expected**: no visible regressions in the current workflow
- **Observability**: browser UI state and any failing console/test output

## Integration Touchpoints

**System**: Browser File APIs  
- Could break: text/binary reads, file error handling  
- Validation: direct tests for `readBinary.ts` and `readText.ts`

**System**: Shared converter helper layer  
- Could break: multiple format converters at once  
- Validation: direct helper tests plus targeted converter tests

**System**: React UI state flow  
- Could break: selection, preview readiness, download state  
- Validation: App flow test + hook tests + manual smoke check

**System**: Third-party document parsing libraries (`mammoth`, `pdfjs-dist`, `read-excel-file`, `turndown`)  
- Could break: boundary assumptions in helpers  
- Validation: preserve boundary mocks only where necessary; prefer behavior assertions over library internals

## Risks & Mitigations

1. **Risk**: “Refactor” quietly changes current behavior  
   - Impact: High  
   - Likelihood: Medium  
   - Mitigation: characterization tests first; no structural change without direct test protection

2. **Risk**: helper tests turn into mock-heavy noise  
   - Impact: Medium  
   - Likelihood: Medium  
   - Mitigation: mock only boundaries; test real parsing/transformation logic directly

3. **Risk**: codebase drifts during the quest again  
   - Impact: Medium  
   - Likelihood: Medium  
   - Mitigation: builder must re-baseline at quest start and record the exact working-tree state being fixed

4. **Risk**: top-level App test becomes brittle  
   - Impact: Medium  
   - Likelihood: Medium  
   - Mitigation: assert user-visible states and interactions, not component internals

5. **Risk**: scope expands into broad architecture work  
   - Impact: High  
   - Likelihood: Medium  
   - Mitigation: keep PDF redesigns, feature work, and broad behavior changes explicitly out of scope

## Open Questions

- [ ] Should the quest preserve the current generic non-timeout error mapping in `useFileConversion.ts`, or is improving that behavior allowed in the same quest?
- [ ] Is type-tightening for `format` desired in this same quest, or should it stay a separate low-risk follow-up if it causes wider type churn?
- [ ] Should `office.ts` direct tests be mandatory, or only included if they can be added cleanly without mock hell?

## Quest Guidance

When this spec is used in a future quest:

- Route it as a full quest if the refactor scope stays multi-file and touches hook logic plus tests.
- Treat this as behavior-preserving work, not feature work.
- Re-baseline tests at quest start; do not blindly reuse counts from this spec if the working tree has changed.
- Prefer several small reviewable steps over one large refactor patch.

## Self-Review Checklist

- [x] Overview is bounded and explicit
- [x] Acceptance criteria are observable and testable
- [x] Validation includes concrete commands
- [x] Integration touchpoints include “could break” and validation
- [x] Risks are documented with mitigations
- [x] Scope is cleanup/refactor/test-quality only
- [x] Existing functionality preservation is explicit
