export const SUPPORTED_FORMATS = ["txt", "json"] as const;

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
  warnings: string[];
  selected: boolean;
}
