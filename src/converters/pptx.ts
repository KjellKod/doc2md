import JSZip from "jszip";
import { readFileAsArrayBuffer } from "./readBinary";
import type { Converter } from "./types";

const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PRESENTATIONML_NAMESPACE =
  "http://schemas.openxmlformats.org/presentationml/2006/main";
const RELATIONSHIP_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_RELATIONSHIP_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/relationships";

const EMPTY_PPTX_MESSAGE = "This PPTX file did not contain any extractable slide text.";
const EMPTY_SLIDE_MESSAGE = "This slide contains no extractable text.";
const INVALID_PPTX_MESSAGE =
  "This PPTX file could not be read. It may be corrupted or use unsupported content.";

function parseXmlDocument(xml: string) {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");

  if (parsed.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Unable to parse Open XML content.");
  }

  return parsed;
}

function normalizeZipPath(basePath: string, target: string) {
  const baseSegments = basePath.split("/").filter(Boolean);
  const targetSegments = target.split("/").filter(Boolean);
  const resolvedSegments = target.startsWith("/") ? [] : [...baseSegments];

  for (const segment of targetSegments) {
    if (segment === ".") {
      continue;
    }

    if (segment === "..") {
      resolvedSegments.pop();
      continue;
    }

    resolvedSegments.push(segment);
  }

  return resolvedSegments.join("/");
}

async function readZipText(zip: JSZip, filePath: string) {
  const entry = zip.file(filePath);

  if (!entry) {
    return null;
  }

  return entry.async("string");
}

export async function getOrderedSlidePaths(zip: JSZip) {
  const presentationXml = await readZipText(zip, "ppt/presentation.xml");
  const relationshipsXml = await readZipText(zip, "ppt/_rels/presentation.xml.rels");

  if (!presentationXml || !relationshipsXml) {
    throw new Error("Missing presentation metadata.");
  }

  const presentationDocument = parseXmlDocument(presentationXml);
  const relationshipsDocument = parseXmlDocument(relationshipsXml);
  const relationshipMap = new Map<string, string>();
  const relationships = Array.from(
    relationshipsDocument.getElementsByTagNameNS(
      PACKAGE_RELATIONSHIP_NAMESPACE,
      "Relationship"
    )
  );

  relationships.forEach((relationship) => {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");

    if (id && target) {
      relationshipMap.set(id, normalizeZipPath("ppt", target));
    }
  });

  return Array.from(
    presentationDocument.getElementsByTagNameNS(PRESENTATIONML_NAMESPACE, "sldId")
  ).map((slideId) => {
    const relationshipId =
      slideId.getAttributeNS(RELATIONSHIP_NAMESPACE, "id") ?? slideId.getAttribute("r:id");
    const slidePath = relationshipId ? relationshipMap.get(relationshipId) : null;

    if (!slidePath) {
      throw new Error("Missing slide relationship.");
    }

    return slidePath;
  });
}

function getPlaceholderType(shape: Element) {
  const placeholder = shape.getElementsByTagNameNS(PRESENTATIONML_NAMESPACE, "ph").item(0);

  return placeholder?.getAttribute("type") ?? null;
}

function getParagraphText(paragraph: Element) {
  const textNodes = Array.from(paragraph.getElementsByTagNameNS(DRAWINGML_NAMESPACE, "t"));
  const value = textNodes
    .map((node) => node.textContent ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return value;
}

export function extractSlideContent(slideXml: string) {
  const slideDocument = parseXmlDocument(slideXml);
  const shapes = Array.from(slideDocument.getElementsByTagNameNS(PRESENTATIONML_NAMESPACE, "sp"));
  let title = "";
  const body: string[] = [];

  for (const shape of shapes) {
    const placeholderType = getPlaceholderType(shape);

    if (placeholderType === "sldNum" || placeholderType === "dt" || placeholderType === "ftr") {
      continue;
    }

    const paragraphs = Array.from(shape.getElementsByTagNameNS(DRAWINGML_NAMESPACE, "p"))
      .map(getParagraphText)
      .filter((value) => value.length > 0);

    if (paragraphs.length === 0) {
      continue;
    }

    const isTitleShape =
      placeholderType === "title" ||
      placeholderType === "ctrTitle" ||
      (title.length === 0 && body.length === 0);

    if (isTitleShape && title.length === 0) {
      title = paragraphs[0];
      body.push(...paragraphs.slice(1));
      continue;
    }

    body.push(...paragraphs);
  }

  if (title.length === 0 && body.length > 0) {
    title = body.shift() ?? "";
  }

  return {
    title,
    body
  };
}

function renderSlideSection(slideNumber: number, title: string, body: string[]) {
  const heading = title.length > 0 ? `## Slide ${slideNumber}: ${title}` : `## Slide ${slideNumber}`;
  const bodyMarkdown =
    body.length > 0
      ? body.map((line) => `- ${line}`).join("\n")
      : EMPTY_SLIDE_MESSAGE;

  return `${heading}\n\n${bodyMarkdown}`;
}

export const convertPptx: Converter = async (file) => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slidePaths = await getOrderedSlidePaths(zip);

    if (slidePaths.length === 0) {
      return {
        markdown: "",
        warnings: [EMPTY_PPTX_MESSAGE],
        status: "error"
      };
    }

    const slideContents = await Promise.all(
      slidePaths.map(async (slidePath, index) => {
        const slideXml = await readZipText(zip, slidePath);

        if (!slideXml) {
          throw new Error("Missing slide content.");
        }

        const slideContent = extractSlideContent(slideXml);

        return {
          ...slideContent,
          slideNumber: index + 1
        };
      })
    );
    const hasExtractableText = slideContents.some(
      (slideContent) =>
        slideContent.title.length > 0 || slideContent.body.length > 0
    );

    if (!hasExtractableText) {
      return {
        markdown: "",
        warnings: [EMPTY_PPTX_MESSAGE],
        status: "error"
      };
    }

    return {
      markdown: slideContents
        .map((slideContent) =>
          renderSlideSection(
            slideContent.slideNumber,
            slideContent.title,
            slideContent.body
          )
        )
        .join("\n\n"),
      warnings: [],
      status: "success"
    };
  } catch {
    return {
      markdown: "",
      warnings: [INVALID_PPTX_MESSAGE],
      status: "error"
    };
  }
};
