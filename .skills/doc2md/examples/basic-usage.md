# Basic usage

This example keeps the skill wrapper thin and uses the helper script exactly as shipped.

## Single file

```bash
node .skills/doc2md/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf
```

## Multiple files

```bash
node .skills/doc2md/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf \
  ./docs/notes.docx \
  ./docs/sheet.xlsx
```

## What to expect

- Markdown files are written into `./markdown-output`
- The script prints JSON to stdout
- Each result includes `inputPath`, `outputPath`, `status`, `warnings`, and optional `quality`
