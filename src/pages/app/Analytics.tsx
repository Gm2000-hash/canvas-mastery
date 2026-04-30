import { forwardRef, useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, ArrowRight, BarChart3, BarChartHorizontal, TrendingUp, GraduationCap, BookMarked, ListChecks, Layers, HelpCircle, Download, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFramework, FRAMEWORKS } from "@/lib/frameworks";
import { Link, useParams } from "react-router-dom";
import { useRevealedNames } from "@/hooks/useRevealedNames";
import { RevealNamesToggle } from "@/components/RevealNamesToggle";
import { HistoricalToggle } from "@/components/HistoricalToggle";
import { recentSchoolYears, currentSchoolYearLabel } from "@/lib/schoolYear";
import { CourseMultiSelect } from "@/components/CourseMultiSelect";

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
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<ClassRow | null>(null);
  const [courseMissing, setCourseMissing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeDims, setActiveDims] = useState<ActiveDim[]>([]);
  const [schoolYear, setSchoolYear] = useState<string>(currentSchoolYearLabel());
  const [showHistorical, setShowHistorical] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    setCourse(null);
    setCourseMissing(false);
    // Load this course's summary stats so the header shows badges + stats.
    supabase.rpc("analytics_class_breakdown", {
      _school_year: schoolYear === "ALL" ? null : schoolYear,
      _include_archived: true,
    }).then(({ data }) => {
      const list = (data as any as ClassRow[]) ?? [];
      const found = list.find((r) => r.course_id === courseId) ?? null;
      if (found) {
        setCourse(found);
      } else {
        // Fallback: course exists but has no analytics rows yet.
        supabase.from("courses").select("id, name").eq("id", courseId).maybeSingle().then(({ data: c }) => {
          if (c) {
            setCourse({
              course_id: c.id, course_name: c.name,
              subject: null, framework: null,
              student_count: 0, assessment_count: 0,
              avg_mastery: null, pct_mastered: null,
            });
          } else {
            setCourseMissing(true);
          }
        });
      }
    });
  }, [courseId, schoolYear]);

  useEffect(() => {
    // Other classes are only needed by sub-views (e.g. Standards, Assessments
    // multi-class pickers). Load them once.
    supabase.from("courses").select("id, name, hidden, archived_at").order("name").then(({ data }) => {
      const all = (data ?? []) as Array<Course & { hidden: boolean; archived_at: string | null }>;
      const visible = all.filter((c) => !c.hidden && (showHistorical || !c.archived_at));
      setCourses(visible.map(({ id, name }) => ({ id, name })));
    });
    supabase.rpc("analytics_active_dimensions").then(({ data }) => setActiveDims((data as any) ?? []));
  }, [showHistorical]);

  const subjects = useMemo(() => Array.from(new Set(activeDims.map((d) => d.subject).filter(Boolean))), [activeDims]);
  const years = useMemo(() => recentSchoolYears(6), []);
  const courseFilter = courseId ?? null;

  if (courseMissing) {
    return (
      <div className="space-y-4">
        <Link to="/app/classes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> All classes
        </Link>
        <Card><CardContent className="py-12 text-center text-muted-foreground">Class not found.</CardContent></Card>
      </div>
    );
  }

  if (!course) {
    return <Skeleton className="h-40 w-full" />;
  }

  const fw = course.framework ? getFramework(course.framework) : null;

  return (
    <div className="space-y-6">
      <Link to="/app/classes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> All classes
      </Link>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2 flex items-center gap-3 flex-wrap">
            <span className="truncate">{course.course_name}</span>
            {course.subject && <Badge variant="outline">{course.subject}</Badge>}
            {fw && <Badge variant="outline" style={{ borderColor: FRAMEWORK_COLOR[course.framework ?? "STATE"], color: FRAMEWORK_COLOR[course.framework ?? "STATE"] }}>{fw.shortLabel}</Badge>}
          </h1>
          <p className="text-muted-foreground">
            {course.student_count} students · {course.assessment_count} assessments · avg {pct(course.avg_mastery)} · {pct(course.pct_mastered)} mastered
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">School year</Label>
            <Select value={schoolYear} onValueChange={setSchoolYear}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All time</SelectItem>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="pb-1">
            <HistoricalToggle value={showHistorical} onChange={setShowHistorical} reason="Analytics" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="students"><GraduationCap className="h-4 w-4 mr-1.5" /> Students</TabsTrigger>
          <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 mr-1.5" /> Mastery by subject</TabsTrigger>
          <TabsTrigger value="standards"><BookMarked className="h-4 w-4 mr-1.5" /> Standards</TabsTrigger>
          <TabsTrigger value="assignments"><ListChecks className="h-4 w-4 mr-1.5" /> Assessments</TabsTrigger>
          <TabsTrigger value="levels"><Layers className="h-4 w-4 mr-1.5" /> Mastery levels</TabsTrigger>
          <TabsTrigger value="questions"><HelpCircle className="h-4 w-4 mr-1.5" /> Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="students"><ClassMatrixView course={course} collapsed={false} /></TabsContent>
        <TabsContent value="trends"><TrendsView courseId={courseFilter} subjects={subjects} /></TabsContent>
        <TabsContent value="standards"><StandardsView courseId={courseFilter} subjects={subjects} courses={courses} /></TabsContent>
        <TabsContent value="assignments"><AssignmentsView courseId={courseFilter} courses={courses} /></TabsContent>
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

// ───────────────────────── Classes (summary + auto matrices) ─────────────────────────
function ClassesView({ courseFilter, hiddenCourseIds, archivedCourseIds, schoolYear, includeArchived }: { courseFilter: string | null; hiddenCourseIds: Set<string>; archivedCourseIds: Set<string>; schoolYear: string; includeArchived: boolean }) {
  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.rpc("analytics_class_breakdown", {
      _school_year: schoolYear === "ALL" ? null : schoolYear,
      _include_archived: includeArchived,
    }).then(({ data }) => {
      const list = (data as any as ClassRow[]) ?? [];
      // Drop hidden classes; drop archived too unless the historical toggle is on.
      const filtered = list.filter((r) =>
        !hiddenCourseIds.has(r.course_id) &&
        (includeArchived || !archivedCourseIds.has(r.course_id))
      );
      setRows(filtered);
      // Default to collapsed: hide every class table until the user opens it.
      setCollapsed(new Set(filtered.map((r) => r.course_id)));
    });
  }, [hiddenCourseIds, archivedCourseIds, schoolYear, includeArchived]);

  // Honor the global course filter at the top of the page.
  const visibleRows = useMemo(() => {
    if (!rows) return rows;
    if (!courseFilter) return rows;
    return rows.filter((r) => r.course_id === courseFilter);
  }, [rows, courseFilter]);

  function toggle(courseId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId); else next.add(courseId);
      return next;
    });
  }

  if (rows === null) return <Skeleton className="h-40 w-full" />;
  if (visibleRows && visibleRows.length === 0) {
    return (
      <Card><CardContent className="py-10"><EmptyState message="No courses match your filter yet." /></CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Active classes</CardTitle>
          <CardDescription>Each class shows its student-by-standard mastery table below. Use the chevron to collapse a class.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Course</TableHead><TableHead>Subject</TableHead><TableHead>Framework</TableHead>
              <TableHead className="text-right">Students</TableHead><TableHead className="text-right">Assessments</TableHead>
              <TableHead className="text-right">Avg mastery</TableHead><TableHead className="text-right">% mastered</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {visibleRows!.map((r) => {
                const fw = getFramework(r.framework);
                const isCollapsed = collapsed.has(r.course_id);
                return (
                  <TableRow
                    key={r.course_id}
                    onClick={() => {
                      const el = document.getElementById(`class-matrix-${r.course_id}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
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
                      <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); toggle(r.course_id); }}>
                        {isCollapsed ? "Show table" : "Hide table"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {visibleRows!.map((r) => (
        <div key={r.course_id} id={`class-matrix-${r.course_id}`}>
          <ClassMatrixView
            course={r}
            collapsed={collapsed.has(r.course_id)}
            onToggleCollapsed={() => toggle(r.course_id)}
          />
        </div>
      ))}
    </div>
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

function ClassMatrixView({ course, collapsed = false, onToggleCollapsed }: {
  course: ClassRow;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const [data, setData] = useState<MatrixRow[] | null>(null);
  const [studentFilter, setStudentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"code" | "weak" | "strong">("code");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  type RosterStudent = { id: string; name: string; sortable: string | null };
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  type PlaceholderStandard = { id: string; code: string; description: string; subject: string; framework: string };
  const [placeholderStandards, setPlaceholderStandards] = useState<PlaceholderStandard[] | null>(null);
  const reveal = useRevealedNames(course.course_id);

  useEffect(() => {
    if (collapsed) return;
    if (data === null) {
      supabase.rpc("analytics_class_matrix", { _course_id: course.course_id })
        .then(({ data }) => setData((data as any) ?? []));
    }
    if (roster === null) {
      // Fetch the roster directly so students render even before any
      // standards have been tagged for this course (the RPC's CROSS JOIN
      // would otherwise produce zero rows and hide everyone).
      supabase.from("students")
        .select("id, name, sortable_name")
        .eq("course_id", course.course_id)
        .then(({ data }) => setRoster(((data as any) ?? []).map((r: any) => ({
          id: r.id, name: r.name, sortable: r.sortable_name,
        }))));
    }
    if (placeholderStandards === null) {
      // Fetch the discipline-wide standards as placeholder columns so the
      // matrix shows empty mastery cells for every student even before any
      // assessments are tagged.
      (async () => {
        const { data: disc } = await supabase.rpc("get_effective_discipline", { _course_id: course.course_id });
        const d = (disc as any[])?.[0];
        if (!d) { setPlaceholderStandards([]); return; }
        let q = supabase.from("standards")
          .select("id, code, description, subject, framework")
          .eq("subject", d.subject);
        if (d.framework) q = q.eq("framework", d.framework);
        const { data: stds } = await q.order("code");
        setPlaceholderStandards(((stds as any) ?? []).map((s: any) => ({
          id: s.id, code: s.code, description: s.description ?? "",
          subject: s.subject, framework: s.framework ?? "STATE",
        })));
      })();
    }
  }, [course.course_id, collapsed, data, roster, placeholderStandards]);

  // Distinct students and standards out of the long-form rows.
  // Students are seeded from the roster fetch so they appear even when the
  // matrix RPC returns zero rows (no confirmed standards yet).
  const { students, standards, valueByPair, subjects, frameworks } = useMemo(() => {
    const studentMap = new Map<string, { id: string; name: string; sortable: string | null }>();
    (roster ?? []).forEach((r) => studentMap.set(r.id, r));
    const stdMap = new Map<string, { id: string; code: string; parent_code: string; description: string; subject: string; framework: string }>();
    const valueMap = new Map<string, MatrixRow>();
    const subjs = new Set<string>();
    const fws = new Set<string>();

    function deriveParent(code: string) {
      const m = code.match(/^(.+)[-.][^-.]+$/);
      return m ? m[1] : code;
    }

    // Seed columns from the discipline-wide standards so the matrix has
    // placeholder columns even when nothing has been tagged yet.
    (placeholderStandards ?? []).forEach((s) => {
      stdMap.set(s.id, {
        id: s.id, code: s.code, parent_code: deriveParent(s.code),
        description: s.description, subject: s.subject, framework: s.framework,
      });
      if (s.subject) subjs.add(s.subject);
      if (s.framework) fws.add(s.framework);
    });

    (data ?? []).forEach((r) => {
      // Backfill in case a student is in the matrix but missing from the roster fetch.
      if (!studentMap.has(r.student_id)) {
        studentMap.set(r.student_id, { id: r.student_id, name: r.student_name, sortable: r.student_sortable });
      }
      // Tagged standards override placeholders (same id, fresher metadata + parent_code from RPC).
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
  }, [data, roster, placeholderStandards]);

  // Apply subject/framework filters to the standard list.
  const filteredStandards = useMemo(() => {
    return standards.filter((s) => {
      if (subjectFilter !== "ALL" && s.subject !== subjectFilter) return false;
      if (frameworkFilter !== "ALL" && s.framework !== frameworkFilter) return false;
      return true;
    });
  }, [standards, subjectFilter, frameworkFilter]);

  // Group substandards by their parent code into top-level columns.
  type ParentGroup = {
    key: string;            // parent_code
    label: string;
    subject: string;
    framework: string;
    children: { id: string; code: string; description: string }[]; // substandards
  };
  const parentGroups = useMemo<ParentGroup[]>(() => {
    const groups = new Map<string, ParentGroup>();
    filteredStandards.forEach((s) => {
      const g = groups.get(s.parent_code);
      if (g) {
        g.children.push({ id: s.id, code: s.code, description: s.description });
      } else {
        groups.set(s.parent_code, {
          key: s.parent_code, label: s.parent_code,
          subject: s.subject, framework: s.framework,
          children: [{ id: s.id, code: s.code, description: s.description }],
        });
      }
    });
    // Sort children alphanumerically inside each group.
    groups.forEach((g) => g.children.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    return Array.from(groups.values());
  }, [filteredStandards]);

  // Compute the average score for a student across a list of standard ids.
  function avgFor(studentId: string, standardIds: string[]): { score: number | null; covered: number; total: number; attempts: number; lastAt: string | null } {
    let sum = 0, n = 0, attempts = 0, lastAt: string | null = null;
    for (const sid of standardIds) {
      const v = valueByPair.get(`${studentId}|${sid}`);
      if (v?.mastery_score != null) {
        sum += Number(v.mastery_score);
        n += 1;
        attempts += v.attempts ?? 0;
        if (v.computed_at && (!lastAt || v.computed_at > lastAt)) lastAt = v.computed_at;
      }
    }
    return { score: n ? sum / n : null, covered: n, total: standardIds.length, attempts, lastAt };
  }

  // Sort the parent groups by class-wide rolled-up averages when requested.
  const sortedGroups = useMemo(() => {
    if (sortBy === "code") return [...parentGroups].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    const groupAvg = (g: ParentGroup) => {
      const ids = g.children.map((c) => c.id);
      let sum = 0, n = 0;
      students.forEach((st) => {
        const v = avgFor(st.id, ids);
        if (v.score != null) { sum += v.score; n += 1; }
      });
      return n ? sum / n : null;
    };
    return [...parentGroups].sort((a, b) => {
      const av = groupAvg(a), bv = groupAvg(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortBy === "weak" ? av - bv : bv - av;
    });
  }, [parentGroups, sortBy, students, valueByPair]);

  // Build the flat list of leaf columns reflecting current expansion state.
  // Each parent contributes a single rollup column; expanded parents add a
  // column per substandard before their rollup column.
  type LeafCol =
    | { kind: "parent"; key: string; group: ParentGroup; standardIds: string[] }
    | { kind: "child"; key: string; group: ParentGroup; childId: string; childCode: string; childDescription: string };
  const leafColumns = useMemo<LeafCol[]>(() => {
    const out: LeafCol[] = [];
    sortedGroups.forEach((g) => {
      const isOpen = expanded.has(g.key) && g.children.length > 1;
      if (isOpen) {
        g.children.forEach((c) => out.push({
          kind: "child", key: `${g.key}::${c.id}`, group: g, childId: c.id, childCode: c.code, childDescription: c.description,
        }));
      }
      out.push({ kind: "parent", key: g.key, group: g, standardIds: g.children.map((c) => c.id) });
    });
    return out;
  }, [sortedGroups, expanded]);

  function leafValue(studentId: string, col: LeafCol) {
    if (col.kind === "parent") return avgFor(studentId, col.standardIds);
    return avgFor(studentId, [col.childId]);
  }

  function toggleParent(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const visibleStudents = students.filter((s) => {
    if (!studentFilter) return true;
    const display = reveal.display(s.id, s.name);
    return display.toLowerCase().includes(studentFilter.toLowerCase());
  });

  // CSV export of exactly what's on screen.
  function exportCsv() {
    const header = ["Student", ...leafColumns.map((c) => c.kind === "parent" ? c.group.label : `${c.group.label} › ${c.childCode}`), "Avg"];
    const lines = [header.join(",")];
    visibleStudents.forEach((st) => {
      const cells = leafColumns.map((c) => {
        const v = leafValue(st.id, c);
        return v.score != null ? (v.score * 100).toFixed(0) : "";
      });
      // Student average uses parent rollups only, so substandards don't double-count.
      const studentVals = leafColumns
        .filter((c) => c.kind === "parent")
        .map((c) => leafValue(st.id, c).score)
        .filter((s): s is number => s != null);
      const avg = studentVals.length ? (studentVals.reduce((a, b) => a + b, 0) / studentVals.length * 100).toFixed(0) : "";
      lines.push([JSON.stringify(reveal.display(st.id, st.name)), ...cells, avg].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course.course_name.replace(/\W+/g, "_")}_mastery_matrix.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allExpandable = sortedGroups.filter((g) => g.children.length > 1);
  const allOpen = allExpandable.length > 0 && allExpandable.every((g) => expanded.has(g.key));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            {onToggleCollapsed && (
              <Button variant="ghost" size="sm" onClick={onToggleCollapsed} className="mb-2 -ml-2 h-7">
                {collapsed
                  ? <><ChevronRight className="h-3.5 w-3.5 mr-1" /> Show student table</>
                  : <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Hide student table</>}
              </Button>
            )}
            <CardTitle>{course.course_name}</CardTitle>
            <CardDescription>
              Mastery for every active student against the standards covered in this course.
              Click a standard column header to expand its <strong>substandards</strong>.
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
            {allExpandable.length > 0 && (
              <Button size="sm" variant="outline" onClick={() =>
                setExpanded(allOpen ? new Set() : new Set(allExpandable.map((g) => g.key)))
              }>
                {allOpen ? "Collapse all" : "Expand all"}
              </Button>
            )}
            <RevealNamesToggle
              revealed={reveal.revealed}
              loading={reveal.loading}
              onReveal={reveal.reveal}
              onHide={reveal.hide}
            />
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
      <CardContent>
        {(data === null || roster === null || placeholderStandards === null) ? <Skeleton className="h-60 w-full" /> :
         students.length === 0 ? <EmptyState message="No students enrolled in this course yet. Sync your roster from Courses." /> :
         leafColumns.length === 0 ? (
          <EmptyState message="No standards available for this course's discipline. Seed standards from Standards, then tag assessments on Tag Review." />
         ) :
         visibleStudents.length === 0 ? <EmptyState message="No students match this filter." /> : (
          <div className="space-y-3">
            {(data ?? []).length === 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                <strong>Showing placeholder columns from your discipline standards.</strong>{" "}
                Mastery cells stay empty until you tag assessments on{" "}
                <Link to="/app/review" className="underline font-medium">Tag Review</Link>{" "}
                and recompute mastery.
              </div>
            )}
            <div className="overflow-auto border rounded-lg max-h-[70vh]">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th className="sticky left-0 z-20 bg-card border-b border-r p-2 text-left font-medium min-w-[180px]">Student</th>
                  {leafColumns.map((c) => {
                    if (c.kind === "child") {
                      return (
                        <th key={c.key} className="border-b border-r p-2 font-code font-normal text-[11px] whitespace-nowrap bg-muted/30"
                            title={c.childDescription ? `${c.childCode} — ${c.childDescription}` : c.childCode}>
                          <div className="text-muted-foreground">{c.childCode}</div>
                          <div className="text-[11px] font-sans text-muted-foreground/80">substandard</div>
                        </th>
                      );
                    }
                    const isOpen = expanded.has(c.group.key);
                    const canExpand = c.group.children.length > 1;
                    return (
                      <th key={c.key} className="border-b border-r p-2 font-code font-normal text-[11px] whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => canExpand && toggleParent(c.group.key)}
                          disabled={!canExpand}
                          className={`flex items-center gap-1 mx-auto ${canExpand ? "hover:text-primary cursor-pointer" : "cursor-default"}`}
                          title={canExpand
                            ? `${c.group.label} — ${isOpen ? "click to collapse" : `click to show ${c.group.children.length} substandards`}`
                            : c.group.label}
                        >
                          {canExpand && (isOpen
                            ? <ChevronDown className="h-3 w-3" />
                            : <ChevronRight className="h-3 w-3" />)}
                          <span>{c.group.label}</span>
                        </button>
                        <div className="text-[11px] text-muted-foreground font-sans">
                          {c.group.children.length === 1 ? "1 standard" : `${c.group.children.length} substandards`}
                        </div>
                      </th>
                    );
                  })}
                  <th className="border-b p-2 font-medium text-right whitespace-nowrap">Avg</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((st) => {
                  // Student average uses parent rollups only.
                  const studentScores: number[] = [];
                  leafColumns.forEach((c) => {
                    if (c.kind !== "parent") return;
                    const v = leafValue(st.id, c);
                    if (v.score != null) studentScores.push(v.score);
                  });
                  const studentAvg = studentScores.length ? studentScores.reduce((a, b) => a + b, 0) / studentScores.length : null;
                  return (
                    <tr key={st.id} className="hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card border-b border-r p-2 font-medium whitespace-nowrap">{reveal.display(st.id, st.name)}</td>
                      {leafColumns.map((c) => {
                        const v = leafValue(st.id, c);
                        const label = c.kind === "parent" ? c.group.label : `${c.group.label} › ${c.childCode}`;
                        const detail = c.kind === "parent" && c.standardIds.length > 1
                          ? ` • ${v.covered}/${v.total} substandards`
                          : "";
                        return (
                          <td key={c.key}
                              className={`border-b border-r p-2 text-center tabular-nums ${masteryColor(v.score)} ${c.kind === "child" ? "bg-opacity-60" : ""}`}
                              title={v.score == null
                                ? `${label}: no evidence yet`
                                : `${label}: ${(v.score * 100).toFixed(0)}% • ${v.attempts} attempt(s)${v.lastAt ? ` • last ${new Date(v.lastAt).toLocaleDateString()}` : ""}${detail}`}>
                            {v.score == null ? "—" : `${(v.score * 100).toFixed(0)}`}
                          </td>
                        );
                      })}
                      <td className={`border-b p-2 text-right tabular-nums font-medium ${masteryColor(studentAvg)}`}>
                        {studentAvg == null ? "—" : `${(studentAvg * 100).toFixed(0)}`}
                      </td>
                    </tr>
                  );
                })}
                {/* Class-average footer per column */}
                <tr className="bg-muted/30 font-medium">
                  <td className="sticky left-0 z-10 bg-muted/40 border-r p-2">Class avg</td>
                  {leafColumns.map((c) => {
                    let sum = 0, n = 0;
                    visibleStudents.forEach((st) => {
                      const v = leafValue(st.id, c);
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
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/30" /> ≥ 80%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-500/15 border border-amber-500/30" /> 60–79%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-red-500/15 border border-red-500/30" /> &lt; 60%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-muted/60" /> No evidence yet</span>
          <span className="ml-auto">Click a standard code to reveal its substandards.</span>
        </div>
      </CardContent>
      )}
    </Card>
  );
}

// ───────────────────────── Standards ─────────────────────────
function StandardsView({ courseId, subjects, courses }: { courseId: string | null; subjects: string[]; courses: Course[] }) {
  const [subject, setSubject] = useState<string>("ALL");
  const [framework, setFramework] = useState<string>("ALL");
  const [rows, setRows] = useState<StandardRow[] | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  useEffect(() => {
    setRows(null);
    const subj = subject === "ALL" ? null : subject;
    const fw = framework === "ALL" ? null : framework;
    // No multi-class selection → use the global single-course filter as before.
    if (selectedCourses.length === 0) {
      supabase.rpc("analytics_standard_breakdown", {
        _course_id: courseId, _subject: subj, _framework: fw,
      }).then(({ data }) => setRows((data as any) ?? []));
      return;
    }
    // Multi-class: query each course, merge by standard_id (sum counts, weighted avg).
    Promise.all(selectedCourses.map((cid) =>
      supabase.rpc("analytics_standard_breakdown", { _course_id: cid, _subject: subj, _framework: fw })
        .then(({ data }) => (data as any as StandardRow[]) ?? [])
    )).then((arrays) => {
      const merged = new Map<string, StandardRow>();
      for (const arr of arrays) {
        for (const r of arr) {
          const prev = merged.get(r.standard_id);
          if (!prev) {
            merged.set(r.standard_id, { ...r });
          } else {
            const sa = prev.students_assessed + r.students_assessed;
            const sm = prev.students_mastered + r.students_mastered;
            const avg = sa > 0
              ? ((Number(prev.avg_mastery ?? 0) * prev.students_assessed) +
                 (Number(r.avg_mastery ?? 0) * r.students_assessed)) / sa
              : null;
            merged.set(r.standard_id, {
              ...prev,
              students_assessed: sa,
              students_mastered: sm,
              avg_mastery: avg,
              pct_mastered: sa > 0 ? sm / sa : null,
            });
          }
        }
      }
      const list = Array.from(merged.values()).sort((a, b) => (a.pct_mastered ?? 0) - (b.pct_mastered ?? 0));
      setRows(list);
    });
  }, [courseId, subject, framework, selectedCourses]);

  const visible = (rows ?? []).filter((r) => !filter || r.code.toLowerCase().includes(filter.toLowerCase()) || r.description.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div><CardTitle>Standards heatmap</CardTitle><CardDescription>Cohort performance per standard. Sorted by weakest first.</CardDescription></div>
          <div className="flex items-end gap-2 flex-wrap">
            <Input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-[200px]" />
            <CourseMultiSelect courses={courses} selected={selectedCourses} onChange={setSelectedCourses} placeholder="All classes" />
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
                    <TableCell className="font-code text-xs whitespace-nowrap">{r.code}</TableCell>
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
function AssignmentsView({ courseId, courses }: { courseId: string | null; courses: Course[] }) {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  useEffect(() => {
    setRows(null);
    supabase.rpc("analytics_assignment_breakdown", { _course_id: courseId }).then(({ data }) => setRows((data as any) ?? []));
  }, [courseId]);
  const visible = useMemo(() => {
    if (!rows) return rows;
    if (selectedCourses.length === 0) return rows;
    const set = new Set(selectedCourses);
    return rows.filter((r) => set.has(r.course_id));
  }, [rows, selectedCourses]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Assessment breakdown</CardTitle>
            <CardDescription>Performance per assignment with submission counts and tagged standards.</CardDescription>
          </div>
          <CourseMultiSelect
            courses={courses}
            selected={selectedCourses}
            onChange={setSelectedCourses}
            placeholder="All classes"
          />
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? <Skeleton className="h-40 w-full" /> :
         (visible ?? []).length === 0 ? <EmptyState message="No assessments yet for this filter." /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Assessment</TableHead><TableHead>Course</TableHead><TableHead>Type</TableHead>
              <TableHead>Due</TableHead><TableHead className="text-right">Submissions</TableHead>
              <TableHead className="text-right">Avg %</TableHead><TableHead className="text-right">Standards</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(visible ?? []).map((r) => (
                <TableRow key={r.assignment_id}>
                  <TableCell className="font-medium max-w-sm truncate" title={r.name}>{r.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.course_name}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[11px]">{r.kind}</Badge></TableCell>
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

const EmptyState = forwardRef<HTMLDivElement, { message: string }>(({ message }, ref) => (
  <div ref={ref} className="py-10 text-center text-muted-foreground">
    <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-60" />
    <p className="text-sm">{message}</p>
    <p className="text-xs mt-2">
      Need to set things up? Visit <Link to="/app/classes" className="underline">Classes</Link>, <Link to="/app/review" className="underline">Tag Review</Link>.
    </p>
  </div>
));
EmptyState.displayName = "EmptyState";

// ───────────────────────── Compare classes ─────────────────────────
type CompareRow = {
  course_id: string;
  course_name: string;
  band: "below" | "approaching" | "mastered";
  count: number;
  avg_score: number | null;
  total_n: number;
};

const BANDS = [
  { key: "below" as const,       label: "Below (<60%)",         color: "hsl(0 72% 51%)" },
  { key: "approaching" as const, label: "Approaching (60–80%)", color: "hsl(38 92% 50%)" },
  { key: "mastered" as const,    label: "Mastered (≥80%)",      color: "hsl(160 84% 39%)" },
];

type ScopeKind = "assignment" | "standard";
type SplitMode = "all" | "by_class" | "by_level" | "class_x_level";
type ChartStyle = "grouped" | "stacked";

export function CompareView({ courses }: { courses: Course[] }) {
  const [subject, setSubject] = useState<string>("");
  const [courseSubjects, setCourseSubjects] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [scope, setScope] = useState<ScopeKind>("standard");
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [standardId, setStandardId] = useState<string>("");
  const [split, setSplit] = useState<SplitMode>("by_class");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("grouped");

  // Assignment picker holds either an `assignment:<id>` or `group:<id>` value.
  const [assignmentOptions, setAssignmentOptions] = useState<{ id: string; name: string; course_name: string; class_count: number }[]>([]);
  const [groupOptions, setGroupOptions] = useState<{ id: string; name: string; course_count: number; member_count: number }[]>([]);
  const [standardOptions, setStandardOptions] = useState<{ id: string; code: string; description: string }[]>([]);
  const [rows, setRows] = useState<CompareRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Build a map of course_id → subject from teacher_disciplines (via courses.discipline_id).
  useEffect(() => {
    supabase.from("courses").select("id, discipline_id, teacher_disciplines(subject)").then(({ data }) => {
      const map: Record<string, string> = {};
      ((data as any[]) ?? []).forEach((c) => {
        const s = c.teacher_disciplines?.subject;
        if (s) map[c.id] = s;
      });
      setCourseSubjects(map);
    });
  }, []);

  // Subjects available across the user's courses.
  const compareSubjects = useMemo(
    () => Array.from(new Set(Object.values(courseSubjects))).sort(),
    [courseSubjects]
  );

  // Only show classes that match the chosen content area. When no subject (or
  // "all") is picked, show every class so Compare works even when teachers
  // haven't tagged disciplines yet.
  const subjectCourses = useMemo(
    () => (subject && subject !== "__all"
      ? courses.filter((c) => courseSubjects[c.id] === subject)
      : courses),
    [courses, courseSubjects, subject]
  );

  // If a real subject is picked, drop selected classes that don't match.
  // When subject is empty / "__all", keep the user's selection intact.
  useEffect(() => {
    if (!subject || subject === "__all") return;
    const allowed = new Set(subjectCourses.map((c) => c.id));
    setSelected((prev) => prev.filter((id) => allowed.has(id)));
  }, [subject, subjectCourses]);

  // Load pickers (assessments / standards). Standards list is global; assessments
  // list is filtered to the selected classes when any are picked.
  useEffect(() => {
    let q = supabase.from("assignments").select("id, name, name_normalized, course_id, courses(name)").order("name").limit(1000);
    if (selected.length > 0) q = q.in("course_id", selected);
    q.then(({ data }) => {
      const list = (data as any[] | null) ?? [];
      // Deduplicate by name_normalized so equivalent assignments across sections
      // appear once. Keep the first id as the "representative"; the backend
      // automatically expands to siblings by name_normalized.
      const byNorm = new Map<string, { id: string; name: string; course_name: string; courses: Set<string> }>();
      for (const a of list) {
        const key = a.name_normalized || a.name || a.id;
        const cur = byNorm.get(key);
        if (cur) {
          if (a.courses?.name) cur.courses.add(a.courses.name);
        } else {
          byNorm.set(key, {
            id: a.id,
            name: a.name,
            course_name: a.courses?.name ?? "",
            courses: new Set(a.courses?.name ? [a.courses.name] : []),
          });
        }
      }
      setAssignmentOptions(
        Array.from(byNorm.values()).map((v) => ({
          id: v.id,
          name: v.name,
          course_name: v.course_name,
          class_count: v.courses.size,
        }))
      );
    });
    // Also load assignment groups (teacher-wide).
    supabase.rpc("list_assignment_groups" as any).then(({ data }) => {
      const list = ((data as any[]) ?? []).map((g: any) => ({
        id: g.group_id, name: g.name, course_count: g.course_count, member_count: g.member_count,
      }));
      setGroupOptions(list);
    });
  }, [selected]);

  useEffect(() => {
    let q = supabase.from("standards").select("id, code, description, subject").order("code").limit(2000);
    if (subject) q = q.eq("subject", subject);
    q.then(({ data }) => {
      setStandardOptions(((data as any) ?? []).map((s: any) => ({ id: s.id, code: s.code, description: s.description })));
    });
  }, [subject]);

  const targetId = scope === "assignment" ? assignmentId : standardId;
  const canQuery = selected.length > 0 && !!targetId;

  useEffect(() => {
    if (!canQuery) { setRows(null); return; }
    setLoading(true);
    // assignmentId is encoded as "assignment:<uuid>" or "group:<uuid>"
    let _assignment_id: string | null = null;
    let _assignment_group_id: string | null = null;
    if (scope === "assignment" && assignmentId) {
      if (assignmentId.startsWith("group:")) _assignment_group_id = assignmentId.slice("group:".length);
      else if (assignmentId.startsWith("assignment:")) _assignment_id = assignmentId.slice("assignment:".length);
      else _assignment_id = assignmentId; // fallback
    }
    supabase.rpc("analytics_compare_classes" as any, {
      _course_ids: selected,
      _assignment_id,
      _standard_id: scope === "standard" ? standardId : null,
      _assignment_group_id,
    }).then(({ data, error }) => {
      setLoading(false);
      if (error) { setRows([]); return; }
      setRows(((data as any) ?? []) as CompareRow[]);
    });
  }, [canQuery, selected, scope, assignmentId, standardId]);

  // Pivot rows for chart: one entry per course with band counts.
  const perCourse = useMemo(() => {
    if (!rows) return [];
    const m = new Map<string, { course_id: string; course_name: string; total_n: number; avg_score: number | null; below: number; approaching: number; mastered: number }>();
    for (const r of rows) {
      const cur = m.get(r.course_id) ?? {
        course_id: r.course_id, course_name: r.course_name,
        total_n: r.total_n, avg_score: r.avg_score,
        below: 0, approaching: 0, mastered: 0,
      };
      cur[r.band] = r.count;
      m.set(r.course_id, cur);
    }
    return Array.from(m.values()).sort((a, b) => a.course_name.localeCompare(b.course_name));
  }, [rows]);

  // Chart-ready data + which series (bars) to render.
  const chartData = useMemo(() => {
    if (split === "all") {
      // single combined bar
      const total = perCourse.reduce((acc, c) => {
        acc.below += c.below; acc.approaching += c.approaching; acc.mastered += c.mastered;
        acc.total_n += c.total_n;
        return acc;
      }, { below: 0, approaching: 0, mastered: 0, total_n: 0 });
      const weighted = perCourse.reduce((sum, c) => sum + (Number(c.avg_score ?? 0) * c.total_n), 0);
      const avg = total.total_n > 0 ? weighted / total.total_n : 0;
      return [{ name: "All selected", below: total.below, approaching: total.approaching, mastered: total.mastered, avg_pct: Math.round(avg * 100) }];
    }
    if (split === "by_level") {
      const total = perCourse.reduce((acc, c) => {
        acc.below += c.below; acc.approaching += c.approaching; acc.mastered += c.mastered;
        return acc;
      }, { below: 0, approaching: 0, mastered: 0 });
      return BANDS.map((b) => ({ name: b.label, count: total[b.key] }));
    }
    // by_class or class_x_level
    return perCourse.map((c) => ({
      name: c.course_name,
      below: c.below,
      approaching: c.approaching,
      mastered: c.mastered,
      avg_pct: c.avg_score != null ? Math.round(Number(c.avg_score) * 100) : 0,
    }));
  }, [perCourse, split]);

  function exportCsv() {
    const header = ["Class", "n", "Avg %", "Below", "Approaching", "Mastered"];
    const lines = [header.join(",")];
    perCourse.forEach((c) => {
      lines.push([
        JSON.stringify(c.course_name),
        c.total_n,
        c.avg_score != null ? Math.round(Number(c.avg_score) * 100) : "",
        c.below, c.approaching, c.mastered,
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "class_comparison.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare classes</CardTitle>
        <CardDescription>
          Pick one or more classes and a target — an assignment or a standard — to compare performance side by side.
          Split the view by class, by mastery level, or both.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Content area</Label>
            <Select value={subject || undefined} onValueChange={setSubject}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Pick a subject…" /></SelectTrigger>
              <SelectContent>
                {compareSubjects.length === 0 && <SelectItem value="__none" disabled>No subjects</SelectItem>}
                {compareSubjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Classes</Label>
            <CourseMultiSelect
              courses={subjectCourses}
              selected={selected}
              onChange={setSelected}
              placeholder={subject ? "Pick classes…" : "Pick a content area first"}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Scope</Label>
            <div className="flex rounded-md border overflow-hidden h-9">
              {(["standard", "assignment"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`px-3 text-xs font-medium transition ${scope === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  {s === "standard" ? "Standard" : "Assignment"}
                </button>
              ))}
            </div>
          </div>
          {scope === "assignment" ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Assignment</Label>
              <Select value={assignmentId} onValueChange={setAssignmentId}>
                <SelectTrigger className="w-[300px] h-9"><SelectValue placeholder="Pick an assignment or group…" /></SelectTrigger>
                <SelectContent>
                  {groupOptions.length === 0 && assignmentOptions.length === 0 && <SelectItem value="__none" disabled>No assignments</SelectItem>}
                  {groupOptions.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Groups</div>
                      {groupOptions.map((g) => (
                        <SelectItem key={`group:${g.id}`} value={`group:${g.id}`}>
                          <span className="inline-flex items-center gap-1.5">
                            <Layers className="h-3 w-3" />
                            {g.name}
                            <span className="text-muted-foreground text-xs">· {g.course_count} classes</span>
                          </span>
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground border-t mt-1 pt-2">Individual assignments</div>
                    </>
                  )}
                  {assignmentOptions.map((a) => (
                    <SelectItem key={`assignment:${a.id}`} value={`assignment:${a.id}`}>
                      {a.name}
                      {a.class_count > 1
                        ? <span className="text-muted-foreground text-xs"> · {a.class_count} classes</span>
                        : a.course_name ? <span className="text-muted-foreground text-xs"> · {a.course_name}</span> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Standard</Label>
              <Select value={standardId} onValueChange={setStandardId}>
                <SelectTrigger className="w-[320px] h-9"><SelectValue placeholder="Pick a standard…" /></SelectTrigger>
                <SelectContent>
                  {standardOptions.length === 0 && <SelectItem value="__none" disabled>No standards</SelectItem>}
                  {standardOptions.slice(0, 500).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-code mr-1.5">{s.code}</span>
                      <span className="text-muted-foreground">{s.description.slice(0, 60)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Split</Label>
            <div className="flex rounded-md border overflow-hidden h-9">
              {([
                ["all", "All"],
                ["by_class", "By class"],
                ["by_level", "By level"],
                ["class_x_level", "Class × level"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSplit(k)}
                  className={`px-3 text-xs font-medium transition ${split === k ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {split === "class_x_level" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bars</Label>
              <div className="flex rounded-md border overflow-hidden h-9">
                {(["grouped", "stacked"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setChartStyle(g)}
                    className={`px-3 text-xs font-medium transition ${chartStyle === g ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  >
                    {g === "grouped" ? "Grouped" : "Stacked"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={perCourse.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {!canQuery ? (
          <EmptyState message={!subject ? "Pick a content area to begin." : "Pick at least one class and a target to compare."} />
        ) : loading ? (
          <Skeleton className="h-72 w-full" />
        ) : perCourse.length === 0 ? (
          <EmptyState message="No data yet for this selection." />
        ) : (
          <>
            <ChartContainer
              config={{
                below:       { label: BANDS[0].label, color: BANDS[0].color },
                approaching: { label: BANDS[1].label, color: BANDS[1].color },
                mastered:    { label: BANDS[2].label, color: BANDS[2].color },
                count:       { label: "Count",        color: "hsl(var(--primary))" },
                avg_pct:     { label: "Avg %",        color: "hsl(var(--primary))" },
              }}
              className="h-80 w-full"
            >
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {split === "by_level" ? (
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                ) : split === "by_class" ? (
                  <Bar dataKey="avg_pct" name="Avg %" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                ) : (
                  // "all" or "class_x_level": three band bars
                  BANDS.map((b) => (
                    <Bar
                      key={b.key}
                      dataKey={b.key}
                      name={b.label}
                      stackId={split === "class_x_level" && chartStyle === "stacked" ? "a" : split === "all" ? "a" : undefined}
                      fill={b.color}
                      radius={split === "class_x_level" && chartStyle === "stacked" ? undefined : [6, 6, 0, 0]}
                    />
                  ))
                )}
              </BarChart>
            </ChartContainer>

            <Table>
              <TableHeader><TableRow>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">n</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead className="text-right" style={{ color: BANDS[0].color }}>Below</TableHead>
                <TableHead className="text-right" style={{ color: BANDS[1].color }}>Approaching</TableHead>
                <TableHead className="text-right" style={{ color: BANDS[2].color }}>Mastered</TableHead>
                <TableHead className="text-right">% mastered</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {perCourse.map((c) => {
                  const pctMastered = c.total_n > 0 ? c.mastered / c.total_n : 0;
                  return (
                    <TableRow key={c.course_id}>
                      <TableCell className="font-medium">{c.course_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.total_n}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.avg_score != null ? `${Math.round(Number(c.avg_score) * 100)}%` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.below}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.approaching}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.mastered}</TableCell>
                      <TableCell className="text-right tabular-nums">{`${Math.round(pctMastered * 100)}%`}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
