// @vitest-environment node
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it, vi } from "vitest";

let fixtureDir: string;

afterEach(async () => {
  vi.doUnmock("node:fs/promises");
  vi.doUnmock("node:url");
  vi.doUnmock("node:child_process");
  vi.doUnmock("../../packages/core/scripts/release-version.mjs");
  vi.restoreAllMocks();
  vi.resetModules();
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

it.each([false, true])(
  "keeps the manifest readable during packing and restoration (build fails: %s)",
  async (buildFails) => {
    fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "doc2md-manifest-"));
    const manifestPath = path.join(fixtureDir, "package.json");
    const originalManifest = '{"name":"@doc2md/core","version":"1.0.1"}\n';
    await fs.writeFile(manifestPath, originalManifest);
    const concurrentReads: string[] = [];
    vi.doMock("node:url", () => ({
      fileURLToPath: (url: string | URL) => String(url).endsWith("pack-local-release.mjs")
        ? path.join(fixtureDir, "scripts/pack-local-release.mjs")
        : fileURLToPath(url)
    }));
    vi.doMock("node:fs/promises", () => ({
      ...fs,
      writeFile: async (destination: string, data: string) => {
        // Pause after truncation, exactly where another test can read package.json.
        await fs.writeFile(destination, "");
        concurrentReads.push(await fs.readFile(manifestPath, "utf8"));
        await fs.writeFile(destination, data);
      }
    }));
    vi.doMock("../../packages/core/scripts/release-version.mjs", () => ({
      getReleaseVersionInfo: () => ({ version: "1.0.2", latestTag: "1.0.1", isTaggedCommit: false })
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync: (_command: string, args: string[]) => {
        if (buildFails && args[0] === "run") throw new Error("Build failed");
        return '[{"filename":"doc2md-core-1.0.2.tgz"}]';
      }
    }));
    vi.spyOn(console, "log").mockImplementation(() => {});

    const packing = import("../../packages/core/scripts/pack-local-release.mjs");
    if (buildFails) await expect(packing).rejects.toThrow("Build failed");
    else await packing;

    expect(concurrentReads).toHaveLength(2);
    expect(concurrentReads.map((content) => JSON.parse(content).version)).toEqual(["1.0.1", "1.0.2"]);
    expect(JSON.parse(await fs.readFile(manifestPath, "utf8")).version).toBe("1.0.1");
    expect(await fs.readdir(fixtureDir)).toEqual(["package.json"]);
  }
);
