import { useId, useState } from "react";
import type { ConversionQuality } from "../converters/types";

interface PdfQualityIndicatorProps {
  quality: ConversionQuality;
}

const QUALITY_ICON = {
  good: "✓",
  review: "!",
  poor: "×",
} as const;

const QUALITY_LABEL = {
  good: "Good",
  review: "Review",
  poor: "Poor",
} as const;

export default function PdfQualityIndicator({
  quality,
}: PdfQualityIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  const label = QUALITY_LABEL[quality.level];
  const showVisibleLabel = quality.level !== "good";

  return (
    <div
      className="pdf-quality-indicator"
      data-quality-level={quality.level}
    >
      <button
        type="button"
        className="pdf-quality-trigger"
        aria-label={`PDF quality: ${label}`}
        aria-describedby={tooltipId}
        aria-expanded={isOpen}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
      >
        <span className="pdf-quality-icon" aria-hidden="true">
          {QUALITY_ICON[quality.level]}
        </span>
        {showVisibleLabel ? (
          <span className="pdf-quality-label">{label}</span>
        ) : null}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pdf-quality-tooltip"
        hidden={!isOpen}
      >
        {quality.summary}
      </span>
    </div>
  );
}
