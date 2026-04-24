import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer, Legend } from "recharts";
import { BarChart3, TrendingUp, Users, GraduationCap, BookMarked, ListChecks, Layers, HelpCircle } from "lucide-react";
import { getFramework, FRAMEWORKS } from "@/lib/frameworks";
import { Link } from "react-router-dom";

type Course = { id: string; name: string };
type Trend = { bucket_label: string; bucket_ts: string | null; framework: string; subject: string; avg_mastery: number; sample_size: number };
type ClassRow = { course_id: string; course_name: string; subject: string | null; framework: string | null; student_count: number; assessment_count: number; avg_mastery: number | null; pct_mastered: number | null };
type StudentRow = { student_id: string; student_name: string; course_id: string; course_name: string; standards_assessed: number; standards_mastered: number; avg_mastery: number | null; last_activity: string | null };
type StandardRow = { standard_id: string; code: string; description: string; subject: string; grade: string; framework: string; students_assessed: number; students_mastered: number; avg_mastery: number | null; pct_mastered: number | null };
type AssignmentRow = { assignment_id: string; name: string; course_id: string; course_name: string; kind: string; due_at: string | null; points_possible: number | null; submission_count: number; avg_percentage: number | null; standards_tagged: number };
type DistRow = { bucket: string; bucket_min: number; bucket_max: number; count: number };
type QuestionRow = { question_id: string; assignment_id: string; assignment_name: string; question_position: number | null; question_text: string | null; points_possible: number | null; responses: number; correct_count: number; pct_correct: number | null; avg_points: number | null; standards_tagged: number };
type ActiveDim = { subject: string; framework: string; standard_count: number };

const FRAMEWORK_COLOR: Record<string, string> = {
  STATE: "hsl(38 92% 50%)",     // amber
  NGSS: "hsl(160 84% 39%)",     // emerald
  CCSS_MATH: "hsl(217 91% 60%)",
  CCSS_ELA: "hsl(262 83% 58%)",
  C3_SS: "hsl(346 84% 54%)",
  AP: "hsl(239 84% 67%)",
  IB: "hsl(173 80% 40%)",
  CUSTOM: "hsl(0 0% 60%)",
};

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(0)}%`;
}
function pctRaw(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(0)}%`;
}

