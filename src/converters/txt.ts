import { normalizeLineEndings } from "./delimited";
import { readFileAsText } from "./readText";
import type { Converter } from "./types";

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
