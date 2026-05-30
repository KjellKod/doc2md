#!/usr/bin/env node

import process from "node:process";
import { parseArgs } from "./cli-options";
import { BatchLimitExceededError, convertDocuments } from "./index";

const HELP_TEXT = `Usage: doc2md <input...> -o <output-dir> [--format <md|html|both>] [--max <n>] [--concurrency <n>] [--remote-timeout-ms <n>] [--help]

Convert one or more local document paths or direct remote document URLs to Markdown (and optionally self-contained HTML) and write output files to disk.

Flags:
  -o, --output <dir>   Directory where output files will be written
  --format <fmt>       Output format: md (default), html, or both
  --max <n>            Maximum number of input documents to process
  --concurrency <n>    Number of documents to process in parallel
  --remote-timeout-ms <n>  Timeout for direct remote URL downloads in milliseconds
  -h, --help           Show this help message
`;

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if ("help" in options) {
      process.stdout.write(HELP_TEXT);
      return;
    }

    const result = await convertDocuments(options.inputs, {
      outputDir: options.outputDir,
      maxDocuments: options.maxDocuments,
      concurrency: options.concurrency,
      remoteTimeoutMs: options.remoteTimeoutMs,
      format: options.format
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    if (error instanceof BatchLimitExceededError) {
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

    const message = error instanceof Error ? error.message : "Unknown CLI error.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

void main();
