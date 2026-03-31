export type ConversionResultStatus = "success" | "warning" | "error";

export type PdfQualityLevel = "good" | "review" | "poor";

export interface ConversionQuality {
  level: PdfQualityLevel;
  summary: string;
}

export interface ConversionResult {
  markdown: string;
  warnings: string[];
  status: ConversionResultStatus;
  quality?: ConversionQuality;
}

export type Converter = (file: File) => Promise<ConversionResult>;
