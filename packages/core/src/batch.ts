import { convertFile, getFileExtension, isSupportedFormat, UNSUPPORTED_FILE_MESSAGE } from "../../../src/converters";
import type { ConversionResult } from "../../../src/converters/types";
import { createInputFile, writeMarkdownOutput } from "./io";
import { createInputFileFromUrl, isRemoteUrl } from "./remoteDocument";
import type { BatchResult, ConvertOptions, DocumentResult } from "./types";
import { BatchLimitExceededError } from "./types";

function now() {
  return Date.now();
}

function toDocumentResult(
  inputPath: string,
  outputPath: string | null,
  result: ConversionResult,
  durationMs: number
): DocumentResult {
  return {
    inputPath,
    outputPath,
    status: result.status,
    warnings: result.warnings,
    quality: result.quality,
    error: result.status === "error" ? result.warnings[0] : undefined,
    durationMs
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown document conversion error.";
}

function toThrownDocumentResult(
  inputPath: string,
  error: unknown,
  durationMs: number
): DocumentResult {
  const message = getErrorMessage(error);

  return {
    inputPath,
    outputPath: null,
    status: "error",
    warnings: [message],
    error: message,
    durationMs
  };
}

export async function convertOneDocument(
  inputPath: string,
  options: ConvertOptions
): Promise<DocumentResult> {
  const startedAt = now();
  const remoteInput = isRemoteUrl(inputPath);

  try {
    let file: File;

    if (remoteInput) {
      file = await createInputFileFromUrl(inputPath, {
        timeoutMs: options.remoteTimeoutMs
      });
    } else {
      const extension = getFileExtension(inputPath);

      if (!isSupportedFormat(extension)) {
        return {
          inputPath,
          outputPath: null,
          status: "skipped",
          warnings: [UNSUPPORTED_FILE_MESSAGE],
          durationMs: now() - startedAt
        };
      }

      file = await createInputFile(inputPath);
    }

    const extension = getFileExtension(file.name);

    if (!isSupportedFormat(extension)) {
      return {
        inputPath,
        outputPath: null,
        status: "skipped",
        warnings: [UNSUPPORTED_FILE_MESSAGE],
        durationMs: now() - startedAt
      };
    }

    const result = await convertFile(file);

    if (result.status === "error") {
      return toDocumentResult(inputPath, null, result, now() - startedAt);
    }

    const outputPath = await writeMarkdownOutput(
      options.outputDir,
      file.name,
      result.markdown
    );

    return toDocumentResult(inputPath, outputPath, result, now() - startedAt);
  } catch (error) {
    return toThrownDocumentResult(inputPath, error, now() - startedAt);
  }
}

function summarize(results: DocumentResult[], totalDurationMs: number): BatchResult["summary"] {
  return {
    total: results.length,
    succeeded: results.filter((result) => result.status === "success").length,
    warned: results.filter((result) => result.status === "warning").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "error").length,
    totalDurationMs
  };
}

export async function convertBatch(
  inputPaths: string[],
  options: ConvertOptions
): Promise<BatchResult> {
  const maxDocuments = options.maxDocuments ?? 50;

  if (inputPaths.length > maxDocuments) {
    throw new BatchLimitExceededError(maxDocuments, inputPaths.length);
  }

  const startedAt = now();
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const results = new Array<DocumentResult>(inputPaths.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= inputPaths.length) {
        return;
      }

      results[currentIndex] = await convertOneDocument(
        inputPaths[currentIndex],
        options
      );
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(inputPaths.length, 1)) },
      () => worker()
    )
  );

  const totalDurationMs = now() - startedAt;

  return {
    results,
    summary: summarize(results, totalDurationMs)
  };
}
