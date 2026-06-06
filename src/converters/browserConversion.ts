import { convertFile, getFileExtension } from ".";
import type { ConversionResult } from "./types";

type JsonWorkerResponse =
  | {
      type: "result";
      result: ConversionResult;
    }
  | {
      type: "error";
      message: string;
    };

type UiConversionOptions = {
  signal?: AbortSignal;
};

function createJsonWorker() {
  return new Worker(new URL("./json.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function shouldUseJsonWorker(file: File): boolean {
  return getFileExtension(file.name) === "json" && typeof Worker !== "undefined";
}

export function convertJsonFileInWorker(
  file: File,
  options: UiConversionOptions = {},
): Promise<ConversionResult> {
  if (options.signal?.aborted) {
    return Promise.reject(new DOMException("Conversion aborted", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = createJsonWorker();

    const cleanup = () => {
      options.signal?.removeEventListener("abort", handleAbort);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
    };

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    function handleAbort() {
      finish(() =>
        reject(new DOMException("Conversion aborted", "AbortError")),
      );
    }

    function handleMessage(event: MessageEvent<JsonWorkerResponse>) {
      const response = event.data;
      if (response.type === "result") {
        finish(() => resolve(response.result));
        return;
      }
      finish(() => reject(new Error(response.message)));
    }

    function handleError(event: ErrorEvent) {
      finish(() => reject(event.error ?? new Error(event.message)));
    }

    options.signal?.addEventListener("abort", handleAbort, { once: true });
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ file });
  });
}

export function convertFileForUi(
  file: File,
  options: UiConversionOptions = {},
): Promise<ConversionResult> {
  if (shouldUseJsonWorker(file)) {
    return convertJsonFileInWorker(file, options);
  }

  return convertFile(file);
}
