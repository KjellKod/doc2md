export type ConversionResultStatus = "success" | "warning" | "error";

export type ConversionQualityLevel = "good" | "review" | "poor";

export interface ConversionQuality {
  level: ConversionQualityLevel;
  summary: string;
}

export interface ConversionResult {
  markdown: string;
  warnings: string[];
  status: ConversionResultStatus;
  quality?: ConversionQuality;
}

export type Converter = (file: File) => Promise<ConversionResult>;
