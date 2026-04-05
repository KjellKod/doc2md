import { describe, expect, it } from "vitest";
import {
  bumpPatch,
  deriveReleaseVersionFromRefs
} from "../scripts/release-version.mjs";

describe("release version derivation", () => {
  it("uses the tag version when HEAD matches the latest release tag commit", () => {
    expect(
      deriveReleaseVersionFromRefs("0.5.1", "abc123", "abc123")
    ).toBe("0.5.1");
  });

  it("bumps the patch version when HEAD is ahead of the latest release tag", () => {
    expect(
      deriveReleaseVersionFromRefs("0.5.1", "abc123", "def456")
    ).toBe("0.5.2");
  });

  it("bumps the patch version from 0.0.0 when no release tag exists yet", () => {
    expect(
      deriveReleaseVersionFromRefs("0.0.0", "", "def456")
    ).toBe("0.0.1");
  });

  it("supports tags with a leading v but emits X.Y.Z versions", () => {
    expect(
      deriveReleaseVersionFromRefs("v0.5.1", "abc123", "abc123")
    ).toBe("0.5.1");
  });

  it("rejects invalid release versions", () => {
    expect(() => bumpPatch("0.5")).toThrow("Invalid release version");
  });
});
