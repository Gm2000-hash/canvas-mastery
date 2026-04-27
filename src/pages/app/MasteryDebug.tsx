import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { ArrowLeft, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

type Course = { id: string; name: string };
type Student = { id: string; name: string; sortable_name: string | null };
type Standard = { id: string; code: string; description: string };
type Snap = {
  mastery_score: number;
  mastered: boolean;
  attempts: number;
  computed_at: string;
};
type DebugRow = {
  source: "question_direct" | "question_text_match" | "assignment_fallback";
  assignment_id: string;
  assignment_name: string;
  question_id: string | null;
  question_position: number | null;
  question_text: string | null;
  points: number | null;
  points_possible: number | null;
  pct: number | null;
  weight: number;
  confirmed: boolean;
  ai_suggested: boolean;
  confidence: number | null;
  matched_via_question_id: string | null;
  occurred_at: string | null;
};

function stripHtml(s: string | null) {
  return (s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function pctFmt(v: number | null | undefined) {
  return v == null ? "—" : `${Math.round(Number(v) * 100)}%`;
}

export default function MasteryDebug() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [studentId, setStudentId] = useState("");
  const [standardId, setStandardId] = useState("");

  const [settings, setSettings] = useState<{ threshold: number; window: number }>({ threshold: 0.8, window: 3 });
  const [snap, setSnap] = useState<Snap | null>(null);
  const [rows, setRows] = useState<DebugRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("courses").select("id, name").order("name").then(({ data }) => {
      setCourses(data ?? []);
      if (data?.length) setCourseId(data[0].id);
    });
    supabase.from("teacher_settings").select("mastery_threshold, attempt_window").maybeSingle().then(({ data }) => {
      if (data) setSettings({ threshold: Number(data.mastery_threshold ?? 0.8), window: Number(data.attempt_window ?? 3) });
    });
  }, []);

  // Load students + standards (those used in this course's tags or snapshots)
  useEffect(() => {
    if (!courseId) return;
    setStudentId(""); setStandardId(""); setRows(null); setSnap(null);

    (async () => {
      const { data: studs } = await supabase
        .from("students").select("id, name, sortable_name")
        .eq("course_id", courseId).order("sortable_name", { nullsFirst: false });
      setStudents(studs ?? []);

      const { data: assigns } = await supabase.from("assignments").select("id").eq("course_id", courseId);
      const aIds = (assigns ?? []).map((a) => a.id);
      const stdIds = new Set<string>();
      if (aIds.length) {
        const { data: aTags } = await supabase
          .from("assignment_standards").select("standard_id").in("assignment_id", aIds)
          .or("confirmed.eq.true,ai_suggested.eq.true");
        (aTags ?? []).forEach((t) => stdIds.add(t.standard_id));
        const { data: qs } = await supabase.from("quiz_questions").select("id").in("assignment_id", aIds);
        const qIds = (qs ?? []).map((q) => q.id);
        if (qIds.length) {
          for (let i = 0; i < qIds.length; i += 200) {
            const { data: qTags } = await supabase
              .from("question_standards").select("standard_id").in("question_id", qIds.slice(i, i + 200))
              .or("confirmed.eq.true,ai_suggested.eq.true");
            (qTags ?? []).forEach((t) => stdIds.add(t.standard_id));
          }
        }
      }
      const studentIds = (studs ?? []).map((s) => s.id);
      if (studentIds.length) {
        const { data: snaps } = await supabase
          .from("mastery_snapshots").select("standard_id").in("student_id", studentIds);
        (snaps ?? []).forEach((s) => stdIds.add(s.standard_id));
      }
      const ids = Array.from(stdIds);
      if (!ids.length) { setStandards([]); return; }
      const { data: stdRows } = await supabase
        .from("standards").select("id, code, description").in("id", ids).order("code");
      setStandards(stdRows ?? []);
    })();
  }, [courseId]);

  // Fetch debug rows + latest snapshot whenever both are picked
  useEffect(() => {
    if (!studentId || !standardId) { setRows(null); setSnap(null); return; }
    setLoading(true);
    (async () => {
      const [{ data: dbg, error }, { data: ms }] = await Promise.all([
        supabase.rpc("mastery_debug" as any, { _student_id: studentId, _standard_id: standardId }),
        supabase.from("mastery_snapshots")
          .select("mastery_score, mastered, attempts, computed_at")
          .eq("student_id", studentId).eq("standard_id", standardId)
          .order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (error) console.error(error);
      setRows((dbg as DebugRow[] | null) ?? []);
      setSnap((ms as Snap | null) ?? null);
      setLoading(false);
    })();
  }, [studentId, standardId]);

  // Recompute the same average that recompute-mastery would produce
  const computed = useMemo(() => {
    if (!rows) return null;
    const scored = rows
      .filter((r) => r.pct != null)
      .map((r) => ({ pct: Number(r.pct), w: Number(r.weight), ts: r.occurred_at ? new Date(r.occurred_at).getTime() : 0 }))
      .sort((a, b) => b.ts - a.ts);
    const recent = scored.slice(0, settings.window);
    if (!recent.length) return { avg: null as number | null, used: 0, total: scored.length };
    const totalW = recent.reduce((s, r) => s + r.w, 0);
    const avg = totalW > 0
      ? recent.reduce((s, r) => s + r.pct * r.w, 0) / totalW
      : recent.reduce((s, r) => s + r.pct, 0) / recent.length;
    return { avg, used: recent.length, total: scored.length };
  }, [rows, settings.window]);

  const studentName = students.find((s) => s.id === studentId)?.name ?? "";
  const standard = standards.find((s) => s.id === standardId);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link to="/app/mastery"><ArrowLeft className="h-4 w-4 mr-1" /> Mastery</Link>
            </Button>
          </div>
          <h1 className="font-display text-4xl font-semibold mb-2 flex items-center gap-3">
            <Bug className="h-7 w-7 text-accent" /> Mastery debug
          </h1>
          <p className="text-muted-foreground">
            See exactly which questions and tags contributed to a student's mastery score on a standard.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Course</div>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Student</div>
            <Select value={studentId} onValueChange={setStudentId} disabled={!students.length}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Standard</div>
            <Select value={standardId} onValueChange={setStandardId} disabled={!standards.length}>
              <SelectTrigger><SelectValue placeholder="Select standard" /></SelectTrigger>
              <SelectContent>
                {standards.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-mono text-xs mr-2">{s.code}</span>
                    <span className="text-muted-foreground">{s.description.slice(0, 60)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!studentId || !standardId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Pick a student and a standard to inspect.
        </CardContent></Card>
      ) : loading || rows === null ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {studentName} <span className="text-muted-foreground">on</span>{" "}
                <span className="font-mono">{standard?.code}</span>
              </CardTitle>
              <CardDescription>{standard?.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-4 gap-4 text-sm">
              <Stat label="Stored mastery" value={pctFmt(snap?.mastery_score ?? null)}
                    sub={snap ? `${snap.attempts} attempts • ${new Date(snap.computed_at).toLocaleString()}` : "no snapshot"} />
              <Stat label="Recomputed (live)" value={pctFmt(computed?.avg ?? null)}
                    sub={computed ? `${computed.used} of ${computed.total} contributions used (window=${settings.window})` : ""} />
              <Stat label="Threshold" value={pctFmt(settings.threshold)} sub="mastered if ≥ threshold" />
              <Stat label="Mastered" value={snap?.mastered ? "Yes" : snap ? "No" : "—"} sub="" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contributing items ({rows.length})</CardTitle>
              <CardDescription>
                Direct = question is tagged to this standard. Text-match = question's text matches a tagged question elsewhere. Fallback = assignment-grain percentage.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {rows.length === 0 ? (
                <div className="px-6 py-10 text-center text-muted-foreground text-sm">
                  No tagged questions or fallback submissions found for this student + standard.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Assignment / Question</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={`${r.assignment_id}-${r.question_id ?? "sub"}-${i}`}>
                        <TableCell><SourceBadge row={r} /></TableCell>
                        <TableCell className="max-w-md">
                          <div className="font-medium truncate">{r.assignment_name}</div>
                          {r.question_text != null && (
                            <div className="text-xs text-muted-foreground truncate">
                              {r.question_position != null ? `Q${r.question_position}. ` : ""}
                              {stripHtml(r.question_text).slice(0, 140)}
                            </div>
                          )}
                          {!r.confirmed && r.ai_suggested && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              AI tag • confidence {r.confidence != null ? Math.round(Number(r.confidence) * 100) + "%" : "—"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {r.points == null ? <span className="text-muted-foreground">no response</span>
                            : `${Number(r.points)} / ${r.points_possible ?? "?"}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pctFmt(r.pct)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(r.weight).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {r.occurred_at ? new Date(r.occurred_at).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function SourceBadge({ row }: { row: DebugRow }) {
  if (row.source === "question_direct") {
    return <Badge variant={row.confirmed ? "default" : "secondary"}>{row.confirmed ? "Direct" : "Direct (AI)"}</Badge>;
  }
  if (row.source === "question_text_match") {
    return <Badge variant="outline">Text match</Badge>;
  }
  return <Badge variant="secondary">Fallback</Badge>;
}
