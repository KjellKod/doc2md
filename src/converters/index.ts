import type { SupportedFormat } from "../types";
import { convertJson } from "./json";
import { convertTxt } from "./txt";
import type { ConversionResult, Converter } from "./types";

const converters: Record<SupportedFormat, Converter> = {
  json: convertJson,
  txt: convertTxt
};

const UNSUPPORTED_FILE_MESSAGE =
  "Unsupported file type. Please upload one of the supported formats.";

export function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop();

  if (!extension || extension === fileName) {
    return "";
  }

  return extension.toLowerCase();
}

export function isSupportedFormat(value: string): value is SupportedFormat {
  return value in converters;
}

export async function convertFile(file: File): Promise<ConversionResult> {
  const extension = getFileExtension(file.name);

  if (!isSupportedFormat(extension)) {
    return {
      markdown: "",
      warnings: [UNSUPPORTED_FILE_MESSAGE],
      status: "error"
    };
  }

  return converters[extension](file);
}

export { UNSUPPORTED_FILE_MESSAGE };
