import type { Converter } from "./types";
import { readFileAsText } from "./readText";

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

export const convertTxt: Converter = async (file) => {
  try {
    const contents = normalizeLineEndings(await readFileAsText(file));

    return {
      markdown: contents,
      warnings: [],
      status: "success"
    };
  } catch {
    return {
      markdown: "",
      warnings: ["This text file could not be read."],
      status: "error"
    };
  }
};
