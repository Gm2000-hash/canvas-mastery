// Department landing page — subject cards + aggregate analytics view
// (mastery over time, by standard, and class comparison) honoring
// subject / school-year / grade filters. Per-subject deep dives live at
// /app/department/:subject.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Beaker, BookOpen, Calculator, Globe2, Atom, ArrowRight, Info, Plus, Loader2, LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { currentSchoolYearLabel, recentSchoolYears } from "@/lib/schoolYear";
import { GRADES } from "@/lib/frameworks";
import { toast } from "sonner";

type SubjectRow = {
  subject: string;
  grades: string[] | null;
  teacher_count: number;
  class_count: number;
  student_count: number;
};

type Overview = {
  teacher_count: number;
  class_count: number;
  student_count: number;
  avg_mastery: number | null;
  pct_mastered: number | null;
  distribution: { label: string; lo: number; hi: number; count: number }[];
  trend: { label: string; ts: string; avg: number; n: number }[];
};
type StandardRow = { standard_id: string; code: string; description: string; grade: string; framework: string; students_assessed: number; students_mastered: number; avg_mastery: number | null; pct_mastered: number | null };
type ClassRow = { course_id: string; is_own: boolean; display_label: string; grade: string | null; student_count: number; avg_mastery: number | null; pct_mastered: number | null };

const ICONS: Record<string, any> = {
  Science: Beaker,
  "Social Studies": Globe2,
  Math: Calculator,
  ELA: BookOpen,
};
const FEATURED = ["Science", "Social Studies", "Math", "ELA"];

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

