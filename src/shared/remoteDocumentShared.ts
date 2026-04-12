export const INVALID_REMOTE_DOCUMENT_URL_MESSAGE =
  "Enter a valid http:// or https:// document URL.";
export const UNSUPPORTED_GITHUB_BLOB_URL_MESSAGE =
  "This GitHub blob URL can't be normalized safely. Use a raw GitHub URL instead.";

const MIME_TYPE_EXTENSION_MAP: Record<string, string> = {
  "application/json": "json",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/csv": "csv",
  "text/html": "html",
  "text/markdown": "md",
  "text/plain": "txt",
  "text/tab-separated-values": "tsv",
};

type HeaderLookup = Pick<Headers, "get">;

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop();

  if (!extension || extension === fileName) {
    return "";
  }

  return extension.toLowerCase();
}

function decodeMaybeEncodedValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeFileName(fileName: string) {
  return Array.from(fileName, (character) => {
    if (character.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(character)) {
      return "-";
    }

    return character;
  }).join("").trim();
}

function parseContentDispositionFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(
    /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i,
  );

  if (utf8Match?.[1]) {
    return sanitizeFileName(
      decodeMaybeEncodedValue(utf8Match[1].trim().replace(/^"|"$/g, "")),
    );
  }

  const plainMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);

  if (!plainMatch?.[1]) {
    return null;
  }

  return sanitizeFileName(plainMatch[1].trim().replace(/^"|"$/g, ""));
}

function getUrlPathFileName(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  if (!lastSegment) {
    return null;
  }

  return sanitizeFileName(decodeMaybeEncodedValue(lastSegment));
}

function appendExtensionIfMissing(fileName: string, mimeType: string) {
  if (getFileExtension(fileName)) {
    return fileName;
  }

  const extension = MIME_TYPE_EXTENSION_MAP[normalizeMimeType(mimeType)];

  if (!extension) {
    return fileName;
  }

  return `${fileName}.${extension}`;
}

export function normalizeMimeType(mimeType: string | null | undefined) {
  return mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isGitHubBlobUrl(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  return url.hostname === "github.com" && segments[2] === "blob";
}

export function normalizeGitHubDocumentUrl(url: URL) {
  if (url.hostname === "raw.githubusercontent.com") {
    return new URL(url.toString());
  }

  if (url.hostname !== "github.com") {
    return new URL(url.toString());
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length < 5) {
    return new URL(url.toString());
  }

  const [owner, repo, marker, ...restSegments] = segments;
  const filePathSegments = restSegments.slice(1);

  if (
    !owner ||
    !repo ||
    marker !== "blob" ||
    filePathSegments.length === 0
  ) {
    return new URL(url.toString());
  }

  const normalizedUrl = new URL(url.toString());
  normalizedUrl.searchParams.set("raw", "1");
  return normalizedUrl;
}

export function shouldRejectGitHubBlobUrl(url: URL, normalizedUrl: URL) {
  const segments = url.pathname.split("/").filter(Boolean);

  return (
    isGitHubBlobUrl(url) &&
    (segments.length < 5 ||
    normalizedUrl.searchParams.get("raw") !== "1"
    )
  );
}

export function deriveRemoteDocumentFileName(
  url: URL,
  headers: HeaderLookup,
  mimeType: string,
) {
  const headerFileName = parseContentDispositionFileName(
    headers.get("content-disposition"),
  );

  if (headerFileName) {
    return appendExtensionIfMissing(headerFileName, mimeType);
  }

  const urlFileName = getUrlPathFileName(url);

  if (urlFileName) {
    return appendExtensionIfMissing(urlFileName, mimeType);
  }

  const extension = MIME_TYPE_EXTENSION_MAP[normalizeMimeType(mimeType)];

  return extension ? `downloaded-document.${extension}` : "downloaded-document";
}

export function getRemoteDocumentResponseMessage(status: number) {
  if (status === 401 || status === 403) {
    return "We couldn't download that document because the URL requires sign-in or additional access.";
  }

  if (status === 404) {
    return "We couldn't download that document because the URL returned 404 Not Found.";
  }

  return `We couldn't download that document because the server responded with HTTP ${status}.`;
}
