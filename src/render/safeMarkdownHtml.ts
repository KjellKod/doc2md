import type { Element, Parent, Root } from "hast";
import type { Schema } from "hast-util-sanitize";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { PluggableList, Plugin } from "unified";
import { EXIT, visit } from "unist-util-visit";
import type { VFile } from "vfile";

const EXPLICIT_ID_PREFIX = "user-content:";
const GENERATED_MARKER_PROPERTY = "dataDoc2mdGeneratedIdentity";
const GENERATED_IMAGE_MARKER_PROPERTY = "dataDoc2mdGeneratedImage";
const EXPLICIT_TARGET_MARKER_PROPERTY = "dataDoc2mdExplicitTarget";
const EXPLICIT_TARGET_CLASS = "markdown-explicit-anchor";
const GENERATED_MARKER_BYTES = 16;

interface GeneratedIdentityState {
  ids: string[];
  marker: string;
}

interface AuthorIdentity {
  sourceId: string;
  outputId: string;
  explicitTarget: boolean;
}

interface IdentityState extends GeneratedIdentityState {
  authorIdentities: AuthorIdentity[];
  sourceToOutputId: Map<string, string>;
}

type MarkdownFileData = VFile["data"] & {
  doc2mdMarkdownIdentity?: IdentityState;
};

function randomMarker(): string {
  const bytes = new Uint8Array(GENERATED_MARKER_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function stringProperty(value: Element["properties"][string]): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function classNames(node: Element): string[] {
  const value = node.properties.className;
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return typeof value === "string" ? value.split(/\s+/u) : [];
}

function isGeneratedFootnoteIdentity(node: Element): boolean {
  const id = stringProperty(node.properties.id);
  if (id === null) {
    return false;
  }
  if (node.tagName === "a" && node.properties.dataFootnoteRef === true) {
    return true;
  }
  if (node.tagName === "h2" && classNames(node).includes("sr-only")) {
    return id === "footnote-label";
  }
  return node.tagName === "li" && id.startsWith("user-content-fn-");
}

export const captureGeneratedFootnoteIds: Plugin<[], Root> = () =>
  (tree: Root, file: VFile) => {
    const marker = randomMarker();
    const ids: string[] = [];

    visit(tree, "element", (node: Element) => {
      if (!isGeneratedFootnoteIdentity(node)) {
        return;
      }
      const id = stringProperty(node.properties.id);
      if (id === null) {
        return;
      }
      ids.push(id);
      node.properties[GENERATED_MARKER_PROPERTY] = marker;
    });

    const data = file.data as MarkdownFileData;
    data.doc2mdMarkdownIdentity = {
      ids,
      marker,
      authorIdentities: [],
      sourceToOutputId: new Map(),
    };
  };

const markExplicitMarkdownTargets: Plugin<[], Root> = () =>
  (tree: Root, file: VFile) => {
    const state = (file.data as MarkdownFileData).doc2mdMarkdownIdentity;
    if (!state) {
      return;
    }
    visit(tree, "element", (node: Element) => {
      if (
        node.tagName === "a" &&
        stringProperty(node.properties.id) !== null &&
        node.properties.href === undefined
      ) {
        node.properties[EXPLICIT_TARGET_MARKER_PROPERTY] = state.marker;
      }
    });
  };

const markGeneratedMarkdownImages: Plugin<[], Root> = () =>
  (tree: Root, file: VFile) => {
    const state = (file.data as MarkdownFileData).doc2mdMarkdownIdentity;
    if (!state) {
      return;
    }
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "img") {
        node.properties[GENERATED_IMAGE_MARKER_PROPERTY] = state.marker;
      }
    });
  };

function withoutProperties(
  properties: NonNullable<Schema["attributes"]>[string] | undefined,
  blocked: Set<string>,
) {
  return (properties ?? []).filter((property) => {
    const name = typeof property === "string" ? property : property[0];
    return !blocked.has(name);
  });
}

