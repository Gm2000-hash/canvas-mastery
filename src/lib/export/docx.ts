// Word (.docx) renderer for ExportResource.
import {
  AlignmentType, Document, HeadingLevel, LevelFormat, Packer, PageBreak, Paragraph, TextRun,
} from "docx";
import { saveAs } from "file-saver";
import {
  answerKeyBlocks, KIND_LABEL, plainInline, questionsToBlocks, resourceMetaLine, safeFilename,
  type ExportBlock, type ExportResource,
} from "./resource";

/** Split "**bold** and _italic_" into runs. */
function runs(text: string, base: Partial<ConstructorParameters<typeof TextRun>[0] & object> = {}): TextRun[] {
  const out: TextRun[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: plainInline(text.slice(last, m.index)), ...base } as any));
    if (m[2] != null) out.push(new TextRun({ text: m[2], bold: true, ...base } as any));
    else if (m[4] != null) out.push(new TextRun({ text: m[4], italics: true, ...base } as any));
    else out.push(new TextRun({ text: m[5], font: "Courier New", ...base } as any));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(new TextRun({ text: plainInline(text.slice(last)), ...base } as any));
  return out.length ? out : [new TextRun({ text: "", ...base } as any)];
}

function blockParagraphs(blocks: ExportBlock[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "h1": out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(b.text) })); break;
      case "h2": out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(b.text) })); break;
      case "h3": out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(b.text) })); break;
      case "p": out.push(new Paragraph({ spacing: { after: 160 }, children: runs(b.text) })); break;
      case "quote": out.push(new Paragraph({ indent: { left: 720 }, spacing: { after: 160 }, children: runs(b.text, { italics: true, color: "555555" }) })); break;
      case "hr": out.push(new Paragraph({ border: { bottom: { style: "single" as any, size: 6, color: "BBBBBB", space: 1 } }, spacing: { after: 200 }, children: [] })); break;
      case "ul": b.items.forEach((i) => out.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: runs(i) }))); break;
      case "ol": b.items.forEach((i) => out.push(new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: runs(i) }))); break;
    }
  }
  return out;
}

function resourceParagraphs(r: ExportResource, opts: { answerKey: boolean }): Paragraph[] {
  const ps: Paragraph[] = [];
  ps.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(r.title)] }));
  const meta = resourceMetaLine(r);
  ps.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `${KIND_LABEL[r.kind]}${meta ? " · " + meta : ""}`, italics: true, color: "666666", size: 20 })] }));
  if (r.fileName && !r.blocks.length) {
    ps.push(new Paragraph({ children: [new TextRun({ text: `Attached file: ${r.fileName} (download it from the library)`, italics: true })] }));
  }
  ps.push(...blockParagraphs(r.blocks));
  if (r.questions?.length) {
    ps.push(...blockParagraphs(questionsToBlocks(r.questions, { showAnswers: false })));
    if (opts.answerKey) {
      ps.push(new Paragraph({ children: [new PageBreak()] }));
      ps.push(...blockParagraphs(answerKeyBlocks(r.questions)));
    }
  }
  if (r.standards.length) {
    ps.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360 }, children: [new TextRun("Standards")] }));
    r.standards.forEach((s) => ps.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: `${s.code} — `, bold: true }), new TextRun(s.description)] })));
  }
  return ps;
}

export async function exportResourcesDocx(resources: ExportResource[], opts: { answerKey?: boolean; filename?: string } = {}) {
  const children: Paragraph[] = [];
  resources.forEach((r, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...resourceParagraphs(r, { answerKey: opts.answerKey ?? true }));
  });
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 40, bold: true, font: "Arial" }, paragraph: { spacing: { after: 120 }, alignment: AlignmentType.LEFT } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, font: "Arial" }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Arial" }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, font: "Arial" }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const name = opts.filename ?? safeFilename(resources.length === 1 ? resources[0].title : `Library export (${resources.length} items)`, "docx");
  saveAs(blob, name);
  return name;
}
