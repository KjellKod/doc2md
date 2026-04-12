import { describe, expect, it } from "vitest";
import {
  assertReleaseTagsAvailable,
  bumpPatch,
  deriveDisplayVersionFromState,
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

  it("throws in strict release mode when no numeric release tags are available", () => {
    expect(() =>
      assertReleaseTagsAvailable("0.0.0", { REQUIRE_RELEASE_TAG: "true" })
    ).toThrow("REQUIRE_RELEASE_TAG is set");
  });

  it("allows missing tags outside strict release mode", () => {
    expect(() =>
      assertReleaseTagsAvailable("0.0.0", { REQUIRE_RELEASE_TAG: "false" })
    ).not.toThrow();
  });

  it("allows strict release mode when a numeric release tag is available", () => {
    expect(() =>
      assertReleaseTagsAvailable("1.1.1", { REQUIRE_RELEASE_TAG: "true" })
    ).not.toThrow();
  });

  it("supports tags with a leading v but emits X.Y.Z versions", () => {
    expect(
      deriveReleaseVersionFromRefs("v0.5.1", "abc123", "abc123")
    ).toBe("0.5.1");
  });

  it("rejects invalid release versions", () => {
    expect(() => bumpPatch("0.5")).toThrow("Invalid release version");
  });

  it("bumps the displayed patch version when the worktree is dirty on a tagged commit", () => {
    expect(
      deriveDisplayVersionFromState("1.0.1", "abc123", "abc123", true)
    ).toBe("1.0.2");
  });

  it("bumps the displayed patch version again when HEAD is already ahead and the worktree is dirty", () => {
    expect(
      deriveDisplayVersionFromState("1.0.1", "abc123", "def456", true)
    ).toBe("1.0.3");
  });
});
