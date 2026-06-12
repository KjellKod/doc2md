import { describe, expect, it } from "vitest";
import { detectJsonFormatTarget } from "./editorJsonFormat";

// Helper: apply a returned TargetedInsert to the source string the way the
// committer would, so tests can assert the resulting document directly.
function apply(
  value: string,
  target: ReturnType<typeof detectJsonFormatTarget>,
): string {
  if (!target) {
    throw new Error("expected a non-null target");
  }
  return value.slice(0, target.start) + target.text + value.slice(target.end);
}

describe("detectJsonFormatTarget — whole document (no selection)", () => {
  it("wraps a one-line object as an indented json fenced block (AC1)", () => {
    const value = '{"name":"doc2md","active":true}';
    const target = detectJsonFormatTarget(value, 0, 0);
    expect(apply(value, target)).toBe(
      '```json\n{\n  "name": "doc2md",\n  "active": true\n}\n```',
    );
  });

  it("matches upload converter output byte-for-byte (AC1)", () => {
    const value = '{"name":"doc2md","active":true}';
    const parsed = JSON.parse(value);
    const expected = `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    const target = detectJsonFormatTarget(value, 0, 0);
    expect(apply(value, target)).toBe(expected);
  });

  it("wraps a top-level array as a fenced block (AC1)", () => {
    const value = "[1,2,3]";
    const target = detectJsonFormatTarget(value, 0, 0);
    expect(apply(value, target)).toBe("```json\n[\n  1,\n  2,\n  3\n]\n```");
  });

  it("reformats an existing json fenced block and preserves the fence (AC3)", () => {
    const value = '```json\n{"a":1,"b":2}\n```';
    const target = detectJsonFormatTarget(value, 0, 0);
    expect(apply(value, target)).toBe(
      '```json\n{\n  "a": 1,\n  "b": 2\n}\n```',
    );
    // Re-selects the formatted block, consistent with the other three branches.
    expect(target?.caretStart).toBe(0);
    expect(target?.caretEnd).toBe(target?.text.length ?? 0);
  });

  it("preserves leading/trailing blank lines around the target", () => {
    const value = '\n\n{"a":1}\n\n';
    const target = detectJsonFormatTarget(value, 0, 0);
    expect(target).not.toBeNull();
    expect(apply(value, target)).toBe('\n\n```json\n{\n  "a": 1\n}\n```\n\n');
  });

  it("returns null for malformed raw JSON (AC4)", () => {
    expect(detectJsonFormatTarget('{"a":1,}', 0, 0)).toBeNull();
    expect(detectJsonFormatTarget("{not json}", 0, 0)).toBeNull();
  });

  it("returns null for a fenced block with a malformed body (AC4)", () => {
    expect(detectJsonFormatTarget("```json\n{bad}\n```", 0, 0)).toBeNull();
  });

  it("returns null for prose / values not starting with { or [ (AC4)", () => {
    expect(detectJsonFormatTarget("hello world", 0, 0)).toBeNull();
    expect(detectJsonFormatTarget("123", 0, 0)).toBeNull();
    expect(detectJsonFormatTarget('"x"', 0, 0)).toBeNull();
    expect(detectJsonFormatTarget("", 0, 0)).toBeNull();
    expect(detectJsonFormatTarget("   \n  ", 0, 0)).toBeNull();
  });

  it("returns null for mixed Markdown + JSON with no selection (conservative; AC4)", () => {
    const value = '# Title\n\n{"a":1}\n\nmore prose';
    expect(detectJsonFormatTarget(value, 0, 0)).toBeNull();
  });

  it("does not retag a json5 / jsonc fence (AC3/AC4)", () => {
    // Body is strict-JSON-valid, but the info string is not `json`; we must not
    // reformat or silently retag it to ```json.
    expect(detectJsonFormatTarget('```json5\n{"a":1}\n```', 0, 0)).toBeNull();
    expect(detectJsonFormatTarget('```jsonc\n{"a":1}\n```', 0, 0)).toBeNull();
  });
});

describe("detectJsonFormatTarget — selection", () => {
  it("indents a raw JSON selection in place, NON-fenced, leaving surrounding bytes untouched (AC2)", () => {
    const before = "Here is some config:\n\n";
    const json = '{"a":1,"b":2}';
    const after = "\n\nThanks.";
    const value = before + json + after;
    const start = before.length;
    const end = before.length + json.length;

    const target = detectJsonFormatTarget(value, start, end);
    expect(target).not.toBeNull();
    // No fence injected into surrounding Markdown.
    expect(target?.text).toBe('{\n  "a": 1,\n  "b": 2\n}');
    const result = apply(value, target);
    expect(result).toBe(
      before + '{\n  "a": 1,\n  "b": 2\n}' + after,
    );
    // Surrounding text byte-identical.
    expect(result.startsWith(before)).toBe(true);
    expect(result.endsWith(after)).toBe(true);
    // Offsets and re-selection cover the formatted span.
    expect(target?.start).toBe(start);
    expect(target?.caretStart).toBe(start);
    expect(target?.caretEnd).toBe(start + (target?.text.length ?? 0));
  });

  it("reformats a selected json fenced block and preserves the fence (AC3)", () => {
    const before = "intro\n";
    const block = '```json\n{"a":1}\n```';
    const value = before + block;
    const start = before.length;
    const end = value.length;

    const target = detectJsonFormatTarget(value, start, end);
    expect(target).not.toBeNull();
    expect(apply(value, target)).toBe(before + '```json\n{\n  "a": 1\n}\n```');
  });

  it("preserves whitespace padding inside a selection span", () => {
    const value = '  {"a":1}  ';
    const target = detectJsonFormatTarget(value, 0, value.length);
    expect(target?.text).toBe('  {\n  "a": 1\n}  ');
  });

  it("returns null when the selection is not confidently JSON (AC4)", () => {
    const value = "Just selecting some prose here.";
    expect(detectJsonFormatTarget(value, 0, value.length)).toBeNull();
  });

  it("returns null for a malformed JSON selection (AC4)", () => {
    const value = 'prefix {"a":1,} suffix';
    const start = "prefix ".length;
    const end = start + '{"a":1,}'.length;
    expect(detectJsonFormatTarget(value, start, end)).toBeNull();
  });

  it("does not retag a selected json5 fence (AC4)", () => {
    const value = 'x\n```json5\n{"a":1}\n```';
    const start = "x\n".length;
    const end = value.length;
    expect(detectJsonFormatTarget(value, start, end)).toBeNull();
  });
});
