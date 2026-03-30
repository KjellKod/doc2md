import type { ConversionStatus } from "../types";

interface StatusIndicatorProps {
  status: ConversionStatus;
  label?: string;
}

const statusLabels: Record<ConversionStatus, string> = {
  pending: "Queued",
  converting: "Converting",
  success: "Ready",
  warning: "Review",
  error: "Needs attention",
};

export default function StatusIndicator({
  status,
  label,
}: StatusIndicatorProps) {
  return (
    <span className={`status-indicator status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {label ?? statusLabels[status]}
    </span>
  );
}
