export type ConversionResultStatus = "success" | "warning" | "error";

export interface ConversionResult {
  markdown: string;
  warnings: string[];
  status: ConversionResultStatus;
}

export type Converter = (file: File) => Promise<ConversionResult>;
