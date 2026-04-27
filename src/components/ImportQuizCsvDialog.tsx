// CSV quiz import dialog. Steps:
//   1. Pick course + quiz name + file
//   2. Confirm layout (long/wide) + column mapping
//   3. Options + Import
//   4. Progress + summary
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileText, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type Course = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  defaultCourseId?: string;
  onImported?: (assignmentId: string) => void;
};

type Layout = "long" | "wide";

type LongMapping = {
  student_email?: string;
  student_name?: string;
  question_text?: string;
  points?: string;
  points_possible?: string;
  correct?: string;
};
type WideMapping = {
  student_email?: string;
  student_name?: string;
  points_possible_row?: number;
};

// ---------- Tiny CSV parser (handles quoted fields, commas, BOM, CRLF) ----------
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = "";
        if (row.length > 1 || (row.length === 1 && row[0] !== "")) out.push(row);
        row = [];
      } else cur += c;
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur); out.push(row); }
  if (out.length === 0) return { headers: [], rows: [] };
  const headers = out[0].map((h) => h.trim());
  const rows = out.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
  return { headers, rows };
}

// ---------- Heuristics ----------
function looksLikeIdHeader(h: string): "email" | "name" | null {
  const x = h.toLowerCase().trim();
  if (/email/.test(x)) return "email";
  if (/name|student/.test(x)) return "name";
  return null;
}
function looksLikeQuestionLong(h: string): boolean {
  const x = h.toLowerCase();
  return /question|item|stem/.test(x);
}
function looksLikePoints(h: string): boolean {
  return /^points?$|score|earned/i.test(h.toLowerCase());
}
function looksLikePointsPossible(h: string): boolean {
  return /possible|max|total/i.test(h.toLowerCase());
}
function looksLikeCorrect(h: string): boolean {
  return /^correct$|is_correct/i.test(h.toLowerCase());
}

function detectLayout(headers: string[]): { layout: Layout; mapping: LongMapping | WideMapping } {
  // Long if there's a clear "question" column and a "points" column
  const qCol = headers.find(looksLikeQuestionLong);
  const pCol = headers.find(looksLikePoints);
  if (qCol && pCol) {
    return {
      layout: "long",
      mapping: {
        student_email: headers.find((h) => looksLikeIdHeader(h) === "email"),
        student_name: headers.find((h) => looksLikeIdHeader(h) === "name"),
        question_text: qCol,
        points: pCol,
        points_possible: headers.find(looksLikePointsPossible),
        correct: headers.find(looksLikeCorrect),
      },
    };
  }
  // Otherwise wide
  return {
    layout: "wide",
    mapping: {
      student_email: headers.find((h) => looksLikeIdHeader(h) === "email"),
      student_name: headers.find((h) => looksLikeIdHeader(h) === "name"),
    },
  };
}

