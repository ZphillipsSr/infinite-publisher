// src/services/docxService.ts
import { Document, Paragraph, TextRun } from "docx";

export function createDocxFromManuscript(opts: {
  content: string;
  title?: string;
  trimSize?: string;
  lineSpacing?: number;
}): Document {
  const { content, title, trimSize, lineSpacing } = opts;

  let pageWidthTwips = 6 * 1440;
  let pageHeightTwips = 9 * 1440;

  if (trimSize === "8.5x11") {
    pageWidthTwips = 8.5 * 1440;
    pageHeightTwips = 11 * 1440;
  }

  const marginTwips = 1440;
  const baseLine = 240;
  const lineValue = Math.round(
    baseLine *
      (typeof lineSpacing === "number" && lineSpacing > 0 ? lineSpacing : 1.15)
  );

  const lines = content.split(/\r?\n/);

  const paragraphs = lines.map((line) => {
    if (!line.trim()) {
      return new Paragraph({ text: "" });
    }
    return new Paragraph({
      children: [
        new TextRun({
          text: line,
          font: "Garamond",
          size: 24
        })
      ],
      spacing: {
        line: lineValue,
        lineRule: "auto"
      },
      indent: {
        firstLine: 720
      }
    });
  });

  const doc = new Document({
    creator: "Infinite Publisher",
    title: title || "Manuscript",
    description: "Generated interior for KDP from Infinite Publisher.",
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageWidthTwips,
              height: pageHeightTwips
            },
            margin: {
              top: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              right: marginTwips
            }
          }
        },
        children: paragraphs
      }
    ]
  });

  return doc;
}