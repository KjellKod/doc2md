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
