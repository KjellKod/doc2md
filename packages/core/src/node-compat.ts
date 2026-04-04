import { enableNodeCompat } from "../../../src/converters/runtime";

let initPromise: Promise<void> | null = null;

export function ensureNodeCompat() {
  if (!initPromise) {
    initPromise = (async () => {
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM("");
      enableNodeCompat({
        domParser: dom.window.DOMParser as unknown as typeof globalThis.DOMParser
      });
    })();
  }

  return initPromise;
}
