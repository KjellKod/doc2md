import type { ConversionStatus } from "../types";

interface StatusIndicatorProps {
  status: ConversionStatus;
}

const statusLabels: Record<ConversionStatus, string> = {
  pending: "Queued",
  converting: "Converting",
  success: "Ready",
  warning: "Review",
  error: "Needs attention"
};

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  return (
    <span className={`status-indicator status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
