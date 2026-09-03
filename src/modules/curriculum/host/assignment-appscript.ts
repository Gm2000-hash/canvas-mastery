function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateAppsScript(assignment: any): string {
  const title = assignment?.title ?? "Assignment";
  const body = JSON.stringify(assignment ?? {}, null, 2);
  return `// Google Apps Script export for: ${title}\nfunction createAssignment() {\n  const data = ${body};\n  const doc = DocumentApp.create(data.title || "Assignment");\n  const b = doc.getBody();\n  b.appendParagraph(data.title || "Assignment").setHeading(DocumentApp.ParagraphHeading.HEADING1);\n  (data.instructions ? String(data.instructions).split("\\n") : []).forEach(function (line) {\n    b.appendParagraph(line);\n  });\n  Logger.log(doc.getUrl());\n}\n`;
}

export function downloadAppsScript(assignment: any) {
  const name = String(assignment?.title ?? "assignment").replace(/[^\w-]+/g, "-").toLowerCase();
  download(`${name}.gs`, generateAppsScript(assignment), "text/plain;charset=utf-8");
}
