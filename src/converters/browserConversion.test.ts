import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertJsonFileInWorker,
  shouldUseJsonWorker,
} from "./browserConversion";

class MockJsonWorker extends EventTarget {
  static instances: MockJsonWorker[] = [];

  terminated = false;
  readonly url: URL;
  readonly options?: WorkerOptions;

  constructor(url: URL, options?: WorkerOptions) {
    super();
    this.url = url;
    this.options = options;
    MockJsonWorker.instances.push(this);
  }

  postMessage() {
    queueMicrotask(() => {
      this.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "result",
            result: {
              markdown: "```json\n{}\n```",
              warnings: [],
              status: "success",
            },
          },
        }),
      );
    });
  }

  terminate() {
    this.terminated = true;
  }
}

describe("browserConversion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockJsonWorker.instances = [];
  });

  it("uses a worker only for JSON files when Worker is available", () => {
    vi.stubGlobal("Worker", MockJsonWorker);

    expect(shouldUseJsonWorker(new File(["{}"], "inventory.json"))).toBe(true);
    expect(shouldUseJsonWorker(new File(["{}"], "notes.txt"))).toBe(false);
  });

  it("constructs a module worker for UI JSON conversion and terminates it", async () => {
    vi.stubGlobal("Worker", MockJsonWorker);

    const result = await convertJsonFileInWorker(
      new File(["{}"], "inventory.json"),
    );

    expect(result).toEqual({
      markdown: "```json\n{}\n```",
      warnings: [],
      status: "success",
    });
    expect(MockJsonWorker.instances).toHaveLength(1);
    expect(MockJsonWorker.instances[0]?.options).toEqual({ type: "module" });
    expect(MockJsonWorker.instances[0]?.terminated).toBe(true);
  });
});
