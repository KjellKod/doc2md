import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ErrnoException } from "node:fs";

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

function getOutputPath(outputDir: string, inputPath: string, suffix: number) {
  const extensionlessName = path.basename(inputPath, path.extname(inputPath));
  const fileName =
    suffix === 0 ? `${extensionlessName}.md` : `${extensionlessName}-${suffix}.md`;

  return path.join(outputDir, fileName);
}

export async function writeMarkdownOutput(
  outputDir: string,
  inputPath: string,
  markdown: string
) {
  await ensureOutputDirectory(outputDir);

  let suffix = 0;

  while (true) {
    const outputPath = getOutputPath(outputDir, inputPath, suffix);

    try {
      await writeFile(outputPath, markdown, {
        encoding: "utf8",
        flag: "wx"
      });
      return outputPath;
    } catch (error) {
      if ((error as ErrnoException).code === "EEXIST") {
        suffix += 1;
        continue;
      }

      throw error;
    }
  }
}