export default function ImportQuizCsvDialog({ open, onOpenChange, courses, defaultCourseId, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [courseId, setCourseId] = useState<string>(defaultCourseId ?? "");
  const [quizName, setQuizName] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [layout, setLayout] = useState<Layout>("long");
  const [longMapping, setLongMapping] = useState<LongMapping>({});
  const [wideMapping, setWideMapping] = useState<WideMapping>({});
  const [autoTag, setAutoTag] = useState(true);
  const [recompute, setRecompute] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [result, setResult] = useState<any | null>(null);

  // Reset state when re-opened
  useEffect(() => {
    if (open) {
      setStep(1);
      setCourseId(defaultCourseId ?? courses[0]?.id ?? "");
      setQuizName("");
      setDueAt("");
      setFileName("");
      setHeaders([]);
      setRows([]);
      setParseError(null);
      setResult(null);
      setProgressPct(0);
      setProgressLabel("");
      setImporting(false);
      setAutoTag(true);
      setRecompute(true);
    }
  }, [open, defaultCourseId, courses]);

  function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    if (!quizName) setQuizName(file.name.replace(/\.csv$/i, ""));
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { headers, rows } = parseCsv(String(reader.result ?? ""));
        if (headers.length === 0 || rows.length === 0) {
          setParseError("CSV is empty or could not be parsed.");
          return;
        }
        if (rows.length > 20000) {
          setParseError("File too large (max 20,000 rows). Please split it.");
          return;
        }
        setHeaders(headers);
        setRows(rows);
        const det = detectLayout(headers);
        setLayout(det.layout);
        if (det.layout === "long") setLongMapping(det.mapping as LongMapping);
        else setWideMapping(det.mapping as WideMapping);
      } catch (e) {
        setParseError(`Could not parse CSV: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  const canGoStep2 = !!courseId && !!quizName && headers.length > 0 && !parseError;
  const canImport = useMemo(() => {
    if (layout === "long") {
      return !!longMapping.question_text && !!longMapping.points && (!!longMapping.student_email || !!longMapping.student_name);
    }
    return !!(wideMapping.student_email || wideMapping.student_name);
  }, [layout, longMapping, wideMapping]);

  const previewQuestionCount = useMemo(() => {
    if (layout === "long") {
      if (!longMapping.question_text) return 0;
      const set = new Set<string>();
      for (const r of rows) {
        const v = (r[longMapping.question_text] ?? "").trim();
        if (v) set.add(v.toLowerCase());
      }
      return set.size;
    }
    const idCols = new Set([wideMapping.student_email, wideMapping.student_name].filter(Boolean) as string[]);
    return headers.filter((h) => !idCols.has(h)).length;
  }, [layout, longMapping, wideMapping, rows, headers]);

  const previewStudentCount = useMemo(() => {
    const set = new Set<string>();
    const emailCol = layout === "long" ? longMapping.student_email : wideMapping.student_email;
    const nameCol = layout === "long" ? longMapping.student_name : wideMapping.student_name;
    for (const r of rows) {
      const e = (emailCol && r[emailCol]) ? String(r[emailCol]).toLowerCase().trim() : "";
      const n = (nameCol && r[nameCol]) ? String(r[nameCol]).toLowerCase().trim() : "";
      const k = e || n;
      if (k) set.add(k);
    }
    // wide: if points_possible_row, subtract 1
    if (layout === "wide" && typeof wideMapping.points_possible_row === "number") {
      // approximation
      return Math.max(0, set.size - 1);
    }
    return set.size;
  }, [layout, longMapping, wideMapping, rows]);

  async function runImport() {
    setImporting(true);
    setStep(4);
    setProgressLabel("Uploading rows…");
    setProgressPct(15);
    try {
      const body = {
        course_id: courseId,
        quiz_name: quizName,
        due_at: dueAt || null,
        layout,
        mapping: layout === "long" ? longMapping : wideMapping,
        rows,
        options: { auto_tag: autoTag, recompute },
      };
      setProgressLabel(autoTag ? "Importing, then AI-tagging questions…" : "Importing scores…");
      setProgressPct(40);
      const { data, error } = await supabase.functions.invoke("import-quiz-csv", { body });
      if (error) throw new Error((error as any).message ?? "Import failed");
      if ((data as any)?.error) throw new Error((data as any).error);
      setProgressPct(100);
      setProgressLabel("Done");
      setResult(data);
      toast.success("CSV imported successfully");
      onImported?.((data as any).assignment_id);
    } catch (e) {
      setResult({ error: (e as Error).message });
      setProgressPct(100);
      setProgressLabel("Failed");
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import quiz from CSV</DialogTitle>
          <DialogDescription>
            Upload per-student per-question scores from Google Forms, a spreadsheet, or another quiz tool.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`flex items-center gap-1 ${step === s ? "text-foreground font-medium" : ""}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${step >= s ? "bg-primary text-primary-foreground border-primary" : "border-muted"}`}>
                {step > s ? <CheckCircle2 className="h-3 w-3" /> : s}
              </div>
              {s < 4 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: File + meta */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quiz name</Label>
              <Input value={quizName} onChange={(e) => setQuizName(e.target.value)} placeholder="e.g. Pre-ECA Practice" />
            </div>
            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CSV file</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              >
                {fileName ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{fileName}</span>
                    <Badge variant="secondary">{rows.length} rows</Badge>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                    <div className="text-sm">Click to choose a CSV file</div>
                    <div className="text-xs text-muted-foreground">Wide or long format — we auto-detect</div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
            {parseError && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{parseError}</AlertDescription></Alert>
            )}
          </div>
        )}

        {/* Step 2: Layout + mapping */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Layout</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long — one row per (student, question)</SelectItem>
                  <SelectItem value="wide">Wide — one row per student, one column per question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {layout === "long" ? (
              <div className="grid grid-cols-2 gap-3">
                <MappingSelect label="Student email" value={longMapping.student_email} onChange={(v) => setLongMapping({ ...longMapping, student_email: v })} options={headers} />
                <MappingSelect label="Student name" value={longMapping.student_name} onChange={(v) => setLongMapping({ ...longMapping, student_name: v })} options={headers} />
                <MappingSelect label="Question text *" value={longMapping.question_text} onChange={(v) => setLongMapping({ ...longMapping, question_text: v })} options={headers} />
                <MappingSelect label="Points earned *" value={longMapping.points} onChange={(v) => setLongMapping({ ...longMapping, points: v })} options={headers} />
                <MappingSelect label="Points possible" value={longMapping.points_possible} onChange={(v) => setLongMapping({ ...longMapping, points_possible: v })} options={headers} />
                <MappingSelect label="Correct (T/F)" value={longMapping.correct} onChange={(v) => setLongMapping({ ...longMapping, correct: v })} options={headers} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MappingSelect label="Student email" value={wideMapping.student_email} onChange={(v) => setWideMapping({ ...wideMapping, student_email: v })} options={headers} />
                  <MappingSelect label="Student name" value={wideMapping.student_name} onChange={(v) => setWideMapping({ ...wideMapping, student_name: v })} options={headers} />
                </div>
                <div className="space-y-2">
                  <Label>Points-possible row (optional)</Label>
                  <Select
                    value={wideMapping.points_possible_row?.toString() ?? "none"}
                    onValueChange={(v) => setWideMapping({ ...wideMapping, points_possible_row: v === "none" ? undefined : Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None — assume 1 point per question</SelectItem>
                      {rows.slice(0, 5).map((_r, i) => (
                        <SelectItem key={i} value={i.toString()}>Row {i + 1} (first data row)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Alert>
              <AlertDescription className="text-xs">
                Detected: <strong>{previewQuestionCount}</strong> question{previewQuestionCount === 1 ? "" : "s"} · <strong>{previewStudentCount}</strong> student{previewStudentCount === 1 ? "" : "s"}
              </AlertDescription>
            </Alert>

            {/* Preview */}
            <div className="space-y-1">
              <Label className="text-xs">Preview (first 3 rows)</Label>
              <ScrollArea className="border rounded-md max-h-40">
                <table className="text-xs w-full">
                  <thead className="bg-muted/50">
                    <tr>{headers.slice(0, 6).map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-t">
                        {headers.slice(0, 6).map((h) => <td key={h} className="px-2 py-1 truncate max-w-[120px]">{r[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Step 3: Options */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-3 border rounded-md p-4">
              <div className="flex items-start gap-3">
                <Checkbox id="autotag" checked={autoTag} onCheckedChange={(v) => setAutoTag(!!v)} />
                <div>
                  <Label htmlFor="autotag" className="cursor-pointer">Auto-tag new questions with AI</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Suggests standards for any new questions. Existing questions with matching text inherit tags automatically — no AI call needed.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="recompute" checked={recompute} onCheckedChange={(v) => setRecompute(!!v)} />
                <div>
                  <Label htmlFor="recompute" className="cursor-pointer">Recompute mastery when finished</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Updates Mastery and Analytics pages with the new scores.
                  </p>
                </div>
              </div>
            </div>
            <Alert>
              <AlertDescription className="text-sm">
                Ready to import <strong>{previewStudentCount}</strong> student{previewStudentCount === 1 ? "" : "s"} × <strong>{previewQuestionCount}</strong> question{previewQuestionCount === 1 ? "" : "s"} into <strong>{quizName}</strong>.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 4: Progress / result */}
        {step === 4 && (
          <div className="space-y-4">
            {!result ? (
              <>
                <div className="text-sm">{progressLabel}</div>
                <Progress value={progressPct} />
                <p className="text-xs text-muted-foreground">This may take a minute, especially for AI tagging on large quizzes.</p>
              </>
            ) : result.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>Import complete.</AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Questions created" value={result.stats?.questions_created ?? 0} />
                  <Stat label="Questions reused" value={result.stats?.questions_reused ?? 0} />
                  <Stat label="Students matched" value={result.stats?.students_matched ?? 0} />
                  <Stat label="Students created" value={result.stats?.students_created ?? 0} />
                  <Stat label="Responses written" value={result.stats?.responses_written ?? 0} />
                  <Stat label="Rows skipped" value={result.stats?.rows_skipped ?? 0} />
                  {result.stats?.ai_tagged != null && <Stat label="AI tags suggested" value={result.stats.ai_tagged} />}
                  {result.recompute?.snapshots != null && <Stat label="Mastery snapshots" value={result.recompute.snapshots} />}
                </div>
                {result.stats?.skipped_examples?.length > 0 && (
                  <Alert>
                    <AlertDescription className="text-xs">
                      Skipped reasons: {result.stats.skipped_examples.join("; ")}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as any)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!canGoStep2}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!canImport}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
          )}
          {step === 3 && (
            <Button onClick={runImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Import
            </Button>
          )}
          {step === 4 && !importing && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MappingSelect({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string | undefined) => void; options: string[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? undefined : v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— none —</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-md px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
