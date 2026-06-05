import { useId, useState } from "react";
import type { ConversionQuality } from "../converters/types";

interface QualityIndicatorProps {
  quality: ConversionQuality;
  format?: string;
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

function qualitySubject(format: string | undefined) {
  if (!format) {
    return "Conversion";
  }

  return format.toUpperCase();
}

export default function QualityIndicator({
  quality,
  format,
}: QualityIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  const label = QUALITY_LABEL[quality.level];
  const subject = qualitySubject(format);
  const showVisibleLabel = quality.level !== "good";

  return (
    <div
      className="quality-indicator"
      data-quality-level={quality.level}
    >
      <button
        type="button"
        className="quality-trigger"
        aria-label={`${subject} quality: ${label}`}
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
        <span className="quality-icon" aria-hidden="true">
          {QUALITY_ICON[quality.level]}
        </span>
        {showVisibleLabel ? (
          <span className="quality-label">{label}</span>
        ) : null}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="quality-tooltip"
        hidden={!isOpen}
      >
        {quality.summary}
      </span>
    </div>
  );
}
