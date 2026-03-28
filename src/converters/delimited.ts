export function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function isMeaningfulRow(row: string[]) {
  return row.some((cell) => cell.trim().length > 0);
}

function normalizeCell(value: string) {
  return normalizeLineEndings(value).trim();
}

function escapeMarkdownCell(value: string) {
  return normalizeCell(value).replace(/\|/g, "\\|").replace(/\n/g, "<br />");
}

export function parseDelimitedText(value: string, delimiter: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === '"') {
      if (inQuotes && value[index + 1] === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (!inQuotes && character === delimiter) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (!inQuotes && character === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += character;
  }

  if (inQuotes) {
    throw new SyntaxError("Unclosed quoted field.");
  }

  currentRow.push(currentField);
  rows.push(currentRow);

  return rows.filter(isMeaningfulRow);
}

export function renderMarkdownTable(rows: string[][]) {
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => escapeMarkdownCell(row[index] ?? ""))
  );
  const [header, ...body] = normalizedRows;
  const separator = Array.from({ length: columnCount }, () => "---");
  const tableRows = [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`)
  ];

  return tableRows.join("\n");
}
