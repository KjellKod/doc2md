export type OutputFormat = "md" | "html" | "both";

export interface ConvertOptions {
  outputDir: string;
  maxDocuments?: number;
  concurrency?: number;
  remoteTimeoutMs?: number;
  /** Output format. Defaults to "md" (Markdown only). */
  format?: OutputFormat;
}

export interface DocumentResultQuality {
  level: "good" | "review" | "poor";
  summary: string;
}

export interface DocumentOutputPaths {
  md?: string;
  html?: string;
}

export interface DocumentResult {
  inputPath: string;
  /**
   * Primary output path, kept backward-compatible:
   *   - format "md":   the Markdown path
   *   - format "html": the HTML path
   *   - format "both": the Markdown path
   * Null when nothing was written (skipped/error).
   */
  outputPath: string | null;
  /** Explicit per-format output paths when files were written. */
  outputPaths?: DocumentOutputPaths;
  status: "success" | "warning" | "skipped" | "error";
  warnings: string[];
  quality?: DocumentResultQuality;
  error?: string;
  durationMs: number;
}

export interface BatchResult {
  results: DocumentResult[];
  summary: {
    total: number;
    succeeded: number;
    warned: number;
    skipped: number;
    failed: number;
    totalDurationMs: number;
  };
}

export class BatchLimitExceededError extends Error {
  readonly maxDocuments: number;
  readonly receivedDocuments: number;

  constructor(maxDocuments: number, receivedDocuments: number) {
    super(
      `Batch limit exceeded: received ${receivedDocuments} documents, max is ${maxDocuments}.`
    );
    this.name = "BatchLimitExceededError";
    this.maxDocuments = maxDocuments;
    this.receivedDocuments = receivedDocuments;
  }
}
