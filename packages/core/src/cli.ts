#!/usr/bin/env node

import process from "node:process";
import { parseArgs } from "./cli-options";
import { BatchLimitExceededError, convertDocuments } from "./index";

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await convertDocuments(options.inputs, {
      outputDir: options.outputDir,
      maxDocuments: options.maxDocuments,
      concurrency: options.concurrency
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