const attributes = defaultSchema.attributes ?? {};
const blockedWildcardProperties = new Set([
  "id",
  "name",
  "accessKey",
  "tabIndex",
]);
const safeWildcardProperties = withoutProperties(
  attributes["*"],
  blockedWildcardProperties,
);

export const safeMarkdownHtmlSchema: Schema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (tagName) => !["div", "picture", "source"].includes(tagName),
  ),
  strip: [
    "script",
    "style",
    "iframe",
    "form",
    "object",
    "embed",
    "picture",
    "source",
  ],
  clobber: [],
  attributes: {
    ...attributes,
    "*": safeWildcardProperties,
    a: [
      ...withoutProperties(attributes.a, blockedWildcardProperties),
      "id",
      GENERATED_MARKER_PROPERTY,
      EXPLICIT_TARGET_MARKER_PROPERTY,
    ],
    h2: [
      ...withoutProperties(attributes.h2, blockedWildcardProperties),
      "id",
      GENERATED_MARKER_PROPERTY,
    ],
    li: [
      ...withoutProperties(attributes.li, blockedWildcardProperties),
      "id",
      GENERATED_MARKER_PROPERTY,
    ],
    img: [
      ...withoutProperties(attributes.img, blockedWildcardProperties),
      GENERATED_IMAGE_MARKER_PROPERTY,
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel"],
  },
};

const removeRawImages: Plugin<[], Root> = () => (tree: Root, file: VFile) => {
  const state = (file.data as MarkdownFileData).doc2mdMarkdownIdentity;
  visit(
    tree,
    "element",
    (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName !== "img") {
        return;
      }
      const marker = stringProperty(
        node.properties[GENERATED_IMAGE_MARKER_PROPERTY],
      );
      delete node.properties[GENERATED_IMAGE_MARKER_PROPERTY];
      if (state && marker === state.marker) {
        return;
      }
      if (parent && typeof index === "number") {
        parent.children.splice(index, 1);
        return index;
      }
      return;
    },
  );
};

function normalizedAuthorId(sourceId: string): string | null {
  const trimmed = sourceId.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.startsWith(EXPLICIT_ID_PREFIX)
    ? trimmed
    : `${EXPLICIT_ID_PREFIX}${trimmed}`;
}

