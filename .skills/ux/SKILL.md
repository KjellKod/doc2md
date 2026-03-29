# UX Review and Implementation Skill

Guidelines for reviewing, designing, and implementing UI changes in doc2md. Apply these principles before writing any UI code.

## When to Use

- Before adding or modifying any UI component
- When reviewing UI-related PRs or plans
- When diagnosing visual bugs or layout issues
- When the user reports UX problems

## Core Principles

### KISS — Every element earns its pixel

- One primary action per view
- Status labels: one word ("Queued", "Converting", "Ready", "Review", "Error")
- Support copy: one short sentence max per file entry
- Prefer progressive disclosure: show actions only when relevant
- Use the simplest state solution (`useState` before `useReducer`, flat before normalized)

### YAGNI — Build for today

Do not add:
- Multi-select checkboxes unless explicitly requested
- Sort/filter controls until file counts regularly exceed 20
- Dark mode, grid view, drag-to-reorder, confirmation dialogs for non-destructive actions
- Extra props (`size`, `variant`, `showDot`) until a real design requirement demands them

### SRP — One component, one job

| Component | Responsibility |
|---|---|
| `DropZone` | Accept file input |
| `FileList` | Render ordered list + toolbar |
| `FileListItem` | Render one file's name, badge, status, notice |
| `StatusIndicator` | Display status dot + label |
| `FormatBadge` | Display format label with color |
| `DownloadButton` | Trigger single-file download |
| `PreviewPanel` | Render markdown preview or edit view |

Split when: a component has multiple unrelated `useEffect` calls or passes props through just to reach a child.

### Clean — Visual weight matches action importance

**Button hierarchy:**
- Primary (Download selected): filled, high-contrast (`--accent` bg, white text)
- Secondary (Download All): outlined/bordered, medium contrast
- Tertiary/destructive (Clear All): ghost, low contrast

**Never hide disabled buttons** — disable them instead. Hiding causes layout shift and hides affordances.

## Layout Rules

### Flex containers with mixed content

When a flex row contains a variable-width item (filename) and a fixed item (status badge):
1. The variable item needs `min-width: 0` and `overflow: hidden`
2. The fixed item needs `flex-shrink: 0`
3. Long text gets `text-overflow: ellipsis` + `white-space: nowrap`

### Spacing

Use a base-4 spacing scale: 4, 8, 12, 16, 20, 24, 32px. Avoid arbitrary values.

### Color semantics

Map colors to meaning:
- Green (`--success`): ready, complete
- Amber (`--warning`): needs review, partial quality
- Red (`--error`): failed, needs attention
- Gray (`--text-muted`): pending, queued, inactive

Format badges use distinct hue per format group — this is separate from status colors.

## File List Patterns

### Status indicators
- Dot + label pattern (color alone is not enough per WCAG)
- `white-space: nowrap` on status labels
- `flex-shrink: 0` so they never collapse
- Pulse animation for active states (converting)

### Selection
- Single selection via click (list-detail layout)
- Selected item: stronger border + subtle shadow
- No multi-select — "Download All" covers batch needs

### Batch actions
- Toolbar above the file list
- Disable when inapplicable, don't hide
- Show context: "3 in session, 2 ready to download"

## Download UX

| State | Download Selected | Download All |
|---|---|---|
| No files | Hidden | Hidden |
| Files exist, none ready | Disabled | Disabled |
| Some ready, none selected | Disabled | Enabled |
| Selected file ready | Enabled | Enabled |
| Selected file not ready | Disabled | Enabled (if others ready) |

### Batch download timing
Browser downloads are async. When triggering multiple downloads:
- Stagger with small delays between each (50-100ms)
- Don't remove download links synchronously after click

## Responsive Breakpoints

| Width | Behavior |
|---|---|
| > 980px | Two-column: sidebar (350-430px) + preview |
| 720-980px | Single column, panels stack |
| < 720px | Single column, reduced padding, full-width buttons |

### Touch targets
All interactive elements: minimum 44x44 CSS pixels (WCAG 2.2).

## Accessibility Checklist

- [ ] All interactive elements reachable via keyboard
- [ ] `role="group"` on button groups, `aria-pressed` on toggles
- [ ] Status conveyed by text + color (not color alone)
- [ ] Minimum 3:1 contrast on non-text indicators
- [ ] Focus indicators visible on all interactive elements

## Review Checklist

Before approving any UI change:
1. Does every new element earn its pixel? (KISS)
2. Is anyone asking for this today? (YAGNI)
3. Does this component have exactly one reason to change? (SRP)
4. Does visual weight match action importance? (Clean)
5. Does it work with keyboard only? (Accessible)
6. Does it degrade at 720px and 980px? (Responsive)
7. Do long filenames, empty states, and error states look correct? (Edge cases)
