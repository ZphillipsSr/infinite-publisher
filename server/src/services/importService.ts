// src/services/importService.ts
import mammoth from "mammoth";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParseModule = require("pdf-parse");

function getPdfParseFunction():
  | null
  | ((data: Buffer) => Promise<{ text: string }>) {
  const mod: any = pdfParseModule;

  if (!mod) {
    console.error("pdf-parse module is undefined or null.");
    return null;
  }

  if (typeof mod === "function") return mod;
  if (mod && typeof mod.default === "function") return mod.default;
  if (mod && typeof mod.pdf === "function") return mod.pdf;
  if (mod && mod.default && typeof mod.default.pdf === "function") {
    return mod.default.pdf;
  }

  console.error("pdf-parse module export shape unsupported:", {
    type: typeof mod,
    keys: Object.keys(mod),
    defaultType: mod.default ? typeof mod.default : null,
    defaultKeys: mod.default ? Object.keys(mod.default) : null
  });

  return null;
}

const pdfParseFn = getPdfParseFunction();

export async function importManuscriptFromFile(args: {
  originalName: string;
  buffer: Buffer;
}): Promise<{ fileName: string; text: string }> {
  const { originalName, buffer } = args;
  const lower = originalName.toLowerCase();

  let text = "";

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    text = buffer.toString("utf8");
  } else if (lower.endsWith(".pdf")) {
    if (!pdfParseFn) {
      throw new Error(
        "PDF import is not available because pdf-parse is not properly configured on this server."
      );
    }
    const data = await pdfParseFn(buffer);
    text = (data && data.text) || "";
  } else if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || "";
  } else if (lower.endsWith(".epub")) {
    const err = new Error(
      "EPUB import not implemented yet. Please convert to DOCX, PDF, or TXT and re-upload."
    );
    (err as any).status = 415;
    throw err;
  } else {
    const err = new Error(
      "Unsupported file type. Allowed extensions: .txt, .md, .pdf, .doc, .docx, .epub"
    );
    (err as any).status = 415;
    throw err;
  }

  if (!text.trim()) {
    const err = new Error("No extractable text found in the uploaded file.");
    (err as any).status = 422;
    throw err;
  }

  return { fileName: originalName, text };
}