function uniqueId(
  base: string,
  seen: Set<string>,
  reserved: Set<string>,
): string {
  let candidate = base;
  let suffix = 1;
  while (seen.has(candidate) || reserved.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export const normalizeMarkdownIdentities: Plugin<[], Root> = () =>
  (tree: Root, file: VFile) => {
    const data = file.data as MarkdownFileData;
    const state = data.doc2mdMarkdownIdentity;
    if (!state) {
      return;
    }

    const reserved = new Set(state.ids);
    const emittedGenerated = new Set<string>();
    const seen = new Set<string>();
    const authorIdentities: AuthorIdentity[] = [];

    visit(tree, "element", (node: Element) => {
      const sourceId = stringProperty(node.properties.id);
      const marker = stringProperty(
        node.properties[GENERATED_MARKER_PROPERTY],
      );
      const explicitTargetMarker = stringProperty(
        node.properties[EXPLICIT_TARGET_MARKER_PROPERTY],
      );
      delete node.properties[GENERATED_MARKER_PROPERTY];
      delete node.properties[EXPLICIT_TARGET_MARKER_PROPERTY];
      if (sourceId === null) {
        return;
      }

      const isCapturedGenerated =
        marker === state.marker &&
        reserved.has(sourceId) &&
        !emittedGenerated.has(sourceId);
      if (isCapturedGenerated) {
        node.properties.id = sourceId;
        emittedGenerated.add(sourceId);
        seen.add(sourceId);
        return;
      }

      const base = normalizedAuthorId(sourceId);
      if (base === null) {
        delete node.properties.id;
        return;
      }
      const outputId = uniqueId(base, seen, reserved);
      node.properties.id = outputId;
      seen.add(outputId);
      const explicitTarget =
        node.tagName === "a" && explicitTargetMarker === state.marker;
      if (explicitTarget && !classNames(node).includes(EXPLICIT_TARGET_CLASS)) {
        node.properties.className = [
          ...classNames(node),
          EXPLICIT_TARGET_CLASS,
        ];
      }
      authorIdentities.push({
        sourceId,
        outputId,
        explicitTarget,
      });
    });

    const sourceToOutputId = new Map<string, string>();
    for (const identity of authorIdentities.filter(
      ({ explicitTarget }) => explicitTarget,
    )) {
      if (!sourceToOutputId.has(identity.sourceId)) {
        sourceToOutputId.set(identity.sourceId, identity.outputId);
      }
    }
    for (const identity of authorIdentities) {
      if (!sourceToOutputId.has(identity.sourceId)) {
        sourceToOutputId.set(identity.sourceId, identity.outputId);
      }
    }

    state.authorIdentities = authorIdentities;
    state.sourceToOutputId = sourceToOutputId;
  };

function decodeFragment(href: string): string | null {
  if (!href.startsWith("#")) {
    return null;
  }
  try {
    return decodeURIComponent(href.slice(1));
  } catch {
    return null;
  }
}

function encodeFragment(value: string): string {
  return encodeURIComponent(value).replace(/%3A/giu, ":");
}

function rewriteIdReference(
  sourceId: string,
  state: IdentityState,
): string {
  if (state.ids.includes(sourceId)) {
    return sourceId;
  }
  return state.sourceToOutputId.get(sourceId) ?? sourceId;
}

function rewriteAriaProperty(
  value: Element["properties"][string],
  state: IdentityState,
): Element["properties"][string] {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteIdReference(String(item), state));
  }
  if (typeof value === "string") {
    return value
      .split(/\s+/u)
      .filter(Boolean)
      .map((item) => rewriteIdReference(item, state))
      .join(" ");
  }
  return value;
}

export const rewriteMarkdownIdentityReferences: Plugin<[], Root> = () =>
  (tree: Root, file: VFile) => {
    const state = (file.data as MarkdownFileData).doc2mdMarkdownIdentity;
    if (!state) {
      return;
    }

    visit(tree, "element", (node: Element) => {
      const href = stringProperty(node.properties.href);
      if (href !== null) {
        const fragment = decodeFragment(href);
        if (fragment !== null && !state.ids.includes(fragment)) {
          const rewritten = state.sourceToOutputId.get(fragment);
          if (rewritten) {
            node.properties.href = `#${encodeFragment(rewritten)}`;
          }
        }
      }

      for (const property of ["ariaDescribedBy", "ariaLabelledBy"]) {
        const value = node.properties[property];
        if (value !== undefined) {
          node.properties[property] = rewriteAriaProperty(value, state);
        }
      }
    });
  };

const reparseRawHtmlWhenPresent: Plugin<[], Root> = () => (tree, file) => {
  let hasRawHtml = false;
  visit(tree, "raw", () => {
    hasRawHtml = true;
    return EXIT;
  });
  if (hasRawHtml) {
    return rehypeRaw()(tree, file);
  }
};

export function safeMarkdownHtmlBeforeSlugPlugins(): PluggableList {
  return [
    captureGeneratedFootnoteIds,
    markGeneratedMarkdownImages,
    reparseRawHtmlWhenPresent,
    markExplicitMarkdownTargets,
    [rehypeSanitize, safeMarkdownHtmlSchema],
    removeRawImages,
    normalizeMarkdownIdentities,
  ];
}

export function safeMarkdownHtmlAfterSlugPlugins(): PluggableList {
  return [rewriteMarkdownIdentityReferences];
}

export function isExplicitMarkdownTarget(node: Element): boolean {
  const id = stringProperty(node.properties.id);
  return (
    node.tagName === "a" &&
    id !== null &&
    id.startsWith(EXPLICIT_ID_PREFIX) &&
    node.properties.href === undefined &&
    classNames(node).includes(EXPLICIT_TARGET_CLASS)
  );
}
