// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const remediation =
  "Notice inventory drift. Run `npm run generate:notices` and commit the result.";

describe("notice inventory drift", () => {
  it("passes generator --check without writing to disk", () => {
    const repoRoot = path.resolve(__dirname, "..", "..");
    const noticesPath = path.join(repoRoot, "apps", "macos", "THIRD_PARTY_NOTICES.md");

    const beforeStat = fs.statSync(noticesPath);
    const beforeContents = fs.readFileSync(noticesPath, "utf8");

    const result = spawnSync(
      "node",
      ["scripts/generate-notice-inventory.mjs", "--check"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      }
    );

    const afterStat = fs.statSync(noticesPath);
    const afterContents = fs.readFileSync(noticesPath, "utf8");

    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const output = [stdout, stderr].filter(Boolean).join("\n");

    if (result.status !== 0) {
      expect(output, `generator output:\n${output}`).toContain(remediation);
    }

    expect(result.status, `generator output:\n${output}`).toBe(0);
    expect(afterStat.mtimeMs).toBe(beforeStat.mtimeMs);
    expect(afterContents).toBe(beforeContents);
  });
});
