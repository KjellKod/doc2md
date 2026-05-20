import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/universal";

export interface DocxHtmlConversion {
  value: string;
  messages: { message: string }[];
  imageCount: number;
}

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;

function stripImageTags(html: string): string {
  return html.replace(IMG_TAG_PATTERN, "");
}

export async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<DocxHtmlConversion> {
  let imageCount = 0;
  // Short-circuit Mammoth's default base64 inlining: count each image and
  // emit an <img> with no src. Stripping happens below.
  // Note: Mammoth's API is convertToHtml(input, options) — convertImage must
  // be on the second argument, not merged into the input.
  const convertImage = mammoth.images.imgElement(() => {
    imageCount += 1;
    return Promise.resolve({ src: "" });
  });

  const input =
    typeof Buffer !== "undefined"
      ? { buffer: Buffer.from(arrayBuffer) }
      : { arrayBuffer };

  const result = await mammoth.convertToHtml(input, { convertImage });

  return {
    value: stripImageTags(result.value),
    messages: result.messages,
    imageCount
  };
}

export interface SheetData {
  name: string;
  rows: unknown[][];
}

export async function readAllSheets(file: File): Promise<SheetData[]> {
  // read-excel-file v9 unified API: a single call returns every sheet as
  // { sheet: name, data: rows }. The old v7 dance with readSheetNames + a
  // per-sheet readXlsxFile is no longer supported.
  const sheets = await readXlsxFile(file, { trim: false });
  return sheets.map((sheet) => ({ name: sheet.sheet, rows: sheet.data }));
}
