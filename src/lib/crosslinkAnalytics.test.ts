import { afterEach, describe, expect, it, vi } from "vitest";
import { trackCrosslinkClick } from "./crosslinkAnalytics";

describe("crosslink analytics", () => {
  afterEach(() => {
    delete (window as typeof window & { zaraz?: unknown }).zaraz;
  });

  it("emits doc2md to sketch2md clicks with allowlisted fields only", () => {
    const track = vi.fn();
    (window as typeof window & { zaraz: { track: typeof track } }).zaraz = {
      track,
    };

    trackCrosslinkClick({
      source_product: "doc2md",
      source_surface: "working_mode_bar",
      target_product: "sketch2md",
    });

    expect(track).toHaveBeenCalledWith("crosslink_doc2md_to_sketch2md_click", {
      source_product: "doc2md",
      source_surface: "working_mode_bar",
      target_product: "sketch2md",
    });
    expect(Object.keys(track.mock.calls[0][1]).sort()).toEqual([
      "source_product",
      "source_surface",
      "target_product",
    ]);
  });

  it("never throws when Cloudflare analytics is unavailable", () => {
    expect(() =>
      trackCrosslinkClick({
        source_product: "doc2md",
        source_surface: "working_mode_bar",
        target_product: "sketch2md",
      }),
    ).not.toThrow();
  });
});
