import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const sourcePath = path.join(packageDir, "types", "index.d.ts");
const distDir = path.join(packageDir, "dist");
const destinationPath = path.join(distDir, "index.d.ts");

await mkdir(distDir, { recursive: true });
await cp(sourcePath, destinationPath);