export default function Analytics() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("ALL");
  const [activeDims, setActiveDims] = useState<ActiveDim[]>([]);

  useEffect(() => {
    supabase.from("courses").select("id, name").order("name").then(({ data }) => setCourses(data ?? []));
    supabase.rpc("analytics_active_dimensions").then(({ data }) => setActiveDims((data as any) ?? []));
  }, []);

  const courseFilter = courseId === "ALL" ? null : courseId;
  const subjects = useMemo(() => Array.from(new Set(activeDims.map((d) => d.subject).filter(Boolean))), [activeDims]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-semibold mb-2">Analytics</h1>
          <p className="text-muted-foreground">
            Mastery trends and breakdowns by class, student, standard, assessment, mastery level, and question.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-[260px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All courses</SelectItem>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs defaultValue="classes" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="classes"><GraduationCap className="h-4 w-4 mr-1.5" /> Classes</TabsTrigger>
          <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 mr-1.5" /> Mastery by subject</TabsTrigger>
          <TabsTrigger value="standards"><BookMarked className="h-4 w-4 mr-1.5" /> Standards</TabsTrigger>
          <TabsTrigger value="assignments"><ListChecks className="h-4 w-4 mr-1.5" /> Assessments</TabsTrigger>
          <TabsTrigger value="levels"><Layers className="h-4 w-4 mr-1.5" /> Mastery levels</TabsTrigger>
          <TabsTrigger value="questions"><HelpCircle className="h-4 w-4 mr-1.5" /> Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="classes"><ClassesView courseFilter={courseFilter} /></TabsContent>
        <TabsContent value="trends"><TrendsView courseId={courseFilter} subjects={subjects} /></TabsContent>
        <TabsContent value="standards"><StandardsView courseId={courseFilter} subjects={subjects} /></TabsContent>
        <TabsContent value="assignments"><AssignmentsView courseId={courseFilter} /></TabsContent>
        <TabsContent value="levels"><LevelsView courseId={courseFilter} subjects={subjects} /></TabsContent>
        <TabsContent value="questions"><QuestionsView courseId={courseFilter} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────────── Trends ─────────────────────────
// Mastery by subject, split by framework so state and national lines
// appear together for comparison.
function TrendsView({ courseId, subjects }: { courseId: string | null; subjects: string[] }) {
  const [granularity, setGranularity] = useState<"week" | "month" | "assignment">("week");
  const [subject, setSubject] = useState<string>("ALL");
  const [rows, setRows] = useState<Trend[] | null>(null);

  useEffect(() => {
    setRows(null);
    supabase.rpc("analytics_mastery_trends", {
      _course_id: courseId,
      _subject: subject === "ALL" ? null : subject,
      _granularity: granularity,
    }).then(({ data }) => setRows((data as any) ?? []));
  }, [courseId, subject, granularity]);

  // Pivot rows into chart-ready shape: one row per bucket, one numeric
  // column per (framework | subject) series so recharts can render lines.
  const { chartData, seriesKeys } = useMemo(() => {
    if (!rows) return { chartData: [], seriesKeys: [] as { key: string; framework: string; subject: string }[] };
    const buckets = new Map<string, any>();
    const keys = new Map<string, { framework: string; subject: string }>();
    rows.forEach((r) => {
      const key = subject === "ALL" ? `${r.framework} · ${r.subject}` : r.framework;
      keys.set(key, { framework: r.framework, subject: r.subject });
      const b = buckets.get(r.bucket_label) ?? { bucket: r.bucket_label, _ts: r.bucket_ts };
      b[key] = Math.round((Number(r.avg_mastery) || 0) * 100);
      buckets.set(r.bucket_label, b);
    });
    const chartData = Array.from(buckets.values()).sort((a, b) => (a._ts || "").localeCompare(b._ts || ""));
    return { chartData, seriesKeys: Array.from(keys.entries()).map(([key, v]) => ({ key, ...v })) };
  }, [rows, subject]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Mastery by subject — state vs national</CardTitle>
            <CardDescription>Average mastery score over time, one line per framework so you can compare state and national side-by-side.</CardDescription>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All subjects</SelectItem>
                  {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Granularity</Label>
              <div className="flex rounded-md border overflow-hidden h-9">
                {(["week", "month", "assignment"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGranularity(g)}
                    className={`px-3 text-xs font-medium transition ${granularity === g ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  >
                    {g === "week" ? "Weekly" : g === "month" ? "Monthly" : "Per assessment"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <Skeleton className="h-72 w-full" />
        ) : chartData.length === 0 ? (
          <EmptyState message="No mastery data yet for this scope. Confirm tagged assignments on Tag Review and recompute mastery." />
        ) : (
          <ChartContainer
            config={Object.fromEntries(seriesKeys.map((k) => [k.key, { label: k.key, color: FRAMEWORK_COLOR[k.framework] || "hsl(var(--primary))" }]))}
            className="h-80 w-full"
          >
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {seriesKeys.map((k) => (
                <Line
                  key={k.key}
                  type="monotone"
                  dataKey={k.key}
                  stroke={FRAMEWORK_COLOR[k.framework] || "hsl(var(--primary))"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
        {rows && rows.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {Array.from(new Set(rows.map((r) => r.framework))).map((fw) => {
              const meta = getFramework(fw);
              return (
                <Badge key={fw} variant="outline" style={{ borderColor: FRAMEWORK_COLOR[fw], color: FRAMEWORK_COLOR[fw] }}>
                  {meta.shortLabel} · {meta.national ? "National" : "State"}
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Classes (with drill-in matrix) ─────────────────────────
function ClassesView({ courseFilter }: { courseFilter: string | null }) {
  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [selected, setSelected] = useState<ClassRow | null>(null);

  useEffect(() => {
    supabase.rpc("analytics_class_breakdown").then(({ data }) => setRows((data as any) ?? []));
  }, []);

  // Honor the global course filter: if the teacher narrowed at the top,
  // pre-select that class (still gives them the back arrow to return).
  useEffect(() => {
    if (!courseFilter || !rows) return;
    const match = rows.find((r) => r.course_id === courseFilter);
    if (match) setSelected(match);
  }, [courseFilter, rows]);

  if (selected) {
    return (
      <ClassMatrixView
        course={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active classes</CardTitle>
        <CardDescription>Click a class to see every student plotted against the standards covered in that course.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows === null ? <Skeleton className="h-40 w-full" /> :
         rows.length === 0 ? <EmptyState message="No courses imported yet." /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Course</TableHead><TableHead>Subject</TableHead><TableHead>Framework</TableHead>
              <TableHead className="text-right">Students</TableHead><TableHead className="text-right">Assessments</TableHead>
              <TableHead className="text-right">Avg mastery</TableHead><TableHead className="text-right">% mastered</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => {
                const fw = getFramework(r.framework);
                return (
                  <TableRow
                    key={r.course_id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">{r.course_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.subject ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" style={{ borderColor: FRAMEWORK_COLOR[r.framework ?? "STATE"], color: FRAMEWORK_COLOR[r.framework ?? "STATE"] }}>{fw.shortLabel}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{r.student_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.assessment_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.avg_mastery)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.pct_mastered)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
                        View students <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Per-course matrix: students × standards
type MatrixRow = {
  student_id: string;
  student_name: string;
  student_sortable: string | null;
  standard_id: string;
  code: string;
  parent_code: string;
  description: string;
  subject: string;
  grade: string;
  framework: string;
  mastery_score: number | null;
  mastered: boolean | null;
  attempts: number | null;
  computed_at: string | null;
};

function masteryColor(score: number | null | undefined): string {
  if (score == null) return "bg-muted/40 text-muted-foreground";
  const p = score * 100;
  if (p >= 80) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (p >= 60) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-red-500/15 text-red-700 dark:text-red-300";
}

function ClassMatrixView({ course, onBack }: { course: ClassRow; onBack: () => void }) {
  const [data, setData] = useState<MatrixRow[] | null>(null);
  const [grouping, setGrouping] = useState<"sub" | "parent">("sub");
  const [studentFilter, setStudentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"code" | "weak" | "strong">("code");

  useEffect(() => {
    setData(null);
    supabase.rpc("analytics_class_matrix", { _course_id: course.course_id })
      .then(({ data }) => setData((data as any) ?? []));
  }, [course.course_id]);

  // Distinct students and standards out of the long-form rows.
  const { students, standards, valueByPair, subjects, frameworks } = useMemo(() => {
    const studentMap = new Map<string, { id: string; name: string; sortable: string | null }>();
    const stdMap = new Map<string, { id: string; code: string; parent_code: string; description: string; subject: string; framework: string }>();
    const valueMap = new Map<string, MatrixRow>();
    const subjs = new Set<string>();
    const fws = new Set<string>();
    (data ?? []).forEach((r) => {
      studentMap.set(r.student_id, { id: r.student_id, name: r.student_name, sortable: r.student_sortable });
      stdMap.set(r.standard_id, {
        id: r.standard_id, code: r.code, parent_code: r.parent_code,
        description: r.description, subject: r.subject, framework: r.framework,
      });
      valueMap.set(`${r.student_id}|${r.standard_id}`, r);
      if (r.subject) subjs.add(r.subject);
      if (r.framework) fws.add(r.framework);
    });
    return {
      students: Array.from(studentMap.values()).sort((a, b) =>
        (a.sortable ?? a.name).localeCompare(b.sortable ?? b.name)),
      standards: Array.from(stdMap.values()),
      valueByPair: valueMap,
      subjects: Array.from(subjs).sort(),
      frameworks: Array.from(fws).sort(),
    };
  }, [data]);

  // Apply subject/framework filters to the standard list.
  const filteredStandards = useMemo(() => {
    return standards.filter((s) => {
      if (subjectFilter !== "ALL" && s.subject !== subjectFilter) return false;
      if (frameworkFilter !== "ALL" && s.framework !== frameworkFilter) return false;
      return true;
    });
  }, [standards, subjectFilter, frameworkFilter]);

  // Build the columns. In "parent" mode, group substandards by their parent
  // code and store the underlying substandard ids for averaging in cells.
  type Column = { key: string; label: string; childCount: number; standardIds: string[]; subject: string; framework: string; description?: string };
  const columns = useMemo<Column[]>(() => {
    if (grouping === "sub") {
      return filteredStandards.map((s) => ({
        key: s.id, label: s.code, childCount: 1, standardIds: [s.id],
        subject: s.subject, framework: s.framework, description: s.description,
      }));
    }
    const groups = new Map<string, Column>();
    filteredStandards.forEach((s) => {
      const existing = groups.get(s.parent_code);
      if (existing) {
        existing.childCount += 1;
        existing.standardIds.push(s.id);
      } else {
        groups.set(s.parent_code, {
          key: s.parent_code, label: s.parent_code, childCount: 1,
          standardIds: [s.id], subject: s.subject, framework: s.framework,
        });
      }
    });
    return Array.from(groups.values());
  }, [filteredStandards, grouping]);

  // Compute the score a given student has on a given column (averaging
  // substandard scores when grouping is enabled), ignoring nulls.
  function cellValue(studentId: string, col: Column): { score: number | null; covered: number; total: number; attempts: number; lastAt: string | null } {
    let sum = 0, n = 0, attempts = 0, lastAt: string | null = null;
    for (const sid of col.standardIds) {
      const v = valueByPair.get(`${studentId}|${sid}`);
      if (v?.mastery_score != null) {
        sum += Number(v.mastery_score);
        n += 1;
        attempts += v.attempts ?? 0;
        if (v.computed_at && (!lastAt || v.computed_at > lastAt)) lastAt = v.computed_at;
      }
    }
    return { score: n ? sum / n : null, covered: n, total: col.standardIds.length, attempts, lastAt };
  }

  // Sort columns based on weakest/strongest using class-wide averages.
  const sortedColumns = useMemo(() => {
    if (sortBy === "code") return [...columns].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    const colAvg = (col: Column) => {
      let sum = 0, n = 0;
      students.forEach((st) => {
        const v = cellValue(st.id, col);
        if (v.score != null) { sum += v.score; n += 1; }
      });
      return n ? sum / n : null;
    };
    return [...columns].sort((a, b) => {
      const av = colAvg(a), bv = colAvg(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortBy === "weak" ? av - bv : bv - av;
    });
  }, [columns, sortBy, students, valueByPair]);

  const visibleStudents = students.filter((s) =>
    !studentFilter || s.name.toLowerCase().includes(studentFilter.toLowerCase()));

  // CSV export of exactly what's on screen.
  function exportCsv() {
    const header = ["Student", ...sortedColumns.map((c) => c.label), "Avg"];
    const lines = [header.join(",")];
    visibleStudents.forEach((st) => {
      const cells = sortedColumns.map((c) => {
        const v = cellValue(st.id, c);
        return v.score != null ? (v.score * 100).toFixed(0) : "";
      });
      const studentVals = sortedColumns.map((c) => cellValue(st.id, c).score).filter((s): s is number => s != null);
      const avg = studentVals.length ? (studentVals.reduce((a, b) => a + b, 0) / studentVals.length * 100).toFixed(0) : "";
      lines.push([JSON.stringify(st.name), ...cells, avg].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course.course_name.replace(/\W+/g, "_")}_mastery_matrix.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2 h-7">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to classes
            </Button>
            <CardTitle>{course.course_name}</CardTitle>
            <CardDescription>
              Mastery for every active student against the standards covered in this course.
              Toggle below to view individual <strong>substandards</strong> or roll them up into <strong>standards</strong>.
            </CardDescription>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <Input placeholder="Search students…" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="max-w-[180px]" />
            {subjects.length > 1 && (
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All subjects</SelectItem>
                  {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {frameworks.length > 1 && (
              <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All frameworks</SelectItem>
                  {frameworks.map((f) => <SelectItem key={f} value={f}>{getFramework(f).shortLabel}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="code">Sort by code</SelectItem>
                <SelectItem value="weak">Weakest first</SelectItem>
                <SelectItem value="strong">Strongest first</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          </div>
        </div>
        <div className="flex rounded-md border overflow-hidden h-9 w-fit mt-3">
          {(["sub", "parent"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrouping(g)}
              className={`px-3 text-xs font-medium transition ${grouping === g ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {g === "sub" ? "Substandards" : "Standards (rolled up)"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {data === null ? <Skeleton className="h-60 w-full" /> :
         visibleStudents.length === 0 ? <EmptyState message="No students match this filter." /> :
         sortedColumns.length === 0 ? <EmptyState message="This course has no confirmed standards yet. Tag assessments on Tag Review first." /> : (
          <div className="overflow-auto border rounded-lg max-h-[70vh]">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th className="sticky left-0 z-20 bg-card border-b border-r p-2 text-left font-medium min-w-[180px]">Student</th>
                  {sortedColumns.map((c) => (
                    <th key={c.key} className="border-b border-r p-2 font-mono font-normal text-[10px] whitespace-nowrap"
                        title={c.description ? `${c.label} — ${c.description}` : c.label}>
                      <div>{c.label}</div>
                      {grouping === "parent" && <div className="text-[9px] text-muted-foreground font-sans">n={c.childCount}</div>}
                    </th>
                  ))}
                  <th className="border-b p-2 font-medium text-right whitespace-nowrap">Avg</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((st) => {
                  const studentScores: number[] = [];
                  const cells = sortedColumns.map((c) => {
                    const v = cellValue(st.id, c);
                    if (v.score != null) studentScores.push(v.score);
                    return { col: c, v };
                  });
                  const studentAvg = studentScores.length ? studentScores.reduce((a, b) => a + b, 0) / studentScores.length : null;
                  return (
                    <tr key={st.id} className="hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card border-b border-r p-2 font-medium whitespace-nowrap">{st.name}</td>
                      {cells.map(({ col, v }) => (
                        <td key={col.key} className={`border-b border-r p-2 text-center tabular-nums ${masteryColor(v.score)}`}
                            title={v.score == null
                              ? `${col.label}: no evidence yet`
                              : `${col.label}: ${(v.score * 100).toFixed(0)}% • ${v.attempts} attempt(s)${v.lastAt ? ` • last ${new Date(v.lastAt).toLocaleDateString()}` : ""}${grouping === "parent" ? ` • ${v.covered}/${v.total} substandards` : ""}`}>
                          {v.score == null ? "—" : `${(v.score * 100).toFixed(0)}`}
                        </td>
                      ))}
                      <td className={`border-b p-2 text-right tabular-nums font-medium ${masteryColor(studentAvg)}`}>
                        {studentAvg == null ? "—" : `${(studentAvg * 100).toFixed(0)}`}
                      </td>
                    </tr>
                  );
                })}
                {/* Class-average footer per column */}
                <tr className="bg-muted/30 font-medium">
                  <td className="sticky left-0 z-10 bg-muted/40 border-r p-2">Class avg</td>
                  {sortedColumns.map((c) => {
                    let sum = 0, n = 0;
                    visibleStudents.forEach((st) => {
                      const v = cellValue(st.id, c);
                      if (v.score != null) { sum += v.score; n += 1; }
                    });
                    const avg = n ? sum / n : null;
                    return (
                      <td key={c.key} className={`border-r p-2 text-center tabular-nums ${masteryColor(avg)}`}>
                        {avg == null ? "—" : `${(avg * 100).toFixed(0)}`}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/30" /> ≥ 80%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-500/15 border border-amber-500/30" /> 60–79%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-red-500/15 border border-red-500/30" /> &lt; 60%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-muted/60" /> No evidence yet</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Standards ─────────────────────────
function StandardsView({ courseId, subjects }: { courseId: string | null; subjects: string[] }) {
  const [subject, setSubject] = useState<string>("ALL");
  const [framework, setFramework] = useState<string>("ALL");
  const [rows, setRows] = useState<StandardRow[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setRows(null);
    supabase.rpc("analytics_standard_breakdown", {
      _course_id: courseId,
      _subject: subject === "ALL" ? null : subject,
      _framework: framework === "ALL" ? null : framework,
    }).then(({ data }) => setRows((data as any) ?? []));
  }, [courseId, subject, framework]);

  const visible = (rows ?? []).filter((r) => !filter || r.code.toLowerCase().includes(filter.toLowerCase()) || r.description.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div><CardTitle>Standards heatmap</CardTitle><CardDescription>Cohort performance per standard. Sorted by weakest first.</CardDescription></div>
          <div className="flex items-end gap-2 flex-wrap">
            <Input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-[200px]" />
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All subjects</SelectItem>
                {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={framework} onValueChange={setFramework}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All frameworks</SelectItem>
                {FRAMEWORKS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? <Skeleton className="h-40 w-full" /> :
         visible.length === 0 ? <EmptyState message="No standards in scope have evidence yet." /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Description</TableHead>
              <TableHead>Framework</TableHead>
              <TableHead className="text-right">Assessed</TableHead><TableHead className="text-right">Mastered</TableHead>
              <TableHead className="text-right">Avg</TableHead><TableHead className="w-32">% mastered</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {visible.map((r) => {
                const fw = getFramework(r.framework);
                const p = (r.pct_mastered ?? 0) * 100;
                return (
                  <TableRow key={r.standard_id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{r.code}</TableCell>
                    <TableCell className="text-sm max-w-md truncate" title={r.description}>{r.description}</TableCell>
                    <TableCell><Badge variant="outline" style={{ borderColor: FRAMEWORK_COLOR[r.framework], color: FRAMEWORK_COLOR[r.framework] }}>{fw.shortLabel}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{r.students_assessed}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.students_mastered}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.avg_mastery)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: `${p}%`, background: p >= 80 ? "hsl(var(--primary))" : p >= 60 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)" }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-10 text-right">{p.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Assignments ─────────────────────────
function AssignmentsView({ courseId }: { courseId: string | null }) {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  useEffect(() => {
    setRows(null);
    supabase.rpc("analytics_assignment_breakdown", { _course_id: courseId }).then(({ data }) => setRows((data as any) ?? []));
  }, [courseId]);
  return (
    <Card>
      <CardHeader><CardTitle>Assessment breakdown</CardTitle><CardDescription>Performance per assignment with submission counts and tagged standards.</CardDescription></CardHeader>
      <CardContent>
        {rows === null ? <Skeleton className="h-40 w-full" /> :
         rows.length === 0 ? <EmptyState message="No assessments yet for this course." /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Assessment</TableHead><TableHead>Course</TableHead><TableHead>Type</TableHead>
              <TableHead>Due</TableHead><TableHead className="text-right">Submissions</TableHead>
              <TableHead className="text-right">Avg %</TableHead><TableHead className="text-right">Standards</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.assignment_id}>
                  <TableCell className="font-medium max-w-sm truncate" title={r.name}>{r.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.course_name}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{r.kind}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.due_at ? new Date(r.due_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.submission_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{pctRaw(r.avg_percentage)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.standards_tagged}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Mastery levels ─────────────────────────
function LevelsView({ courseId, subjects }: { courseId: string | null; subjects: string[] }) {
  const [subject, setSubject] = useState<string>("ALL");
  const [rows, setRows] = useState<DistRow[] | null>(null);
  useEffect(() => {
    setRows(null);
    supabase.rpc("analytics_mastery_distribution", {
      _course_id: courseId, _subject: subject === "ALL" ? null : subject,
    }).then(({ data }) => setRows((data as any) ?? []));
  }, [courseId, subject]);
  const total = (rows ?? []).reduce((a, r) => a + r.count, 0);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div><CardTitle>Mastery level distribution</CardTitle><CardDescription>How many mastery snapshots fall into each band.</CardDescription></div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? <Skeleton className="h-60 w-full" /> :
         total === 0 ? <EmptyState message="No mastery snapshots yet." /> : (
          <ChartContainer config={{ count: { label: "Snapshots", color: "hsl(var(--primary))" } }} className="h-72 w-full">
            <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Questions ─────────────────────────
function QuestionsView({ courseId }: { courseId: string | null }) {
  const [rows, setRows] = useState<QuestionRow[] | null>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    setRows(null);
    supabase.rpc("analytics_question_breakdown", { _course_id: courseId, _assignment_id: null })
      .then(({ data }) => setRows((data as any) ?? []));
  }, [courseId]);
  const visible = (rows ?? []).filter((r) =>
    !filter || (r.question_text ?? "").toLowerCase().includes(filter.toLowerCase()) || r.assignment_name.toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div><CardTitle>Question difficulty</CardTitle><CardDescription>Per-question accuracy across all submissions.</CardDescription></div>
          <Input placeholder="Search questions or assessments…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? <Skeleton className="h-40 w-full" /> :
         visible.length === 0 ? <EmptyState message="No quiz questions imported yet. Sync your Canvas quizzes from Courses." /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-10">#</TableHead><TableHead>Question</TableHead><TableHead>Assessment</TableHead>
              <TableHead className="text-right">Responses</TableHead><TableHead className="text-right">% correct</TableHead>
              <TableHead className="text-right">Avg pts</TableHead><TableHead className="text-right">Standards</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {visible.map((r) => {
                const p = (r.pct_correct ?? 0) * 100;
                const tone = p >= 75 ? "text-emerald-600" : p >= 50 ? "text-amber-600" : "text-red-600";
                return (
                  <TableRow key={r.question_id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{r.question_position ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-md truncate" title={r.question_text ?? ""}>{r.question_text || <span className="text-muted-foreground italic">(no text)</span>}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate" title={r.assignment_name}>{r.assignment_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.responses}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${tone}`}>{r.responses ? `${p.toFixed(0)}%` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.avg_points ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.standards_tagged}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-muted-foreground">
      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-60" />
      <p className="text-sm">{message}</p>
      <p className="text-xs mt-2">
        Need to set things up? Visit <Link to="/app/courses" className="underline">Courses</Link>, <Link to="/app/review" className="underline">Tag Review</Link>, or <Link to="/app/mastery" className="underline">Mastery</Link>.
      </p>
    </div>
  );
}
