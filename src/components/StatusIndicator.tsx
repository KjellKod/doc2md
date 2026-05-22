import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { ConversionStatus } from "../types";

interface StatusIndicatorProps {
  status: ConversionStatus;
  label?: string;
  compact?: boolean;
  description?: string;
  descriptionId?: string;
}

interface StatusConfig {
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const statusConfig: Record<ConversionStatus, StatusConfig> = {
  pending: {
    label: "Queued",
    Icon: Clock,
  },
  converting: {
    label: "Working",
    Icon: Loader2,
  },
  success: {
    label: "Ready",
    Icon: Check,
  },
  warning: {
    label: "Review",
    Icon: AlertTriangle,
  },
  error: {
    label: "Failed",
    Icon: XCircle,
  },
};

const statusDescriptions: Record<ConversionStatus, string> = {
  pending: "Queued",
  converting: "Converting to Markdown.",
  success: "Markdown is ready to review.",
  warning: "Converted with warnings. Review before using.",
  error: "Unable to convert this file. Try another file or paste the text into a draft.",
};

export default function StatusIndicator({
  status,
  label,
  compact = false,
  description,
  descriptionId,
}: StatusIndicatorProps) {
  const { Icon, label: defaultLabel } = statusConfig[status];
  const statusLabel = label ?? defaultLabel;
  const tooltip = description ?? statusDescriptions[status];

  return (
    <span
      className={`status-indicator status-${status}${
        compact ? " status-indicator--compact" : ""
      }`}
      aria-label={tooltip}
      aria-describedby={descriptionId}
    >
      <Icon className="status-icon" aria-hidden="true" />
      <span className={compact ? "visually-hidden" : "status-label"}>
        {statusLabel}
      </span>
      <span
        id={descriptionId}
        role="tooltip"
        className="file-list-status-tooltip"
      >
        {tooltip}
      </span>
    </span>
  );
}
