import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "../../..");

export function fixturePath(name: string) {
  return path.join(repoRoot, "test-fixtures", name);
}

export async function createTempDir(prefix: string) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function readOutput(outputPath: string) {
  return readFile(outputPath, "utf8");
}
