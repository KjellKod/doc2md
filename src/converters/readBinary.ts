import { isNodeCompatEnabled } from "./runtime";

export function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (isNodeCompatEnabled() || typeof globalThis.FileReader !== "function") {
    return file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new globalThis.FileReader();

    reader.onerror = () => {
      reject(new Error("Unable to read file contents."));
    };

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read file contents."));
    };

    reader.readAsArrayBuffer(file);
  });
}
