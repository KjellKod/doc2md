import type { ConversionQuality } from "../converters/types";

export const SUPPORTED_FORMATS = [
  "md",
  "txt",
  "json",
  "csv",
  "tsv",
  "html",
  "docx",
  "xlsx",
  "pdf",
  "pptx",
] as const;

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

export type ConversionStatus =
  | "pending"
  | "converting"
  | "success"
  | "warning"
  | "error";

export interface FileEntry {
  id: string;
  file: File;
  name: string;
  format: string;
  status: ConversionStatus;
  markdown: string;
  editedMarkdown?: string;
  warnings: string[];
  quality?: ConversionQuality;
  selected: boolean;
  isScratch?: boolean;
}
