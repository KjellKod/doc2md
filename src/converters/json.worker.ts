import { convertJsonText } from "./json";

type JsonWorkerRequest = {
  file: File;
};

type JsonWorkerResponse =
  | {
      type: "result";
      result: ReturnType<typeof convertJsonText>;
    }
  | {
      type: "error";
      message: string;
    };

type JsonWorkerScope = {
  onmessage: ((event: MessageEvent<JsonWorkerRequest>) => void) | null;
  postMessage: (message: JsonWorkerResponse) => void;
};

const workerScope = self as unknown as JsonWorkerScope;

workerScope.onmessage = async (event: MessageEvent<JsonWorkerRequest>) => {
  try {
    const raw = await event.data.file.text();
    const response: JsonWorkerResponse = {
      type: "result",
      result: convertJsonText(raw),
    };
    workerScope.postMessage(response);
  } catch (error) {
    const response: JsonWorkerResponse = {
      type: "error",
      message: error instanceof Error ? error.message : "JSON conversion failed",
    };
    workerScope.postMessage(response);
  }
};

export {};
