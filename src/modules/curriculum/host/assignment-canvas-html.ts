function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function generateCanvasHtml(assignment: any): string {
  const title = escapeHtml(assignment?.title ?? "Assignment");
  const instructions = String(assignment?.instructions ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
  return `<div class="assignment">\n  <h2>${title}</h2>\n${instructions}\n</div>`;
}

export function downloadCanvasHtml(assignment: any) {
  const name = String(assignment?.title ?? "assignment").replace(/[^\w-]+/g, "-").toLowerCase();
  const blob = new Blob([generateCanvasHtml(assignment)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
