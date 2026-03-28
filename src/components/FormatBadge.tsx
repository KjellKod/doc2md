interface FormatBadgeProps {
  format: string;
}

export default function FormatBadge({ format }: FormatBadgeProps) {
  return (
    <span className={`format-badge format-badge-${format}`}>
      {format.toUpperCase()}
    </span>
  );
}
