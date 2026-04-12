import {
  MAX_BROWSER_FILE_SIZE_BYTES,
  OVERSIZED_FILE_MESSAGE,
} from "../converters/messages";
import {
  deriveRemoteDocumentFileName,
  getRemoteDocumentResponseMessage,
  INVALID_REMOTE_DOCUMENT_URL_MESSAGE,
  normalizeGitHubDocumentUrl,
  shouldRejectGitHubBlobUrl,
  UNSUPPORTED_GITHUB_BLOB_URL_MESSAGE,
} from "../shared/remoteDocumentShared";

export {
  deriveRemoteDocumentFileName,
  INVALID_REMOTE_DOCUMENT_URL_MESSAGE,
  UNSUPPORTED_GITHUB_BLOB_URL_MESSAGE,
};

export const REMOTE_DOCUMENT_BROWSER_ACCESS_MESSAGE =
  "We couldn't download that document in the browser. The site may block direct access or require sign-in.";
export const REMOTE_DOCUMENT_DOWNLOAD_TIMEOUT_MS = 30_000;
export const REMOTE_DOCUMENT_TIMEOUT_MESSAGE =
  "Downloading that document URL timed out. Try again or download it locally first.";

type HeaderLookup = Pick<Headers, "get">;
type FetchLike = typeof fetch;

interface DownloadRemoteDocumentOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

function parseContentLength(headers: HeaderLookup) {
  const rawContentLength = headers.get("content-length");

  if (!rawContentLength) {
    return null;
  }

  const contentLength = Number.parseInt(rawContentLength, 10);

  return Number.isFinite(contentLength) && contentLength >= 0
    ? contentLength
    : null;
}

function isAbortError(error: unknown) {
  if (!(error instanceof Error) && (typeof error !== "object" || error === null)) {
    return false;
  }

  const name =
    error instanceof Error
      ? error.name
      : "name" in error && typeof error.name === "string"
        ? error.name
        : "";
  const message =
    error instanceof Error
      ? error.message
      : "message" in error && typeof error.message === "string"
        ? error.message
        : "";

  return name === "AbortError" || message.toLowerCase().includes("abort");
}

export async function downloadRemoteDocument(
  urlInput: string,
  options: DownloadRemoteDocumentOptions = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? REMOTE_DOCUMENT_DOWNLOAD_TIMEOUT_MS;
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlInput.trim());
  } catch {
    throw new Error(INVALID_REMOTE_DOCUMENT_URL_MESSAGE);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(INVALID_REMOTE_DOCUMENT_URL_MESSAGE);
  }

  const normalizedUrl = normalizeGitHubDocumentUrl(parsedUrl);
  if (shouldRejectGitHubBlobUrl(parsedUrl, normalizedUrl)) {
    throw new Error(UNSUPPORTED_GITHUB_BLOB_URL_MESSAGE);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;

    try {
      response = await fetchImpl(normalizedUrl.toString(), {
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);
      }

      throw new Error(REMOTE_DOCUMENT_BROWSER_ACCESS_MESSAGE);
    }

    if (!response.ok) {
      throw new Error(getRemoteDocumentResponseMessage(response.status));
    }

    const contentLength = parseContentLength(response.headers);

    if (
      contentLength !== null &&
      contentLength > MAX_BROWSER_FILE_SIZE_BYTES
    ) {
      throw new Error(OVERSIZED_FILE_MESSAGE);
    }

    let blob: Blob;

    try {
      blob = await response.blob();
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);
      }

      throw new Error(REMOTE_DOCUMENT_BROWSER_ACCESS_MESSAGE);
    }

    if (blob.size > MAX_BROWSER_FILE_SIZE_BYTES) {
      throw new Error(OVERSIZED_FILE_MESSAGE);
    }
    const responseUrl = new URL(response.url || normalizedUrl.toString());
    const fileName = deriveRemoteDocumentFileName(
      responseUrl,
      response.headers,
      blob.type,
    );

    return new File([blob], fileName, { type: blob.type });
  } finally {
    clearTimeout(timeoutId);
  }
}
