export interface NodeCompatOptions {
  domParser?: typeof DOMParser;
}

let nodeCompatEnabled = false;
let nodeCompatOptions: NodeCompatOptions = {};

export function enableNodeCompat(options: NodeCompatOptions = {}) {
  nodeCompatEnabled = true;
  nodeCompatOptions = {
    ...nodeCompatOptions,
    ...options
  };
}

export function disableNodeCompat() {
  nodeCompatEnabled = false;
  nodeCompatOptions = {};
}

export function isNodeCompatEnabled() {
  return nodeCompatEnabled;
}

export function getDomParser() {
  if (nodeCompatOptions.domParser) {
    return nodeCompatOptions.domParser;
  }

  if (typeof globalThis.DOMParser === "function") {
    return globalThis.DOMParser;
  }

  throw new Error("DOMParser is not available in the current runtime.");
}
