import { render } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import {
  findHighlightRehype,
  type RenderedFindMatch,
} from "../findHighlightRehype";
import { useFindHighlight } from "../preview/useFindHighlight";

function HookRenderedMarkdown({
  markdown,
  match,
}: {
  markdown: string;
  match: RenderedFindMatch | null;
}) {
  const findHighlight = useFindHighlight(match);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[findHighlight]}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function DirectRenderedMarkdown({
  markdown,
  match,
}: {
  markdown: string;
  match: RenderedFindMatch | null;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[findHighlightRehype(match)]}
    >
      {markdown}
    </ReactMarkdown>
  );
}

describe("useFindHighlight", () => {
  it("produces the same rendered mark output as findHighlightRehype", () => {
    const markdown = "Plain alpha. Bold **alpha bravo**. End.";
    const directPlain = render(
      <DirectRenderedMarkdown markdown={markdown} match={null} />,
    );
    const plainText = directPlain.container.textContent ?? "";
    const start = plainText.indexOf("alpha bravo");
    directPlain.unmount();

    const match = { start, end: start + "alpha bravo".length };
    const direct = render(
      <DirectRenderedMarkdown markdown={markdown} match={match} />,
    );
    const hook = render(
      <HookRenderedMarkdown markdown={markdown} match={match} />,
    );

    expect(hook.container.innerHTML).toBe(direct.container.innerHTML);
  });
});
