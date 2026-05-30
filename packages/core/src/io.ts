import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ErrnoException } from "node:fs";
import type { OutputFormat } from "./types";

const MIME_TYPES: Record<string, string> = {
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: "text/html",
  json: "application/json",
  md: "text/markdown",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function getMimeType(filePath: string) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

export async function createInputFile(inputPath: string) {
  const fileName = path.basename(inputPath);
  const contents = await readFile(inputPath);

  return new File([contents], fileName, {
    type: getMimeType(inputPath)
  });
}

export async function ensureOutputDirectory(outputDir: string) {
  await mkdir(outputDir, { recursive: true });
}

function isExistsError(error: unknown) {
  return (error as ErrnoException).code === "EEXIST";
}

function basenameWithoutExtension(inputName: string) {
  return path.basename(inputName, path.extname(inputName));
}

function suffixedName(base: string, suffix: number, extension: string) {
  const stem = suffix === 0 ? base : `${base}-${suffix}`;
  return `${stem}.${extension}`;
}

// Write a single file, retrying the next numeric suffix on collision. The
// exclusive-create flag (wx) makes this safe under concurrent workers writing
// duplicate basenames.
async function writeSingleFormat(
  outputDir: string,
  base: string,
  extension: string,
  content: string
): Promise<string> {
  let suffix = 0;

  while (true) {
    const outputPath = path.join(
      outputDir,
      suffixedName(base, suffix, extension)
    );

    try {
      await writeFile(outputPath, content, { encoding: "utf8", flag: "wx" });
      return outputPath;
    } catch (error) {
      if (isExistsError(error)) {
        suffix += 1;
        continue;
      }

      throw error;
    }
  }
}

// Paired write for format "both" (BL-4 / arb-it1-4). Reserve ONE shared
// suffix N so name-N.md and name-N.html always refer to the same logical
// document. Find the lowest N where neither file exists, create the .md with
// wx, then the .html with wx; if either loses the race (EEXIST), roll back
// the .md we may have just created and retry the next suffix. This keeps the
// suffixes coherent even when up to 4 workers write the same basename
// concurrently.
async function writeBothFormats(
  outputDir: string,
  base: string,
  markdown: string,
  html: string
): Promise<{ md: string; html: string }> {
  let suffix = 0;

  while (true) {
    const mdPath = path.join(outputDir, suffixedName(base, suffix, "md"));
    const htmlPath = path.join(outputDir, suffixedName(base, suffix, "html"));

    try {
      await writeFile(mdPath, markdown, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (isExistsError(error)) {
        suffix += 1;
        continue;
      }
      throw error;
    }

    try {
      await writeFile(htmlPath, html, { encoding: "utf8", flag: "wx" });
      return { md: mdPath, html: htmlPath };
    } catch (error) {
      // A concurrent worker claimed this suffix's .html. Release the .md we
      // just created so the pair stays coherent, then retry the next suffix.
      await unlink(mdPath).catch(() => undefined);
      if (isExistsError(error)) {
        suffix += 1;
        continue;
      }
      throw error;
    }
  }
}

export interface WriteOutputResult {
  outputPath: string;
  outputPaths: { md?: string; html?: string };
}

export interface WriteOutputArgs {
  outputDir: string;
  inputName: string;
  format: OutputFormat;
  markdown: string;
  html?: string;
}

export async function writeConversionOutput(
  args: WriteOutputArgs
): Promise<WriteOutputResult> {
  const { outputDir, inputName, format, markdown, html } = args;
  if (format !== "md" && format !== "html" && format !== "both") {
    throw new Error(
      `Invalid value for format: expected one of md, html, both, got "${String(format)}".`
    );
  }

  await ensureOutputDirectory(outputDir);
  const base = basenameWithoutExtension(inputName);

  if (format === "md") {
    const mdPath = await writeSingleFormat(outputDir, base, "md", markdown);
    return { outputPath: mdPath, outputPaths: { md: mdPath } };
  }

  if (format === "html") {
    const htmlPath = await writeSingleFormat(
      outputDir,
      base,
      "html",
      html ?? ""
    );
    return { outputPath: htmlPath, outputPaths: { html: htmlPath } };
  }

  const { md: mdPath, html: htmlPath } = await writeBothFormats(
    outputDir,
    base,
    markdown,
    html ?? ""
  );
  return {
    outputPath: mdPath,
    outputPaths: { md: mdPath, html: htmlPath }
  };
}

// Backward-compatible Markdown-only writer retained for existing callers and
// tests. Equivalent to writeConversionOutput with format "md".
export async function writeMarkdownOutput(
  outputDir: string,
  inputName: string,
  markdown: string
) {
  const result = await writeConversionOutput({
    outputDir,
    inputName,
    format: "md",
    markdown
  });
  return result.outputPath;
}
