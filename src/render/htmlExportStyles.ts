// One literal light-theme stylesheet for standalone HTML exports.
//
// Constraints enforced by tests (src/render/markdownToHtml.test.ts):
//   - no CSS custom properties (no `var(`) — every value is literal
//   - no external references (no `url(`, no `@import`, no web fonts)
//   - no app-theme selectors / no dependency on global.css
//
// The export is always light/white regardless of the app theme. Values are
// hand-authored to read like the app's `.markdown-surface` prose without
// importing it. System font stack keeps the file self-contained.

export const HTML_EXPORT_STYLES = `
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  body {
    margin: 0;
    padding: 2.5rem 1.25rem;
    background-color: #ffffff;
    color: #1f2328;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
    font-size: 16px;
    line-height: 1.6;
  }

  main.markdown-surface {
    max-width: 760px;
    margin: 0 auto;
  }

  main.markdown-surface > :first-child {
    margin-top: 0;
  }

  main.markdown-surface > :last-child {
    margin-bottom: 0;
  }

  .large-markdown-export-notice {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    align-items: baseline;
    margin: 0 0 1rem;
    padding: 0.75rem 0.85rem;
    border: 1px solid #d4a72c;
    border-radius: 8px;
    background-color: #fff8c5;
    color: #59636e;
  }

  .large-markdown-export-notice strong {
    color: #7d4e00;
  }

  .large-markdown-source {
    white-space: pre;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 1.8em 0 0.6em;
    line-height: 1.25;
    font-weight: 600;
    color: #1f2328;
  }

  h1 {
    font-size: 2em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #d8dee4;
  }

  h2 {
    font-size: 1.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #d8dee4;
  }

  h3 {
    font-size: 1.25em;
  }

  h4 {
    font-size: 1em;
  }

  h5 {
    font-size: 0.875em;
  }

  h6 {
    font-size: 0.85em;
    color: #59636e;
  }

  p {
    margin: 0 0 1em;
  }

  a {
    color: #0969da;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  a.markdown-disabled-link {
    color: #59636e;
    text-decoration: none;
    cursor: default;
  }

  ul,
  ol {
    margin: 0 0 1em;
    padding-left: 1.6em;
  }

  li {
    margin: 0.25em 0;
  }

  li > ul,
  li > ol {
    margin: 0.25em 0;
  }

  ul.contains-task-list {
    list-style: none;
    padding-left: 0.2em;
  }

  li.task-list-item {
    list-style: none;
    padding-left: 0;
  }

  li.task-list-item input[type="checkbox"] {
    margin: 0 0.5em 0 0;
    vertical-align: middle;
  }

  td > input[type="checkbox"],
  th > input[type="checkbox"] {
    margin: 0 0.5em 0 0;
    vertical-align: middle;
  }

  blockquote {
    margin: 0 0 1em;
    padding: 0 1em;
    color: #59636e;
    border-left: 0.25em solid #d8dee4;
  }

  blockquote > :first-child {
    margin-top: 0;
  }

  blockquote > :last-child {
    margin-bottom: 0;
  }

  hr {
    height: 1px;
    margin: 1.8em 0;
    border: 0;
    background-color: #d8dee4;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 0.875em;
  }

  :not(pre) > code {
    padding: 0.2em 0.4em;
    background-color: #f3f4f6;
    border-radius: 6px;
  }

  pre {
    margin: 0 0 1em;
    padding: 1em;
    background-color: #f6f8fa;
    border-radius: 8px;
    overflow-x: auto;
    line-height: 1.45;
  }

  pre code {
    display: block;
    padding: 0;
    background-color: transparent;
    white-space: pre;
    border-radius: 0;
  }

  table {
    margin: 0 0 1em;
    border-collapse: collapse;
    display: block;
    width: max-content;
    max-width: 100%;
    overflow-x: auto;
  }

  th,
  td {
    padding: 0.5em 0.85em;
    border: 1px solid #d8dee4;
  }

  th {
    font-weight: 600;
    background-color: #f6f8fa;
  }

  tr:nth-child(2n) td {
    background-color: #f6f8fa;
  }

  img {
    max-width: 100%;
  }

  del {
    color: #59636e;
  }

  @media print {
    body {
      padding: 0;
      color: #000000;
      background-color: #ffffff;
    }

    main.markdown-surface {
      max-width: none;
    }

    a {
      color: #000000;
    }

    pre,
    blockquote,
    table,
    tr,
    img {
      page-break-inside: avoid;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      page-break-after: avoid;
    }

    @page {
      margin: 1.6cm;
    }
  }
`;
