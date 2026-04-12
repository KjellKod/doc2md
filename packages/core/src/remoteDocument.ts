import {
  deriveRemoteDocumentFileName,
  getRemoteDocumentResponseMessage,
  INVALID_REMOTE_DOCUMENT_URL_MESSAGE,
} from "../../../src/shared/remoteDocumentShared";

export const DEFAULT_REMOTE_DOCUMENT_TIMEOUT_MS = 30_000;
export const REMOTE_DOCUMENT_ACCESS_FAILED_MESSAGE =
  "We couldn't download that document from this machine. The host may block access, require sign-in, or the network request failed.";
export const REMOTE_DOCUMENT_TIMEOUT_MESSAGE =
  "Downloading the remote document timed out. Try again or download it locally first.";

type FetchLike = typeof fetch;

interface CreateInputFileFromUrlOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
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

export function isRemoteUrl(input: string) {
  try {
    const parsedUrl = new URL(input);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export {
  deriveRemoteDocumentFileName,
  INVALID_REMOTE_DOCUMENT_URL_MESSAGE,
};

export async function createInputFileFromUrl(
  urlInput: string,
  options: CreateInputFileFromUrlOptions = {},
) {
  if (!isRemoteUrl(urlInput)) {
    throw new Error(INVALID_REMOTE_DOCUMENT_URL_MESSAGE);
  }

  const parsedUrl = new URL(urlInput);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REMOTE_DOCUMENT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;

    try {
      response = await fetchImpl(parsedUrl.toString(), {
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);
      }

      throw new Error(REMOTE_DOCUMENT_ACCESS_FAILED_MESSAGE);
    }

    if (!response.ok) {
      throw new Error(getRemoteDocumentResponseMessage(response.status));
    }

    let blob: Blob;

    try {
      blob = await response.blob();
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);
      }

      throw new Error(REMOTE_DOCUMENT_ACCESS_FAILED_MESSAGE);
    }

    const responseUrl = new URL(response.url || parsedUrl.toString());
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
