import { execFileSync } from "node:child_process";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getReleaseVersionInfo } from "./release-version.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const packageJsonPath = path.join(packageDir, "package.json");

function runNpm(args) {
  return execFileSync("npm", args, {
    cwd: packageDir,
    encoding: "utf8",
    stdio: "pipe"
  });
}

async function removeExistingTarballs() {
  const entries = await readdir(packageDir);
  const tarballs = entries.filter((entry) => /^doc2md-core-\d+\.\d+\.\d+\.tgz$/.test(entry));

  await Promise.all(tarballs.map((entry) => rm(path.join(packageDir, entry), { force: true })));
}

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const originalVersion = packageJson.version;
const release = getReleaseVersionInfo();

try {
  await removeExistingTarballs();
  packageJson.version = release.version;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  runNpm(["run", "build"]);
  const packOutput = runNpm(["pack", "--json", "--ignore-scripts"]);
  const packJsonMatch = packOutput.match(/\[\s*{[\s\S]*}\s*\]\s*$/);

  if (!packJsonMatch) {
    throw new Error(`Could not parse npm pack output:\n${packOutput}`);
  }

  const packResult = JSON.parse(packJsonMatch[0]);
  const tarballName = packResult[0]?.filename;

  if (typeof tarballName !== "string" || tarballName.length === 0) {
    throw new Error(`npm pack did not report a tarball filename:\n${packOutput}`);
  }

  console.log(
    JSON.stringify(
      {
        version: release.version,
        latestTag: release.latestTag,
        isTaggedCommit: release.isTaggedCommit,
        filename: tarballName,
        tarballPath: path.join(packageDir, tarballName)
      },
      null,
      2
    )
  );
} finally {
  packageJson.version = originalVersion;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}
