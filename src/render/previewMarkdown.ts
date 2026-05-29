// Render-layer entry point for the content-affecting Preview Markdown
// normalization. The implementation currently lives in
// src/components/previewFormatting.ts (it is shared with the editor's
// line-map machinery). Rendering code imports it from here so the render
// layer does not reach into src/components/. If the formatter ever moves
// fully into the render layer, only this re-export changes.
export {
  formatPreviewMarkdown,
  formatPreviewMarkdownWithLineMap,
} from "../components/previewFormatting";
