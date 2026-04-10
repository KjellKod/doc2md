#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function ensureCoreInstalled() {
  if (existsSync(resolve(skillDir, "node_modules", "@doc2md", "core"))) {
    return;
  }

  process.stderr.write("@doc2md/core not found — installing...\n");
  execSync("npm install --no-fund --no-audit", {
    cwd: skillDir,
    stdio: "inherit"
  });
}

async function loadCore() {
  ensureCoreInstalled();
  return import("@doc2md/core");
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseInteger(flag, value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    fail(`${flag} must be a positive integer.`);
  }

  return parsed;
}

function parseArgs(argv) {
  const inputs = [];
  let outputDir = "";
  let maxDocuments;
  let concurrency;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--output-dir") {
      outputDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--max") {
      maxDocuments = parseInteger("--max", argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (value === "--concurrency") {
      concurrency = parseInteger("--concurrency", argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    inputs.push(value);
  }

  if (!outputDir) {
    fail("Missing required --output-dir <dir>.");
  }

  if (inputs.length === 0) {
    fail("Provide at least one input file path.");
  }

  return {
    inputs,
    outputDir,
    maxDocuments,
    concurrency
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let BatchLimitExceededError = null;

  try {
    const core = await loadCore();
    ({ BatchLimitExceededError } = core);
    const { convertDocuments } = core;
    const result = await convertDocuments(options.inputs, {
      outputDir: options.outputDir,
      maxDocuments: options.maxDocuments,
      concurrency: options.concurrency
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    if (BatchLimitExceededError && error instanceof BatchLimitExceededError) {
      process.stderr.write(
        `${JSON.stringify(
          {
            code: error.name,
            message: error.message,
            maxDocuments: error.maxDocuments,
            receivedDocuments: error.receivedDocuments
          },
          null,
          2
        )}\n`
      );
      process.exitCode = 1;
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unknown doc2md skill error.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

void main();
