import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom 29 exposes a Blob without `stream()`. Node 24's bundled undici
// (used by global `fetch` / `Response`) calls `.stream()` when a Blob is
// passed as a body. Restore the method using `arrayBuffer()` so tests can
// keep constructing `new Response(new Blob([...]))` without rewrites.
if (typeof Blob !== "undefined" && typeof Blob.prototype.stream !== "function") {
  Object.defineProperty(Blob.prototype, "stream", {
    configurable: true,
    writable: true,
    value(this: Blob): ReadableStream<Uint8Array> {
      return new ReadableStream<Uint8Array>({
        start: async (controller) => {
          try {
            const buffer = await this.arrayBuffer();
            controller.enqueue(new Uint8Array(buffer));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    },
  });
}

// Vitest does not run with `globals: true`, so React Testing Library
// cannot detect vitest's afterEach and skips its automatic cleanup.
// Without this, components rendered in one test stay mounted into the
// next, and their unmount-time cleanup effects (e.g. ThemeProvider's
// `delete documentElement.dataset.theme`) never run. The result is a
// CI-timing-sensitive failure where `documentElement.dataset.theme`
// from a prior "dark" test leaks into a later "light" assertion.
afterEach(() => {
  cleanup();
  if (typeof document !== "undefined") {
    delete document.documentElement.dataset.theme;
  }
});
