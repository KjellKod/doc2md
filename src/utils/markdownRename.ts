export function markdownRename(name: string): string {
  const stem = name.trim().replace(/\.md$/iu, "").trim();
  if (
    !stem ||
    stem === "." ||
    stem === ".." ||
    /[/\\:]/u.test(stem) ||
    Array.from(stem).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  ) {
    throw new Error(
      "Choose a name without slashes, colons, or control characters.",
    );
  }
  if (new TextEncoder().encode(`${stem}.md`).length > 255) {
    throw new Error("Choose a shorter document name.");
  }
  return `${stem}.md`;
}
