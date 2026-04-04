import { ensureNodeCompat } from "./node-compat";
import { convertBatch, convertOneDocument } from "./batch";

export type {
  BatchResult,
  ConvertOptions,
  DocumentResult
} from "./types";
export { BatchLimitExceededError } from "./types";

export async function convertDocuments(
  inputPaths: string[],
  options: import("./types").ConvertOptions
) {
  await ensureNodeCompat();
  return convertBatch(inputPaths, options);
}

export async function convertDocument(
  inputPath: string,
  options: import("./types").ConvertOptions
) {
  await ensureNodeCompat();
  return convertOneDocument(inputPath, options);
}
