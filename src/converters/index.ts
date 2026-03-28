import type { SupportedFormat } from "../types";
import { convertCsv } from "./csv";
import { convertDocx } from "./docx";
import { convertHtml } from "./html";
import { convertJson } from "./json";
import { convertPdf } from "./pdf";
import { convertPptx } from "./pptx";
import { convertTsv } from "./tsv";
import { convertTxt } from "./txt";
import type { ConversionResult, Converter } from "./types";
import { convertXlsx } from "./xlsx";

const converters: Record<SupportedFormat, Converter> = {
  csv: convertCsv,
  docx: convertDocx,
  html: convertHtml,
  json: convertJson,
  pdf: convertPdf,
  pptx: convertPptx,
  tsv: convertTsv,
  txt: convertTxt,
  xlsx: convertXlsx
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