export default function Department() {
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // Filters
  const [schoolYear, setSchoolYear] = useState<string>(currentSchoolYearLabel());
  const [subject, setSubject] = useState<string>(""); // "" = none yet; auto-set after load
  const [grades, setGrades] = useState<string[]>([]); // empty = all my grades

  // Analytics data
  const [overview, setOverview] = useState<Overview | null>(null);
  const [standards, setStandards] = useState<StandardRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [joiningSubject, setJoiningSubject] = useState<string | null>(null);
  const [leavingSubject, setLeavingSubject] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);

  async function leaveDepartment(s: string) {
    setLeavingSubject(s);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Please sign in"); return; }
      const { error } = await supabase
        .from("teacher_disciplines")
        .delete()
        .eq("teacher_id", u.user.id)
        .eq("subject", s);
      if (error) { toast.error(error.message); return; }
      // Clear default subject if it matches
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_subject")
        .eq("id", u.user.id)
        .maybeSingle();
      if (profile?.default_subject === s) {
        await supabase.from("profiles").update({ default_subject: null }).eq("id", u.user.id);
      }
      toast.success(`Left ${s} department`);
      if (subject === s) setSubject("");
      await reloadSubjects();
    } finally {
      setLeavingSubject(null);
      setConfirmLeave(null);
    }
  }

  async function reloadSubjects(autoSelect: string | null = null) {
    setLoadingSubjects(true);
    const { data } = await supabase.rpc("department_subjects", { _school_year: schoolYear });
    const list = (data as SubjectRow[]) ?? [];
    setRows(list);
    setLoadingSubjects(false);
    if (autoSelect && list.some((r) => r.subject === autoSelect)) {
      setSubject(autoSelect);
    }
  }

  async function joinDepartment(s: string) {
    setJoiningSubject(s);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Please sign in"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("state, default_grade")
        .eq("id", u.user.id)
        .maybeSingle();
      const grade = profile?.default_grade?.trim() || "";
      const state = profile?.state?.trim() || "";
      if (!grade) {
        toast.error("Set a default grade in Settings first, then try again.");
        return;
      }
      const { data: existing } = await supabase
        .from("teacher_disciplines")
        .select("id")
        .eq("teacher_id", u.user.id)
        .eq("subject", s)
        .eq("grade", grade)
        .eq("state", state)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase.from("teacher_disciplines").insert({
          teacher_id: u.user.id,
          subject: s,
          grade,
          state,
          framework: "CUSTOM",
          is_default: false,
        });
        if (error) { toast.error(error.message); return; }
      }
      // Persist as default subject so it carries across the app
      await supabase.from("profiles").upsert({ id: u.user.id, default_subject: s });
      toast.success(`Joined ${s} department`);
      await reloadSubjects(s);
    } finally {
      setJoiningSubject(null);
    }
  }

  // Load subject participation
  useEffect(() => {
    (async () => {
      setLoadingSubjects(true);
      const { data } = await supabase.rpc("department_subjects", { _school_year: schoolYear });
      const list = (data as SubjectRow[]) ?? [];
      setRows(list);
      setLoadingSubjects(false);
      // Auto-pick first available subject if none selected or selection invalid
      if (list.length && !list.some((r) => r.subject === subject)) {
        const featured = FEATURED.find((s) => list.some((r) => r.subject === s));
        setSubject(featured ?? list[0].subject);
      } else if (!list.length) {
        setSubject("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolYear]);

  const byKey = useMemo(() => new Map(rows.map((r) => [r.subject, r])), [rows]);
  const myGrades = useMemo(() => byKey.get(subject)?.grades ?? [], [byKey, subject]);

  // Load analytics for the selected subject + filters
  useEffect(() => {
    if (!subject) {
      setOverview(null); setStandards([]); setClasses([]);
      return;
    }
    setLoadingAnalytics(true);
    const _grades = grades.length ? grades : null;
    Promise.all([
      supabase.rpc("department_overview",  { _subject: subject, _grades, _school_year: schoolYear }),
      supabase.rpc("department_standards", { _subject: subject, _grades, _school_year: schoolYear }),
      supabase.rpc("department_classes",   { _subject: subject, _grades, _school_year: schoolYear }),
    ]).then(([ov, std, cls]) => {
      setOverview(((ov.data as any[]) ?? [])[0] ?? null);
      setStandards((std.data as StandardRow[]) ?? []);
      setClasses((cls.data as ClassRow[]) ?? []);
      setLoadingAnalytics(false);
    });
  }, [subject, schoolYear, grades]);

  // --- Chart-friendly slices ---
  const trendData = useMemo(
    () => (overview?.trend ?? []).map((t) => ({ ...t, avg: Number(t.avg) })),
    [overview]
  );
  const standardsChart = useMemo(() => {
    return [...standards]
      .filter((s) => s.avg_mastery != null)
      .sort((a, b) => (a.avg_mastery ?? 0) - (b.avg_mastery ?? 0))
      .slice(0, 12) // worst 12 — the ones to focus on
      .map((s) => ({
        code: s.code,
        avg: Number(s.avg_mastery ?? 0),
        pct_mastered: Number(s.pct_mastered ?? 0),
        description: s.description,
      }));
  }, [standards]);
  const classesChart = useMemo(() => {
    return [...classes]
      .filter((c) => c.avg_mastery != null)
      .sort((a, b) => (b.avg_mastery ?? 0) - (a.avg_mastery ?? 0))
      .map((c) => ({
        label: c.display_label,
        avg: Number(c.avg_mastery ?? 0),
        is_own: c.is_own,
      }));
  }, [classes]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Department</h1>
        <p className="text-muted-foreground mt-1">
          Collective analytics across every teacher who shares your subject and grade.
          Real names show only for your own students; peers' data is anonymized.
        </p>
      </header>

      {/* Subject cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURED.map((s) => {
          const r = byKey.get(s);
          const Icon = ICONS[s] ?? Atom;
          const enabled = !!r;
          const active = subject === s;
          const joining = joiningSubject === s;
          return (
            <div
              key={s}
              role={enabled ? "button" : undefined}
              tabIndex={enabled ? 0 : -1}
              onClick={() => enabled && setSubject(s)}
              onKeyDown={(e) => { if (enabled && (e.key === "Enter" || e.key === " ")) setSubject(s); }}
              className={`text-left rounded-xl border p-4 transition-all ${
                active ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                       : enabled ? "hover:border-primary/50 hover:shadow-soft cursor-pointer"
                                 : "bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 text-primary p-2.5"><Icon className="h-5 w-5" /></div>
                <div className="font-display text-lg">{s}</div>
              </div>
              {loadingSubjects ? (
                <Skeleton className="h-12 w-full mt-3" />
              ) : enabled ? (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <Stat n={r!.teacher_count} l="Teachers" />
                    <Stat n={r!.class_count} l="Classes" />
                    <Stat n={r!.student_count} l="Students" />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full rounded-full mt-3 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setConfirmLeave(s); }}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-1" /> Leave
                  </Button>
                </>

              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    You're not in this department yet.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-full"
                    disabled={joining}
                    onClick={(e) => { e.stopPropagation(); joinDepartment(s); }}
                  >
                    {joining
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Joining…</>
                      : <><Plus className="h-3.5 w-3.5 mr-1" /> Join {s}</>}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* "Other" subjects (if any) */}
      {rows.filter((r) => !FEATURED.includes(r.subject)).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Other:</span>
          {rows.filter((r) => !FEATURED.includes(r.subject)).map((r) => (
            <span
              key={r.subject}
              className={`inline-flex items-center text-xs rounded-full border ${subject === r.subject ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
            >
              <button
                onClick={() => setSubject(r.subject)}
                className={`px-3 py-1 rounded-l-full ${subject === r.subject ? "" : "hover:bg-muted"}`}
              >
                {r.subject}
              </button>
              <button
                onClick={() => setConfirmLeave(r.subject)}
                title={`Leave ${r.subject}`}
                aria-label={`Leave ${r.subject}`}
                className={`px-2 py-1 rounded-r-full border-l ${subject === r.subject ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "border-border hover:bg-destructive/10 hover:text-destructive"}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 pt-2 border-t">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">School year</label>
          <Select value={schoolYear} onValueChange={setSchoolYear}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {recentSchoolYears(4).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground block mb-1">
            Grades {grades.length === 0 && <span className="opacity-60">(all of your grades)</span>}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(myGrades.length ? myGrades : GRADES).map((g) => {
              const active = grades.includes(g);
              return (
                <button
                  key={g}
                  onClick={() => setGrades((cur) => active ? cur.filter((x) => x !== g) : [...cur, g])}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                >
                  {g}
                </button>
              );
            })}
            {grades.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGrades([])}>Clear</Button>
            )}
          </div>
        </div>
        {subject && (
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to={`/app/department/${encodeURIComponent(subject)}`}>
              Open {subject} dashboard <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      {/* Analytics view */}
      {!subject ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          Pick a subject above to see department analytics.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Kpi label="Teachers" value={overview?.teacher_count ?? "—"} loading={loadingAnalytics} />
            <Kpi label="Classes" value={overview?.class_count ?? "—"} loading={loadingAnalytics} />
            <Kpi label="Students" value={overview?.student_count ?? "—"} loading={loadingAnalytics} />
            <Kpi label="Avg mastery" value={pct(overview?.avg_mastery)} loading={loadingAnalytics} />
            <Kpi label="% mastered" value={pct(overview?.pct_mastered)} loading={loadingAnalytics} />
          </div>

          {/* Mastery over time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mastery over time</CardTitle>
              <CardDescription>Weekly average mastery score across the {subject} department</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAnalytics ? <Skeleton className="h-[260px] w-full" /> : trendData.length === 0 ? (
                <Empty>No mastery data yet for the selected filters.</Empty>
              ) : (
                <ChartContainer config={{ avg: { label: "Avg mastery", color: "hsl(var(--primary))" } }} className="h-[260px]">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* By standard */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mastery by standard</CardTitle>
                <CardDescription>Lowest 12 standards by average mastery — focus areas</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAnalytics ? <Skeleton className="h-[300px] w-full" /> : standardsChart.length === 0 ? (
                  <Empty>No standards have been assessed yet.</Empty>
                ) : (
                  <ChartContainer config={{ avg: { label: "Avg mastery", color: "hsl(var(--primary))" } }} className="h-[300px]">
                    <BarChart data={standardsChart} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                      <YAxis type="category" dataKey="code" width={90} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Class comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Class comparison</CardTitle>
                <CardDescription>
                  All classes in the department, ranked by average mastery.
                  Highlighted bars are yours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAnalytics ? <Skeleton className="h-[300px] w-full" /> : classesChart.length === 0 ? (
                  <Empty>No classes match the current filters.</Empty>
                ) : (
                  <ChartContainer config={{ avg: { label: "Avg mastery", color: "hsl(var(--primary))" } }} className="h-[300px]">
                    <BarChart data={classesChart} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                      <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                        {classesChart.map((row, i) => (
                          <Cell key={i} fill={row.is_own ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.55)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4 flex gap-3 items-start text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Class labels render as <code className="text-xs bg-background px-1 rounded">Class A</code>, <code className="text-xs bg-background px-1 rounded">Class B</code>… for peer teachers.
                Open the full <Link to={`/app/department/${encodeURIComponent(subject)}`} className="text-primary underline">{subject} dashboard</Link> for student-level details and CSV export.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-md bg-muted/40 py-1.5">
      <div className="text-base font-semibold tabular-nums leading-none">{n}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{l}</div>
    </div>
  );
}

function Kpi({ label, value, loading }: { label: string; value: any; loading: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        {loading
          ? <Skeleton className="h-7 w-16 mt-1" />
          : <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>}
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
