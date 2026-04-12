import { execFileSync, spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function startRemoteFixtureServer() {
  const serverProcess = spawn(
    process.execPath,
    [
      "-e",
      `
        const { createServer } = require("node:http");

        const server = createServer((request, response) => {
          if (request.url === "/remote-success.txt") {
            response.writeHead(200, {
              "content-disposition": 'attachment; filename="remote-cli.txt"',
              "content-type": "text/plain; charset=utf-8"
            });
            response.end("remote cli");
            return;
          }

          if (request.url === "/remote-missing.txt") {
            response.writeHead(404, {
              "content-type": "text/plain; charset=utf-8"
            });
            response.end("missing");
            return;
          }

          response.writeHead(404, {
            "content-type": "text/plain; charset=utf-8"
          });
          response.end("missing");
        });

        server.listen(0, "127.0.0.1", () => {
          const address = server.address();

          process.stdout.write(
            JSON.stringify({
              remoteMissingInput: "http://127.0.0.1:" + address.port + "/remote-missing.txt",
              remoteSuccessInput: "http://127.0.0.1:" + address.port + "/remote-success.txt"
            }) + "\\n"
          );
        });

        function shutdown() {
          server.close(() => process.exit(0));
        }

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
      `
    ],
    {
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  const serverInfo = await new Promise<{
    remoteMissingInput: string;
    remoteSuccessInput: string;
  }>((resolve, reject) => {
    let stdoutBuffer = "";
    let stderrBuffer = "";

    serverProcess.stdout.setEncoding("utf8");
    serverProcess.stderr.setEncoding("utf8");

    const handleStdout = (chunk: string) => {
      stdoutBuffer += chunk;
      const line = stdoutBuffer.split("\n")[0]?.trim();

      if (!line) {
        return;
      }

      serverProcess.stdout.off("data", handleStdout);
      resolve(
        JSON.parse(line) as {
          remoteMissingInput: string;
          remoteSuccessInput: string;
        }
      );
    };

    serverProcess.stdout.on("data", handleStdout);
    serverProcess.stderr.on("data", (chunk: string) => {
      stderrBuffer += chunk;
    });
    serverProcess.once("error", reject);
    serverProcess.once("exit", (code) => {
      reject(
        new Error(
          `Remote fixture server exited early with code ${code ?? "unknown"}${stderrBuffer ? `: ${stderrBuffer}` : "."}`
        )
      );
    });
  });

  return {
    ...serverInfo,
    close: () =>
      new Promise<void>((resolve) => {
        if (serverProcess.killed || serverProcess.exitCode !== null) {
          resolve();
          return;
        }

        serverProcess.once("exit", () => resolve());
        serverProcess.kill("SIGTERM");
      })
  };
}

describe("install smoke", () => {
  it(
    "packs, installs, follows the documented examples, and runs without React or inline markdown in result JSON",
    async () => {
      const packageDir = path.join(repoRoot, "packages/core");
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), "doc2md-core-install-"));
      const consumerDir = path.join(tempRoot, "consumer");
      const typescriptPackagePath = path.join(repoRoot, "node_modules/typescript");
      const supportedInput = fixturePath("sample.txt");
      const unsupportedInput = `${supportedInput}.exe`;
      const missingInput = path.join(consumerDir, "missing.txt");
      const outputDir = path.join(consumerDir, "markdown-output");
      let tarballPath = "";
      let remoteServer:
        | Awaited<ReturnType<typeof startRemoteFixtureServer>>
        | null = null;

      try {
        remoteServer = await startRemoteFixtureServer();
        const packOutput = run("npm", ["run", "pack:local"], packageDir);
        const packInfoMatch = packOutput.match(/\{\s*"version"[\s\S]*\}\s*$/);

        if (!packInfoMatch) {
          throw new Error(`Could not parse local pack output:\n${packOutput}`);
        }

        const packInfo = JSON.parse(packInfoMatch[0]) as {
          version: string;
          filename: string;
          tarballPath: string;
        };
        tarballPath = packInfo.tarballPath;

        await mkdir(consumerDir, { recursive: true });
        run("npm", ["init", "-y"], consumerDir);
        run("npm", ["install", tarballPath], consumerDir);
        run("npm", ["install", "--save-dev", typescriptPackagePath], consumerDir);

        const installedPackageJson = JSON.parse(
          await readFile(
            path.join(consumerDir, "node_modules/@doc2md/core/package.json"),
            "utf8"
          )
        );
        expect(installedPackageJson.dependencies?.react).toBeUndefined();
        expect(installedPackageJson.dependencies?.["react-dom"]).toBeUndefined();
        expect(installedPackageJson.types).toBe("./dist/index.d.ts");
        expect(installedPackageJson.version).toBe(packInfo.version);
        expect(
          await pathExists(
            path.join(consumerDir, "node_modules/@doc2md/core/dist/index.d.ts")
          )
        ).toBe(true);

        const npmLsOutput = runAllowFailure(
          "npm",
          ["ls", "--json", "react", "react-dom"],
          consumerDir
        );
        const npmLs = JSON.parse(npmLsOutput.stdout || "{}");
        expect(npmLs.dependencies?.react).toBeUndefined();
        expect(npmLs.dependencies?.["react-dom"]).toBeUndefined();

        const readmeApiExamplePath = path.join(consumerDir, "convert-documents.mjs");
        const readmeTypescriptExamplePath = path.join(consumerDir, "convert-documents.ts");
        const tsconfigPath = path.join(consumerDir, "tsconfig.json");

        await writeFile(
          readmeApiExamplePath,
          `import { convertDocuments } from "@doc2md/core";

const result = await convertDocuments(
  [${JSON.stringify(supportedInput)}],
  {
    outputDir: ${JSON.stringify(outputDir)},
    maxDocuments: 10,
    concurrency: 4
  }
);

console.log(JSON.stringify(result, null, 2));
`,
          "utf8"
        );
        await writeFile(
          readmeTypescriptExamplePath,
          `import { convertDocuments } from "@doc2md/core";

async function main() {
  const result = await convertDocuments(
    [${JSON.stringify(supportedInput)}],
    {
      outputDir: ${JSON.stringify(outputDir)},
      maxDocuments: 10,
      concurrency: 4
    }
  );

  console.log(result.summary.total);
}

void main();
`,
          "utf8"
        );
        await writeFile(
          tsconfigPath,
          JSON.stringify(
            {
              compilerOptions: {
                target: "ES2022",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                strict: true,
                noEmit: true
              },
              include: ["convert-documents.ts"]
            },
            null,
            2
          ),
          "utf8"
        );

        const importResult = run("node", [readmeApiExamplePath], consumerDir);
        const parsedImportResult = JSON.parse(importResult);
        expect(parsedImportResult.results[0].status).toBe("success");
        expect(parsedImportResult.results[0].markdown).toBeUndefined();
        expect(parsedImportResult.results[0].outputPath).toBeTruthy();

        run("npx", ["tsc", "--noEmit"], consumerDir);

        const cliPath = path.join(consumerDir, "node_modules/.bin/doc2md");
        const cliOutput = run(
          cliPath,
          [
            supportedInput,
            remoteServer.remoteSuccessInput,
            remoteServer.remoteMissingInput,
            unsupportedInput,
            missingInput,
            "-o",
            outputDir,
            "--max",
            "10",
            "--concurrency",
            "4"
          ],
          consumerDir
        );
        const parsedCliOutput = JSON.parse(cliOutput);
        expect(parsedCliOutput.results).toHaveLength(5);
        expect(parsedCliOutput.results[0].markdown).toBeUndefined();
        expect(parsedCliOutput.results[1].markdown).toBeUndefined();
        expect(parsedCliOutput.results[2].markdown).toBeUndefined();
        expect(parsedCliOutput.results[3].markdown).toBeUndefined();
        expect(parsedCliOutput.results[4].markdown).toBeUndefined();
        expect(parsedCliOutput.summary.succeeded).toBe(2);
        expect(parsedCliOutput.summary.skipped).toBe(1);
        expect(parsedCliOutput.summary.failed).toBe(2);

        const localResult = parsedCliOutput.results.find(
          (entry: { inputPath: string }) => entry.inputPath === supportedInput
        );
        const remoteSuccessResult = parsedCliOutput.results.find(
          (entry: { inputPath: string }) =>
            entry.inputPath === remoteServer.remoteSuccessInput
        );
        const remoteMissingResult = parsedCliOutput.results.find(
          (entry: { inputPath: string }) =>
            entry.inputPath === remoteServer.remoteMissingInput
        );
        const unsupportedResult = parsedCliOutput.results.find(
          (entry: { inputPath: string }) => entry.inputPath === unsupportedInput
        );
        const missingResult = parsedCliOutput.results.find(
          (entry: { inputPath: string }) => entry.inputPath === missingInput
        );

        expect(localResult?.status).toBe("success");
        expect(remoteSuccessResult?.status).toBe("success");
        expect(remoteSuccessResult?.outputPath?.endsWith("remote-cli.md")).toBe(true);
        expect(remoteMissingResult?.status).toBe("error");
        expect(remoteMissingResult?.error).toContain("404 Not Found");
        expect(unsupportedResult?.status).toBe("skipped");
        expect(missingResult?.status).toBe("error");

        const markdownOutput = path.join(outputDir, "sample.md");
        const remoteMarkdownOutput = path.join(outputDir, "remote-cli.md");
        expect(await pathExists(markdownOutput)).toBe(true);
        expect(await pathExists(remoteMarkdownOutput)).toBe(true);
        expect((await readFile(markdownOutput, "utf8")).trim().length).toBeGreaterThan(0);
        expect((await readFile(remoteMarkdownOutput, "utf8")).trim()).toBe("remote cli");
      } finally {
        if (remoteServer) {
          await remoteServer.close();
        }
        if (tarballPath.length > 0) {
          await rm(tarballPath, { force: true });
        }
        await rm(tempRoot, { recursive: true, force: true });
      }
    },
    120_000
  );
});
