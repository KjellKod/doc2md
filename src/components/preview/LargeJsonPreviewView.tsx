import type { LargeJsonPreviewState } from "./largeJsonPreview";

type LargeJsonPreviewViewProps = {
  state: LargeJsonPreviewState;
};

export function LargeJsonPreviewView({ state }: LargeJsonPreviewViewProps) {
  return (
    <div className="large-json-preview" data-testid="large-json-preview">
      <div className="large-json-preview-meta" aria-live="polite">
        Showing {state.shownCharacters.toLocaleString()} of{" "}
        {state.totalCharacters.toLocaleString()} JSON characters
      </div>
      <pre className="large-json-preview-code" aria-label="Large JSON preview">
        <code>{state.previewText}</code>
      </pre>
    </div>
  );
}
