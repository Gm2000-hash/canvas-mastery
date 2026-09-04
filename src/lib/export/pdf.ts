// PDF renderer for ExportResource (text-based, selectable, via jsPDF).
import { jsPDF } from "jspdf";
import {
  answerKeyBlocks, KIND_LABEL, plainInline, questionsToBlocks, resourceMetaLine, safeFilename,
  type ExportBlock, type ExportResource,
} from "./resource";

const PAGE_W = 612, PAGE_H = 792, MARGIN = 60, LINE = 1.35;

class Writer {
  doc = new jsPDF({ unit: "pt", format: "letter" });
  y = MARGIN;
  page = 1;
  constructor() { this.doc.setFont("helvetica", "normal"); }

  private ensure(h: number) {
    if (this.y + h > PAGE_H - MARGIN) { this.footer(); this.doc.addPage(); this.page++; this.y = MARGIN; }
  }
  footer() {
    this.doc.setFont("helvetica", "normal"); this.doc.setFontSize(9); this.doc.setTextColor(140);
    this.doc.text(String(this.page), PAGE_W / 2, PAGE_H - 30, { align: "center" });
    this.doc.setTextColor(0);
  }
  text(txt: string, opts: { size: number; bold?: boolean; italic?: boolean; color?: number; indent?: number; hanging?: string; before?: number; after?: number }) {
    const { size, indent = 0 } = opts;
    this.doc.setFontSize(size);
    this.doc.setFont("helvetica", opts.bold && opts.italic ? "bolditalic" : opts.bold ? "bold" : opts.italic ? "italic" : "normal");
    this.doc.setTextColor(opts.color ?? 0);
    const width = PAGE_W - MARGIN * 2 - indent - (opts.hanging ? 18 : 0);
    const lines: string[] = this.doc.splitTextToSize(txt || " ", width);
    const lh = size * LINE;
    this.y += opts.before ?? 0;
    lines.forEach((ln, i) => {
      this.ensure(lh);
      if (i === 0 && opts.hanging) this.doc.text(opts.hanging, MARGIN + indent, this.y + size);
      this.doc.text(ln, MARGIN + indent + (opts.hanging ? 18 : 0), this.y + size);
      this.y += lh;
    });
    this.y += opts.after ?? 0;
    this.doc.setTextColor(0);
  }
  rule() {
    this.ensure(14);
    this.doc.setDrawColor(190); this.doc.line(MARGIN, this.y + 6, PAGE_W - MARGIN, this.y + 6); this.y += 14;
  }
  pageBreak() { this.footer(); this.doc.addPage(); this.page++; this.y = MARGIN; }

  blocks(blocks: ExportBlock[]) {
    for (const b of blocks) {
      switch (b.type) {
        case "h1": this.text(plainInline(b.text), { size: 16, bold: true, before: 10, after: 4 }); break;
        case "h2": this.text(plainInline(b.text), { size: 13.5, bold: true, before: 8, after: 3 }); break;
        case "h3": this.text(plainInline(b.text), { size: 12, bold: true, before: 6, after: 2 }); break;
        case "p": this.text(plainInline(b.text), { size: 11, after: 6 }); break;
        case "quote": this.text(plainInline(b.text), { size: 11, italic: true, color: 90, indent: 24, after: 6 }); break;
        case "hr": this.rule(); break;
        case "ul": b.items.forEach((i) => this.text(plainInline(i), { size: 11, indent: 14, hanging: "•", after: 2 })); this.y += 4; break;
        case "ol": b.items.forEach((i, n) => this.text(plainInline(i), { size: 11, indent: 14, hanging: `${n + 1}.`, after: 2 })); this.y += 4; break;
      }
    }
  }
  resource(r: ExportResource, answerKey: boolean) {
    this.text(r.title, { size: 20, bold: true, after: 2 });
    const meta = resourceMetaLine(r);
    this.text(`${KIND_LABEL[r.kind]}${meta ? " · " + meta : ""}`, { size: 9.5, italic: true, color: 110, after: 10 });
    this.rule();
    if (r.fileName && !r.blocks.length) this.text(`Attached file: ${r.fileName} (download it from the library)`, { size: 11, italic: true, after: 6 });
    this.blocks(r.blocks);
    if (r.questions?.length) {
      this.blocks(questionsToBlocks(r.questions, { showAnswers: false }));
      if (answerKey) { this.pageBreak(); this.blocks(answerKeyBlocks(r.questions)); }
    }
    if (r.standards.length) {
      this.text("Standards", { size: 13.5, bold: true, before: 12, after: 3 });
      r.standards.forEach((s) => this.text(`${s.code} — ${s.description}`, { size: 10, indent: 14, hanging: "•", after: 2 }));
    }
  }
}

export async function exportResourcesPdf(resources: ExportResource[], opts: { answerKey?: boolean; filename?: string } = {}) {
  const w = new Writer();
  resources.forEach((r, i) => { if (i > 0) w.pageBreak(); w.resource(r, opts.answerKey ?? true); });
  w.footer();
  const name = opts.filename ?? safeFilename(resources.length === 1 ? resources[0].title : `Library export (${resources.length} items)`, "pdf");
  w.doc.save(name);
  return name;
}
