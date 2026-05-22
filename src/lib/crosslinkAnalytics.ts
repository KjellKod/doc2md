export type CrosslinkProduct = "doc2md" | "sketch2md";
export type CrosslinkSurface = "working_mode_bar";

export interface CrosslinkAnalyticsPayload {
  source_product: CrosslinkProduct;
  source_surface: CrosslinkSurface;
  target_product: CrosslinkProduct;
}

type ZarazLike = {
  track?: (eventName: string, payload?: Record<string, string>) => void;
};

type WindowWithAnalytics = Window & {
  zaraz?: ZarazLike;
};

export function trackCrosslinkClick(payload: CrosslinkAnalyticsPayload) {
  const safePayload = {
    source_product: payload.source_product,
    source_surface: payload.source_surface,
    target_product: payload.target_product,
  };

  try {
    (window as WindowWithAnalytics).zaraz?.track?.(
      "crosslink_doc2md_to_sketch2md_click",
      safePayload,
    );
  } catch {
    // Analytics must never block outbound navigation.
  }
}
