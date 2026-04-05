export interface ConvertOptions {
  outputDir: string;
  maxDocuments?: number;
  concurrency?: number;
}

export interface DocumentResultQuality {
  level: "good" | "review" | "poor";
  summary: string;
}

export interface DocumentResult {
  inputPath: string;
  outputPath: string | null;
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
