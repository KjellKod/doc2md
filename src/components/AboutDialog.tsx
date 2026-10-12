import { useEffect, useId, useRef } from "react";

interface AboutDialogProps {
  onClose: () => void;
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="about-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
    >
      <h2 id={titleId}>About doc2md</h2>
      <p className="about-dialog-version">{__DOC2MD_DISPLAY_VERSION__}</p>
      <p id={descriptionId}>
        Convert documents to Markdown, privately on your device.
        Review, edit, and export your work in one place.
      </p>
      <nav aria-label="About resources">
        <a href="https://github.com/KjellKod/doc2md" target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>
        <a href="https://github.com/KjellKod/doc2md/blob/main/docs/using-doc2md-core.md" target="_blank" rel="noopener noreferrer">
          @doc2md/core documentation
        </a>
        <a href="https://github.com/sponsors/KjellKod" target="_blank" rel="noopener noreferrer">
          Sponsor doc2md
        </a>
      </nav>
      <form method="dialog">
        <button type="submit" autoFocus>Close</button>
      </form>
    </dialog>
  );
}
