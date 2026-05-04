/**
 * Deterministic notice inventory generator for `apps/macos/THIRD_PARTY_NOTICES.md`.
 *
 * npm algorithm (production dependency closure):
 * - Start from the root lockfile entry (`package-lock.json` packages[""]) and each workspace package
 *   listed under `workspaces` (e.g. `packages/core`), using their `dependencies` only (exclude
 *   `devDependencies`).
 * - Resolve each dependency via the installed `node_modules` tree (requires `npm ci`), read its
 *   `package.json`, and recursively follow its `dependencies` (excluding `devDependencies`).
 *
 * Sort order is ASCII-stable on lowercased keys:
 * - npm table by `name@version` (so parallel installs of the same package at different versions
 *   are each represented deterministically rather than collapsed by name alone)
 * - swiftpm table by `identity`
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const THIRD_PARTY_NOTICES_PATH = path.join(REPO_ROOT, "apps", "macos", "THIRD_PARTY_NOTICES.md");
const PACKAGE_LOCK_PATH = path.join(REPO_ROOT, "package-lock.json");
const SWIFTPM_RESOLVED_PATH = path.join(
  REPO_ROOT,
  "apps",
  "macos",
  "doc2md.xcodeproj",
  "project.xcworkspace",
  "xcshareddata",
  "swiftpm",
  "Package.resolved"
);
const SWIFTPM_OVERRIDES_PATH = path.join(REPO_ROOT, "scripts", "notice-license-overrides.json");

const NPM_BEGIN = "<!-- BEGIN GENERATED npm -->";
const NPM_END = "<!-- END GENERATED npm -->";
const SWIFTPM_BEGIN = "<!-- BEGIN GENERATED swiftpm -->";
const SWIFTPM_END = "<!-- END GENERATED swiftpm -->";

const REMEDIATION =
  "Notice inventory drift. Run `npm run generate:notices` and commit the result.";

function asciiLowerKey(value) {
  return String(value).toLowerCase();
}

function stableSortByLowerKey(items, getKey) {
  return [...items].sort((a, b) => {
    const ka = asciiLowerKey(getKey(a));
    const kb = asciiLowerKey(getKey(b));
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    const ra = String(getKey(a));
    const rb = String(getKey(b));
    if (ra < rb) return -1;
    if (ra > rb) return 1;
    return 0;
  });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data);
}

function normalizeRepositorySource(pkg) {
  if (typeof pkg.repository === "string") {
    return pkg.repository;
  }
  if (pkg.repository && typeof pkg.repository.url === "string") {
    return pkg.repository.url;
  }
  if (typeof pkg.homepage === "string") {
    return pkg.homepage;
  }
  return "UNSPECIFIED";
}

function normalizeLicense(pkg) {
  if (typeof pkg.license === "string" && pkg.license.trim()) {
    return pkg.license.trim();
  }
  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    const parts = pkg.licenses
      .map((entry) => (typeof entry?.type === "string" ? entry.type.trim() : ""))
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" OR ");
    }
  }
  return "UNSPECIFIED";
}

async function findPackageJson(packageName, fromDir) {
  let current = fromDir;
  for (;;) {
    const candidate = path.join(current, "node_modules", packageName, "package.json");
    if (await fileExists(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function gatherWorkspacePackages(lockfile) {
  const rootPackage = lockfile?.packages?.[""];
  const workspaces = Array.isArray(rootPackage?.workspaces) ? rootPackage.workspaces : [];

  const results = [];
  for (const workspacePath of workspaces) {
    const repoPackageJsonPath = path.join(REPO_ROOT, workspacePath, "package.json");
    if (!(await fileExists(repoPackageJsonPath))) {
      continue;
    }
    const pkg = await readJson(repoPackageJsonPath);
    results.push({
      name: pkg.name ?? workspacePath,
      version: pkg.version ?? "UNSPECIFIED",
      license: normalizeLicense(pkg),
      source: normalizeRepositorySource(pkg),
      workspacePath,
      dependencies: pkg.dependencies ?? {},
    });
  }
  return results;
}

async function gatherNpmInventory() {
  const lockfile = await readJson(PACKAGE_LOCK_PATH);
  const rootPackage = lockfile?.packages?.[""];
  const rootDeps = rootPackage?.dependencies ?? {};

  const workspacePackages = await gatherWorkspacePackages(lockfile);

  const nodeModulesRoot = path.join(REPO_ROOT, "node_modules");
  if (!(await fileExists(nodeModulesRoot))) {
    const message = "node_modules not found. Run `npm ci` before generating notices.";
    const error = new Error(message);
    error.code = "MISSING_NODE_MODULES";
    throw error;
  }

  const visited = new Set();
  const queue = [];

  const enqueueDeps = (deps, fromDir) => {
    for (const name of Object.keys(deps ?? {})) {
      const key = `${fromDir}::${name}`;
      queue.push({ name, fromDir, key });
    }
  };

  enqueueDeps(rootDeps, REPO_ROOT);
  for (const workspacePkg of workspacePackages) {
    enqueueDeps(workspacePkg.dependencies, path.join(REPO_ROOT, workspacePkg.workspacePath));
  }

  const inventory = new Map();
  const inventoryKey = (name, version) => `${name}@${version}`;
  for (const workspacePkg of workspacePackages) {
    inventory.set(inventoryKey(workspacePkg.name, workspacePkg.version), {
      name: workspacePkg.name,
      version: workspacePkg.version,
      license: workspacePkg.license,
      source: workspacePkg.source,
      kind: "workspace",
    });
  }

  while (queue.length > 0) {
    const { name, fromDir, key } = queue.shift();
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    const pkgJsonPath = await findPackageJson(name, fromDir);
    if (!pkgJsonPath) {
      continue;
    }

    const pkgDir = path.dirname(pkgJsonPath);
    const pkg = await readJson(pkgJsonPath);

    const pkgName = typeof pkg.name === "string" ? pkg.name : name;
    const version = typeof pkg.version === "string" ? pkg.version : "UNSPECIFIED";
    const inventoryEntryKey = inventoryKey(pkgName, version);

    if (!inventory.has(inventoryEntryKey)) {
      inventory.set(inventoryEntryKey, {
        name: pkgName,
        version,
        license: normalizeLicense(pkg),
        source: normalizeRepositorySource(pkg),
        kind: "npm",
      });
    }

    enqueueDeps(pkg.dependencies ?? {}, pkgDir);
  }

  const rows = stableSortByLowerKey(
    [...inventory.values()],
    (row) => `${row.name}@${row.version}`
  );

  const header = ["Dependency", "Version", "License", "Source"];
  const align = ["---", "---:", "---", "---"];
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${align.join(" | ")} |`,
  ];

  for (const row of rows) {
    lines.push(
      `| \`${row.name}\` | ${row.version} | ${row.license} | ${row.source} |`
    );
  }

  return lines.join("\n") + "\n";
}

async function gatherSwiftPmInventory() {
  const resolved = await readJson(SWIFTPM_RESOLVED_PATH);
  const pins = Array.isArray(resolved?.pins) ? resolved.pins : [];

  const overrides = (await fileExists(SWIFTPM_OVERRIDES_PATH))
    ? await readJson(SWIFTPM_OVERRIDES_PATH)
    : {};

  const rows = pins.map((pin) => {
    const identity = pin.identity ?? "UNSPECIFIED";
    const location = pin.location ?? "UNSPECIFIED";
    const version = pin.state?.version ?? pin.state?.revision ?? "UNSPECIFIED";

    const override =
      overrides?.[identity] ??
      (typeof location === "string" ? overrides?.[location] : undefined);

    const spdx = typeof override?.spdx === "string" ? override.spdx : "UNSPECIFIED";
    const source = typeof override?.source === "string" ? override.source : location;

    return {
      identity,
      version,
      spdx,
      source,
    };
  });

  const sorted = stableSortByLowerKey(rows, (row) => row.identity);

  const header = ["Dependency", "Version", "License", "Source"];
  const align = ["---", "---:", "---", "---"];
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${align.join(" | ")} |`,
  ];

  for (const row of sorted) {
    lines.push(
      `| \`${row.identity}\` | ${row.version} | ${row.spdx} | ${row.source} |`
    );
  }

  return lines.join("\n") + "\n";
}

function replaceRegion(content, beginMarker, endMarker, replacementBody) {
  const begin = content.indexOf(beginMarker);
  const end = content.indexOf(endMarker);

  if (begin === -1 || end === -1 || end < begin) {
    return null;
  }

  const start = begin + beginMarker.length;
  return (
    content.slice(0, start) +
    "\n\n" +
    replacementBody.trimEnd() +
    "\n\n" +
    content.slice(end)
  );
}

function normalizeLf(text) {
  return text.replace(/\r\n/g, "\n");
}

function ensureMarkers(content) {
  let updated = content;

  if (!updated.includes(NPM_BEGIN) || !updated.includes(NPM_END)) {
    updated = insertMarkersAfterHeading(
      updated,
      "## Direct Runtime Dependencies",
      NPM_BEGIN,
      NPM_END
    );
  }

  if (!updated.includes(SWIFTPM_BEGIN) || !updated.includes(SWIFTPM_END)) {
    updated = insertMarkersAfterHeading(
      updated,
      "## Native Mac Dependencies",
      SWIFTPM_BEGIN,
      SWIFTPM_END
    );
  }

  return updated;
}

function insertMarkersAfterHeading(content, heading, beginMarker, endMarker) {
  const headingIndex = content.indexOf(`${heading}\n`);
  if (headingIndex === -1) {
    return content;
  }

  const afterHeadingIndex = headingIndex + heading.length + 1;
  const rest = content.slice(afterHeadingIndex);

  const tableMatch = rest.match(/\n(\|[^\n]*\|\n\|[^\n]*\|\n(?:\|[^\n]*\|\n)*)/);
  if (!tableMatch || typeof tableMatch.index !== "number") {
    return content;
  }

  const tableStart = afterHeadingIndex + tableMatch.index + 1;
  const tableEnd = tableStart + tableMatch[1].length;
  const tableText = content.slice(tableStart, tableEnd).trimEnd();

  return (
    content.slice(0, tableStart) +
    `${beginMarker}\n` +
    tableText +
    `\n${endMarker}` +
    content.slice(tableEnd)
  );
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has("--check");

  const originalRaw = normalizeLf(await fs.readFile(THIRD_PARTY_NOTICES_PATH, "utf8"));
  const original = ensureMarkers(originalRaw);

  let npmTable;
  let swiftpmTable;
  try {
    [npmTable, swiftpmTable] = await Promise.all([
      gatherNpmInventory(),
      gatherSwiftPmInventory(),
    ]);
  } catch (error) {
    console.error(String(error?.message ?? error));
    return 1;
  }

  const npmUpdated = replaceRegion(original, NPM_BEGIN, NPM_END, npmTable);
  if (npmUpdated === null) {
    console.error(`Missing generated-region markers: ${NPM_BEGIN} ... ${NPM_END}`);
    return 1;
  }

  const swiftUpdated = replaceRegion(npmUpdated, SWIFTPM_BEGIN, SWIFTPM_END, swiftpmTable);
  if (swiftUpdated === null) {
    console.error(`Missing generated-region markers: ${SWIFTPM_BEGIN} ... ${SWIFTPM_END}`);
    return 1;
  }

  const updated = normalizeLf(swiftUpdated);

  const finalText = updated.endsWith("\n") ? updated : `${updated}\n`;

  if (check) {
    if (finalText !== originalRaw) {
      console.error(REMEDIATION);
      return 1;
    }
    return 0;
  }

  await fs.writeFile(THIRD_PARTY_NOTICES_PATH, finalText, "utf8");
  return 0;
}

process.exitCode = await main();
