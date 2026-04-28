import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevealedNames } from "@/hooks/useRevealedNames";
import { RevealNamesToggle } from "@/components/RevealNamesToggle";
import { HistoricalToggle } from "@/components/HistoricalToggle";

type Course = { id: string; name: string };
type Student = { id: string; name: string; sortable_name: string | null };
type Standard = { id: string; code: string; description: string };
type Snap = { student_id: string; standard_id: string; mastery_score: number; mastered: boolean; attempts: number; computed_at: string };

export default function Mastery() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [students, setStudents] = useState<Student[] | null>(null);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [latestByKey, setLatestByKey] = useState<Record<string, Snap>>({});
  const [recomputing, setRecomputing] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const reveal = useRevealedNames(courseId);

  useEffect(() => {
    let q = supabase.from("courses").select("id, name").eq("hidden", false).order("name");
    if (!showHistorical) q = q.is("archived_at", null);
    q.then(({ data }) => {
      const list = (data ?? []) as Course[];
      setCourses(list);
      if (list.length && !list.find((c) => c.id === courseId)) setCourseId(list[0].id);
      if (list.length === 0) setCourseId("");
    });
  }, [showHistorical]);

  async function load() {
    if (!courseId) return;
    setStudents(null);
    let sq = supabase
      .from("students").select("id, name, sortable_name").eq("course_id", courseId).is("merged_into", null).order("sortable_name", { nullsFirst: false });
    if (!showHistorical) sq = sq.is("archived_at", null);
    const { data: studs } = await sq;
    setStudents(studs ?? []);

    // Standards that are tagged on assignments in this course, plus any
    // standards already produced by question-level mastery rollups.
    const { data: assigns } = await supabase.from("assignments").select("id").eq("course_id", courseId);
    const aIds = (assigns ?? []).map((a) => a.id);
    const stdIdSet = new Set<string>();
    if (aIds.length) {
      const { data: tags } = await supabase
        .from("assignment_standards")
        .select("standard_id")
        .in("assignment_id", aIds)
        .or("confirmed.eq.true,ai_suggested.eq.true");
      (tags ?? []).forEach((t) => stdIdSet.add(t.standard_id));
    }
    const studentIds = (studs ?? []).map((s) => s.id);
    if (!studentIds.length) { setLatestByKey({}); return; }

    const { data: snaps } = await supabase
      .from("mastery_snapshots")
      .select("student_id, standard_id, mastery_score, mastered, attempts, computed_at")
      .in("student_id", studentIds)
      .order("computed_at", { ascending: false });

    ((snaps as Snap[]) ?? []).forEach((s) => stdIdSet.add(s.standard_id));
    const stdIds = Array.from(stdIdSet);
    if (stdIds.length === 0) { setStandards([]); setLatestByKey({}); return; }

    const { data: stdRows } = await supabase
      .from("standards").select("id, code, description").in("id", stdIds).order("code");
    setStandards(stdRows ?? []);

    const map: Record<string, Snap> = {};
    for (const s of ((snaps as Snap[]) ?? []).filter((snap) => stdIdSet.has(snap.standard_id))) {
      const key = `${s.student_id}::${s.standard_id}`;
      if (!map[key]) map[key] = s; // first wins (newest)
    }
    setLatestByKey(map);
  }
  useEffect(() => { load(); reveal.hide(); /* eslint-disable-next-line */ }, [courseId, showHistorical]);

  async function recompute() {
    setRecomputing(true);
    const { data, error } = await supabase.functions.invoke("recompute-mastery");
    setRecomputing(false);
    if (error) { toast.error((error as any).message); return; }
    toast.success(`Recomputed (${(data as any).snapshots} entries)`);
    load();
  }

  const classAvg = useMemo(() => {
    const m: Record<string, { sum: number; n: number }> = {};
    for (const s of standards) {
      for (const stu of students ?? []) {
        const k = `${stu.id}::${s.id}`;
        const snap = latestByKey[k];
        if (snap) {
          (m[s.id] ??= { sum: 0, n: 0 });
          m[s.id].sum += Number(snap.mastery_score);
          m[s.id].n += 1;
        }
      }
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) out[k] = v.n ? v.sum / v.n : 0;
    return out;
  }, [standards, students, latestByKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-semibold mb-2">Mastery</h1>
          <p className="text-muted-foreground">Per-student mastery on each standard tagged in this course.</p>
        </div>
        <div className="flex gap-2 items-center">
          <HistoricalToggle value={showHistorical} onChange={setShowHistorical} reason="Mastery" />
          <Button asChild variant="ghost">
            <Link to="/app/mastery/debug"><Bug className="h-4 w-4 mr-2" /> Debug</Link>
          </Button>
          <RevealNamesToggle
            revealed={reveal.revealed}
            loading={reveal.loading}
            onReveal={reveal.reveal}
            onHide={reveal.hide}
            disabled={!courseId}
          />
          <Button variant="outline" onClick={recompute} disabled={recomputing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${recomputing ? "animate-spin" : ""}`} />
            Recompute
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Course:</span>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {students === null ? (
        <Skeleton className="h-72" />
      ) : standards.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto text-accent mb-3" />
          No confirmed standards on assignments in this course yet.<br />
          Tag a few assignments and click <strong>Recompute</strong>.
        </CardContent></Card>
      ) : students.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No students in this course.</CardContent></Card>
      ) : (
        <>
          {/* Class summary */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Class average per standard</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {standards.map((s) => {
                const v = classAvg[s.id] ?? 0;
                return (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <div className="font-mono text-xs text-muted-foreground w-28 shrink-0">{s.code}</div>
                    <div className="flex-1 truncate text-foreground/80">{s.description}</div>
                    <div className="w-44 h-2 rounded-full bg-mastery-bg overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: bandColor(v) }} />
                    </div>
                    <div className="w-12 text-right tabular-nums text-xs">{v ? `${Math.round(v * 100)}%` : "—"}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Heatmap */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Per-student heatmap</CardTitle>
              <CardDescription>Hover a cell for details. Empty cell = no graded items yet.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-1 min-w-full">
                <thead>
                  <tr>
                    <th className="text-left pl-2 sticky left-0 bg-card z-10">Student</th>
                    {standards.map((s) => (
                      <th key={s.id} className="px-1 font-mono text-[10px] text-muted-foreground rotate-[-30deg] origin-bottom-left h-16 whitespace-nowrap">{s.code}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((stu) => (
                    <tr key={stu.id}>
                      <td className="pr-3 sticky left-0 bg-card z-10 font-medium whitespace-nowrap">{reveal.display(stu.id, stu.name)}</td>
                      {standards.map((s) => {
                        const snap = latestByKey[`${stu.id}::${s.id}`];
                        const v = snap?.mastery_score ?? null;
                        return (
                          <td key={s.id} className="p-0">
                            <div
                              className="w-9 h-9 rounded-md flex items-center justify-center text-[10px] font-medium tabular-nums"
                              style={{
                                background: v == null ? "hsl(var(--mastery-bg))" : bandColor(Number(v)),
                                color: v == null ? "hsl(var(--muted-foreground))" : "white",
                              }}
                              title={v == null ? "No data" : `${reveal.display(stu.id, stu.name)} — ${s.code}\n${Math.round(Number(v) * 100)}% (${snap!.attempts} attempts)`}
                            >
                              {v == null ? "·" : Math.round(Number(v) * 100)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <Legend color="hsl(var(--mastery-low))" label="< 60%" />
                <Legend color="hsl(var(--mastery-mid))" label="60–79%" />
                <Legend color="hsl(var(--mastery-high))" label="≥ 80% (mastered)" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function bandColor(v: number) {
  if (v >= 0.8) return "hsl(var(--mastery-high))";
  if (v >= 0.6) return "hsl(var(--mastery-mid))";
  return "hsl(var(--mastery-low))";
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />{label}</span>;
}
