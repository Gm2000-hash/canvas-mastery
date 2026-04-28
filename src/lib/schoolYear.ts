// School year helpers used across the app.
// A school year runs July 1 of year N through June 9 of year N+1.
// Label format: "YYYY-YYYY" (e.g. "2024-2025").

export function schoolYearLabelFor(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1..12
  if (m >= 7) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

export function currentSchoolYearLabel(): string {
  return schoolYearLabelFor(new Date()) as string;
}

// Returns the most recent N school year labels including the current one.
export function recentSchoolYears(n = 6): string[] {
  const out: string[] = [];
  const now = new Date();
  let y = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${y + 1}`);
    y--;
  }
  return out;
}
