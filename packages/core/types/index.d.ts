export type OutputFormat = "md" | "html" | "both";

export interface ConvertOptions {
  outputDir: string;
  maxDocuments?: number;
  concurrency?: number;
  remoteTimeoutMs?: number;
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
  outputPath: string | null;
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

export declare class BatchLimitExceededError extends Error {
  readonly maxDocuments: number;
  readonly receivedDocuments: number;
  constructor(maxDocuments: number, receivedDocuments: number);
}

export declare function convertDocuments(
  inputPaths: string[],
  options: ConvertOptions
): Promise<BatchResult>;

export declare function convertDocument(
  inputPath: string,
  options: ConvertOptions
): Promise<DocumentResult>;
