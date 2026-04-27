import type { SVGProps } from "react";

interface SaveButtonProps {
  onSave: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  ariaKeyshortcuts?: string;
}

function SaveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 4h12l2 2v14H5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4v6h8V4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 20v-6h8v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SaveButton({
  onSave,
  disabled = false,
  busy = false,
  ariaKeyshortcuts,
}: SaveButtonProps) {
  return (
    <button
      type="button"
      className="save-button"
      onClick={() => void onSave()}
      disabled={disabled}
      aria-disabled={disabled}
      aria-busy={busy}
      aria-label="Save document"
      aria-keyshortcuts={ariaKeyshortcuts}
    >
      <SaveIcon className="save-button-icon" aria-hidden="true" />
      <span className="save-button-label">Save</span>
    </button>
  );
}
