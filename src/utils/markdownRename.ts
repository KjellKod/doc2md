export function markdownRename(name: string): string {
  const stem = name.trim().replace(/\.md$/iu, "").trim();
  if (!stem || stem === "." || stem === "..") {
    throw new Error("Enter a document name other than a dot or two dots.");
  }
  if (
    /[/\\:]/u.test(stem) ||
    Array.from(stem).some(
      (character) =>
        character.charCodeAt(0) < 32 ||
        (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159),
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
