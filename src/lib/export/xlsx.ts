// Excel (.xlsx) renderer: library index, question bank, and standards × DOK coverage.
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { KIND_LABEL, plainInline, safeFilename, type ExportResource } from "./resource";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EFE9" } };

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, name: "Arial", size: 10 };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

function bodyFont(ws: ExcelJS.Worksheet) {
  ws.eachRow((r, i) => { if (i > 1) r.font = { name: "Arial", size: 10 }; r.alignment = { ...r.alignment, wrapText: true, vertical: "top" }; });
}

export async function exportResourcesXlsx(resources: ExportResource[], opts: { filename?: string } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Canvas Mastery";
  const items = resources.filter((r) => r.kind !== "question_set");
  const questions = resources.flatMap((r) => (r.questions ?? []).map((q) => ({ q, set: r.title })));

  if (items.length) {
    const ws = wb.addWorksheet("Library index");
    ws.columns = [
      { header: "Title", key: "title", width: 40 },
      { header: "Type", key: "kind", width: 14 },
      { header: "Grade", key: "grade", width: 8 },
      { header: "Subject", key: "subject", width: 16 },
      { header: "DOK levels", key: "dok", width: 12 },
      { header: "Standards", key: "standards", width: 28 },
      { header: "Standard count", key: "stdCount", width: 10 },
      { header: "Source", key: "source", width: 10 },
      { header: "Attached file", key: "file", width: 24 },
      { header: "Updated", key: "updated", width: 12 },
      { header: "Summary", key: "summary", width: 60 },
    ];
    items.forEach((r) => ws.addRow({
      title: r.title, kind: KIND_LABEL[r.kind], grade: r.grade ?? "", subject: r.subject ?? "",
      dok: Array.from(new Set(r.dokLevels)).sort().join(", "),
      standards: r.standards.map((s) => s.code).join(", "), stdCount: r.standards.length,
      source: r.source ?? "", file: r.fileName ?? "",
      updated: r.updatedAt ? new Date(r.updatedAt) : null,
      summary: plainInline(r.blocks.find((b) => b.type === "p")?.["text" as never] ?? "").slice(0, 300),
    }));
    ws.getColumn("updated").numFmt = "yyyy-mm-dd";
    styleHeader(ws); bodyFont(ws);
  }

  if (questions.length) {
    const ws = wb.addWorksheet("Question bank");
    const maxAns = Math.max(4, ...questions.map(({ q }) => q.answers.length));
    ws.columns = [
      { header: "#", key: "n", width: 5 },
      { header: "Question", key: "text", width: 60 },
      { header: "Type", key: "type", width: 18 },
      { header: "Points", key: "points", width: 8 },
      { header: "DOK", key: "dok", width: 6 },
      { header: "Standards", key: "standards", width: 24 },
      { header: "Correct answer(s)", key: "correct", width: 16 },
      ...Array.from({ length: maxAns }, (_, i) => ({ header: `Choice ${String.fromCharCode(65 + i)}`, key: `a${i}`, width: 24 })),
      { header: "Assignment", key: "assignment", width: 28 },
      { header: "Set", key: "set", width: 24 },
    ];
    questions.forEach(({ q, set }, i) => {
      const row: Record<string, unknown> = {
        n: i + 1, text: q.text, type: q.itemType ?? "", points: q.points, dok: q.dok ?? "",
        standards: q.standards.map((s) => s.code).join(", "),
        correct: q.answers.map((a, j) => (a.correct ? String.fromCharCode(65 + j) : null)).filter(Boolean).join(", "),
        assignment: q.assignment ?? "", set,
      };
      q.answers.forEach((a, j) => { row[`a${j}`] = a.text; });
      ws.addRow(row);
    });
    styleHeader(ws); bodyFont(ws);
  }

  // Standards × DOK coverage across everything selected.
  const cov = new Map<string, { code: string; description: string; byDok: number[]; items: number; questions: number }>();
  const bump = (code: string, description: string, doks: number[], isQ: boolean) => {
    const c = cov.get(code) ?? { code, description, byDok: [0, 0, 0, 0, 0], items: 0, questions: 0 };
    if (isQ) c.questions++; else c.items++;
    if (doks.length) doks.forEach((d) => { if (d >= 1 && d <= 4) c.byDok[d]++; }); else c.byDok[0]++;
    cov.set(code, c);
  };
  items.forEach((r) => r.standards.forEach((s) => bump(s.code, s.description, r.dokLevels, false)));
  questions.forEach(({ q }) => q.standards.forEach((s) => bump(s.code, s.description, q.dok ? [q.dok] : [], true)));
  if (cov.size) {
    const ws = wb.addWorksheet("Standards coverage");
    ws.columns = [
      { header: "Standard", key: "code", width: 16 },
      { header: "Description", key: "description", width: 60 },
      { header: "Resources", key: "items", width: 10 },
      { header: "Questions", key: "questions", width: 10 },
      { header: "DOK 1", key: "d1", width: 8 },
      { header: "DOK 2", key: "d2", width: 8 },
      { header: "DOK 3", key: "d3", width: 8 },
      { header: "DOK 4", key: "d4", width: 8 },
      { header: "Untagged DOK", key: "d0", width: 12 },
      { header: "Gaps", key: "gaps", width: 22 },
    ];
    Array.from(cov.values()).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })).forEach((c) => {
      const gaps = [1, 2, 3].filter((d) => c.byDok[d] === 0).map((d) => `DOK ${d}`).join(", ");
      ws.addRow({ code: c.code, description: c.description, items: c.items, questions: c.questions, d1: c.byDok[1], d2: c.byDok[2], d3: c.byDok[3], d4: c.byDok[4], d0: c.byDok[0], gaps });
    });
    styleHeader(ws); bodyFont(ws);
  }

  if (!wb.worksheets.length) wb.addWorksheet("Empty").addRow(["Nothing to export"]);
  const buf = await wb.xlsx.writeBuffer();
  const name = opts.filename ?? safeFilename(resources.length === 1 ? resources[0].title : `Library export (${resources.length} items)`, "xlsx");
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
  return name;
}
