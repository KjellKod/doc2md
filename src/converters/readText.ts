import { isNodeCompatEnabled } from "./runtime";

export function readFileAsText(file: Blob): Promise<string> {
  if (isNodeCompatEnabled() || typeof globalThis.FileReader !== "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new globalThis.FileReader();

    reader.onerror = () => {
      reject(new Error("Unable to read file contents."));
    };

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.readAsText(file);
  });
}
