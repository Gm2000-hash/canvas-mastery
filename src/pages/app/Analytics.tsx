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

// ───────────────────────── Classes ─────────────────────────
function ClassesView() {
  const [rows, setRows] = useState<ClassRow[] | null>(null);
  useEffect(() => {
    supabase.rpc("analytics_class_breakdown").then(({ data }) => setRows((data as any) ?? []));
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle>Class breakdown</CardTitle><CardDescription>Per-course rollup of cohort mastery.</CardDescription></CardHeader>
      <CardContent>
        {rows === null ? <Skeleton className="h-40 w-full" /> :
         rows.length === 0 ? <EmptyState message="No courses imported yet." /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Course</TableHead><TableHead>Subject</TableHead><TableHead>Framework</TableHead>
              <TableHead className="text-right">Students</TableHead><TableHead className="text-right">Assessments</TableHead>
              <TableHead className="text-right">Avg mastery</TableHead><TableHead className="text-right">% mastered</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => {
                const fw = getFramework(r.framework);
                return (
                  <TableRow key={r.course_id}>
                    <TableCell className="font-medium">{r.course_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.subject ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" style={{ borderColor: FRAMEWORK_COLOR[r.framework ?? "STATE"], color: FRAMEWORK_COLOR[r.framework ?? "STATE"] }}>{fw.shortLabel}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{r.student_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.assessment_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.avg_mastery)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.pct_mastered)}</TableCell>
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

// ───────────────────────── Students ─────────────────────────
function StudentsView({ courseId }: { courseId: string | null }) {
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    setRows(null);
    supabase.rpc("analytics_student_breakdown", { _course_id: courseId }).then(({ data }) => setRows((data as any) ?? []));
  }, [courseId]);

  const visible = (rows ?? []).filter((r) => !filter || r.student_name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div><CardTitle>Student breakdown</CardTitle><CardDescription>How each student is progressing across all standards.</CardDescription></div>
          <Input placeholder="Search students…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? <Skeleton className="h-40 w-full" /> :
         visible.length === 0 ? <EmptyState message="No students match." /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead><TableHead>Course</TableHead>
              <TableHead className="text-right">Assessed</TableHead><TableHead className="text-right">Mastered</TableHead>
              <TableHead className="text-right">Avg mastery</TableHead><TableHead className="text-right">Last activity</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell className="font-medium">{r.student_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.course_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.standards_assessed}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.standards_mastered}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(r.avg_mastery)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                    {r.last_activity ? new Date(r.last_activity).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
