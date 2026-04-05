import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { fixturePath, repoRoot } from "./test-helpers";

function run(cmd: string, args: string[], cwd: string) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe"
  });
}

function runAllowFailure(cmd: string, args: string[], cwd: string) {
  try {
    return {
      stdout: run(cmd, args, cwd),
      status: 0
    };
  } catch (error) {
    const failure = error as Error & {
      stdout?: string;
      status?: number;
    };

    return {
      stdout: failure.stdout ?? "",
      status: failure.status ?? 1
    };
  }
}

describe("install smoke", () => {
  it(
    "packs, installs, imports, and runs without React or inline markdown in CLI JSON",
    async () => {
      const packageDir = path.join(repoRoot, "packages/core");
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), "doc2md-core-install-"));
      const consumerDir = path.join(tempRoot, "consumer");

      try {
        run("npm", ["run", "build"], packageDir);
        const tarballName = run("npm", ["pack"], packageDir).trim().split("\n").pop()!;
        const tarballPath = path.join(packageDir, tarballName);

        await mkdir(consumerDir, { recursive: true });
        run("npm", ["init", "-y"], consumerDir);
        run("npm", ["install", tarballPath], consumerDir);

        const installedPackageJson = JSON.parse(
          await readFile(
            path.join(consumerDir, "node_modules/@doc2md/core/package.json"),
            "utf8"
          )
        );
        expect(installedPackageJson.dependencies?.react).toBeUndefined();
        expect(installedPackageJson.dependencies?.["react-dom"]).toBeUndefined();
        const npmLsOutput = runAllowFailure(
          "npm",
          ["ls", "--json", "react", "react-dom"],
          consumerDir
        );
        const npmLs = JSON.parse(npmLsOutput.stdout || "{}");
        expect(npmLs.dependencies?.react).toBeUndefined();
        expect(npmLs.dependencies?.["react-dom"]).toBeUndefined();

        const smokeFile = path.join(consumerDir, "smoke.mjs");
        const outputDir = path.join(consumerDir, "output");
        await writeFile(
          smokeFile,
          `import { convertDocuments } from "@doc2md/core";
const result = await convertDocuments([${JSON.stringify(fixturePath("sample.txt"))}], { outputDir: ${JSON.stringify(outputDir)} });
console.log(JSON.stringify(result));\n`,
          "utf8"
        );

        const importResult = run("node", [smokeFile], consumerDir);
        const parsedImportResult = JSON.parse(importResult);
        expect(parsedImportResult.results[0].markdown).toBeUndefined();

        const cliPath = path.join(consumerDir, "node_modules/.bin/doc2md");
        const cliOutput = run(
          cliPath,
          [fixturePath("sample.txt"), "-o", outputDir],
          consumerDir
        );
        const parsedCliOutput = JSON.parse(cliOutput);
        expect(parsedCliOutput.results[0].markdown).toBeUndefined();
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    },
    120_000
  );
});
