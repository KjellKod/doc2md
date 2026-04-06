export interface CliOptions {
  outputDir: string;
  maxDocuments?: number;
  concurrency?: number;
  inputs: string[];
}

export interface HelpRequest {
  help: true;
}

function parsePositiveInteger(flag: string, rawValue: string | undefined) {
  const parsedValue = Number.parseInt(rawValue ?? "", 10);

  if (Number.isNaN(parsedValue) || parsedValue < 1) {
    throw new Error(`Invalid value for ${flag}: expected a positive integer.`);
  }

  return parsedValue;
}

export function parseArgs(argv: string[]): CliOptions | HelpRequest {
  const inputs: string[] = [];
  let outputDir = "";
  let maxDocuments: number | undefined;
  let concurrency: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "-o" || value === "--output") {
      outputDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--max") {
      maxDocuments = parsePositiveInteger(value, argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === "--concurrency") {
      concurrency = parsePositiveInteger(value, argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === "--help" || value === "-h") {
      return { help: true };
    }

    if (value.startsWith("-")) {
      throw new Error(`Unknown option: ${value}`);
    }

    inputs.push(value);
  }

  if (!outputDir) {
    throw new Error("Missing required output directory. Use -o or --output.");
  }

  if (inputs.length === 0) {
    throw new Error("No input files provided.");
  }

  return {
    outputDir,
    maxDocuments,
    concurrency,
    inputs
  };
}
