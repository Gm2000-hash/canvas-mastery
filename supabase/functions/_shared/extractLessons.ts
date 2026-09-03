// Turn arbitrary document text into structured lesson-plan drafts.
import { aiJson, arr, num, str, stripHtml } from "./curriculum-ai.ts";

export interface ParsedLesson {
  title: string;
  objectives?: string;
  activities?: string;
  materials?: string;
  assessment?: string;
  notes?: string;
  duration_minutes?: number | null;
}

export async function extractLessonsFromText(text: string, sourceName: string): Promise<ParsedLesson[]> {
  const body = text.replace(/\s+\n/g, "\n").trim().slice(0, 60000);
  if (body.length < 40) return [];
  const out = await aiJson<{ lessons: unknown[] }>({
    system: "You convert teacher documents into structured lesson plans. Preserve the author's wording where possible; do not invent content that is not implied by the document. Respond with one valid JSON object only.",
    user: `Document "${sourceName}":\n\n${body}\n\nIdentify every distinct lesson (a single-lesson doc yields one lesson; a unit/pacing doc yields several). For each, extract: title, objectives, activities (the lesson flow as multi-line text), materials, assessment, notes (anything else useful), duration_minutes (number or null).\nReturn JSON: {"lessons":[{"title":string,"objectives":string,"activities":string,"materials":string,"assessment":string,"notes":string,"duration_minutes":number|null}]}`,
    temperature: 0.2,
    maxTokens: 8000,
  });
  return arr<Record<string, unknown>>(out.lessons).map((l) => ({
    title: str(l.title, "Untitled lesson"),
    objectives: str(l.objectives),
    activities: str(l.activities),
    materials: str(l.materials),
    assessment: str(l.assessment),
    notes: str(l.notes),
    duration_minutes: l.duration_minutes == null ? null : num(l.duration_minutes, 0) || null,
  }));
}

/** Extract plain text from Office Open XML archives (docx/pptx/xlsx). */
export async function extractOfficeText(bytes: Uint8Array, ext: string): Promise<string> {
  const JSZip = (await import("npm:jszip@3.10.1")).default;
  const zip = await JSZip.loadAsync(bytes);
  const pick = (re: RegExp) => Object.keys(zip.files).filter((n) => re.test(n)).sort();
  let names: string[] = [];
  if (ext === "docx") names = pick(/^word\/document\.xml$/);
  else if (ext === "pptx") names = pick(/^ppt\/slides\/slide\d+\.xml$/);
  else if (ext === "xlsx") names = [...pick(/^xl\/sharedStrings\.xml$/), ...pick(/^xl\/worksheets\/sheet\d+\.xml$/)];
  const parts: string[] = [];
  for (const n of names) {
    const xml = await zip.file(n)!.async("string");
    // Insert breaks at paragraph/row boundaries, then strip tags.
    parts.push(stripHtml(xml.replace(/<\/(w:p|a:p|row)>/g, "\n").replace(/<\/(w:tc|c)>/g, "\t")));
  }
  return parts.join("\n\n");
}
