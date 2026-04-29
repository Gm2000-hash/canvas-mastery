// Department dashboard — cross-teacher analytics for a single subject.
// Privacy: real names only show for the viewer's own students/classes; peers
// always render with the pseudonyms returned by the security-definer RPCs.
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Info, Users, GraduationCap, BookMarked, ListChecks } from "lucide-react";
import { recentSchoolYears, currentSchoolYearLabel } from "@/lib/schoolYear";
import { GRADES } from "@/lib/frameworks";
import DepartmentReports from "@/components/department/DepartmentReports";

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
type StudentRow = { student_id: string; is_own: boolean; display_name: string; class_label: string; grade: string | null; standards_assessed: number; standards_mastered: number; avg_mastery: number | null; last_activity: string | null };
type AssessmentRow = { name_normalized: string; display_name: string; teacher_count: number; class_count: number; submission_count: number; avg_percentage: number | null; standards_tagged: number };

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

export default function DepartmentDashboard() {
  const { subject: subjectParam } = useParams<{ subject: string }>();
  const subject = decodeURIComponent(subjectParam ?? "");

  const [schoolYear, setSchoolYear] = useState<string>(currentSchoolYearLabel());
  const [grades, setGrades] = useState<string[]>([]); // selected grades; empty = all my grades
  const [myGrades, setMyGrades] = useState<string[]>([]);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [standards, setStandards] = useState<StandardRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [studentSearch, setStudentSearch] = useState("");

  // Load this teacher's grades for the subject
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("teacher_disciplines")
        .select("grade")
        .eq("teacher_id", u.user.id)
        .eq("subject", subject);
      const gs = Array.from(new Set((data ?? []).map((r: any) => r.grade as string))).sort();
      setMyGrades(gs);
    })();
  }, [subject]);

  // Load all tabs in parallel whenever filters change
  useEffect(() => {
    if (!subject) return;
    setLoading(true);
    const _grades = grades.length ? grades : null;
    Promise.all([
      supabase.rpc("department_overview", { _subject: subject, _grades, _school_year: schoolYear }),
      supabase.rpc("department_standards", { _subject: subject, _grades, _school_year: schoolYear }),
      supabase.rpc("department_classes", { _subject: subject, _grades, _school_year: schoolYear }),
      supabase.rpc("department_students", { _subject: subject, _grades, _school_year: schoolYear }),
      supabase.rpc("department_assessments", { _subject: subject, _grades, _school_year: schoolYear }),
    ]).then(([ov, std, cls, stu, asmt]) => {
      const ovRow = (ov.data as any[])?.[0] ?? null;
      setOverview(ovRow);
      setStandards((std.data as StandardRow[]) ?? []);
      setClasses((cls.data as ClassRow[]) ?? []);
      setStudents((stu.data as StudentRow[]) ?? []);
      setAssessments((asmt.data as AssessmentRow[]) ?? []);
      setLoading(false);
    });
  }, [subject, schoolYear, grades]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    // Search restricted to viewer's own students (peer rows are pseudonymized).
    return students.filter((s) => s.is_own && s.display_name.toLowerCase().includes(q));
  }, [students, studentSearch]);

  function exportCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  if (!subject) {
    return <div className="p-6">No subject specified.</div>;
  }

  const isMember = myGrades.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/app/department"><ArrowLeft className="h-4 w-4 mr-1" /> All departments</Link>
        </Button>
        <h1 className="font-display text-3xl">{subject} Department</h1>
        <p className="text-muted-foreground mt-1">
          Combined data from every teacher who teaches {subject} this year.
        </p>
      </div>

      {!isMember && (
        <Card className="border-amber-500/50">
          <CardContent className="pt-6 flex gap-3 items-start">
            <Info className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm">
              You don't have a {subject} discipline yet. Add one in{" "}
              <Link to="/app/settings" className="text-primary underline">Settings</Link>{" "}
              to see department data.
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-4 flex gap-3 items-start text-sm">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="text-muted-foreground">
            Real names appear only for <strong>your own students and classes</strong>.
            Other teachers' students show as <code className="text-xs bg-background px-1 rounded">S-1</code>, <code className="text-xs bg-background px-1 rounded">S-2</code>… and their classes as <code className="text-xs bg-background px-1 rounded">Class A</code>, <code className="text-xs bg-background px-1 rounded">Class B</code>…
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">School year</label>
          <Select value={schoolYear} onValueChange={setSchoolYear}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {recentSchoolYears(4).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
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
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="standards">Standards</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="assessments">Common Assessments</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          {loading || !overview ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Kpi icon={Users} label="Teachers" value={overview.teacher_count} />
                <Kpi icon={GraduationCap} label="Classes" value={overview.class_count} />
                <Kpi icon={Users} label="Students" value={overview.student_count} />
                <Kpi icon={BookMarked} label="Avg mastery" value={pct(overview.avg_mastery)} />
                <Kpi icon={ListChecks} label="% mastered" value={pct(overview.pct_mastered)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mastery distribution</CardTitle>
                    <CardDescription>Latest snapshot per (student, standard)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{ count: { label: "Students", color: "hsl(var(--primary))" } }} className="h-[240px]">
                      <BarChart data={overview.distribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mastery trend (weekly)</CardTitle>
                    <CardDescription>Avg mastery score across the department</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{ avg: { label: "Avg mastery", color: "hsl(var(--primary))" } }} className="h-[240px]">
                      <LineChart data={overview.trend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* STANDARDS */}
        <TabsContent value="standards">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Standards across the department</CardTitle>
                <CardDescription>{standards.length} standards with mastery data</CardDescription>
              </div>
              <Button size="sm" variant="outline" disabled={!standards.length}
                onClick={() => exportCsv(`${subject}-department-standards.csv`,
                  ["Code", "Description", "Grade", "Framework", "Assessed", "Mastered", "Avg", "% mastered"],
                  standards.map((s) => [s.code, s.description, s.grade, s.framework, s.students_assessed, s.students_mastered, s.avg_mastery, s.pct_mastered]))}>
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-40 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Assessed</TableHead>
                      <TableHead className="text-right">Mastered</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead className="text-right">% mastered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standards.map((s) => (
                      <TableRow key={s.standard_id}>
                        <TableCell>
                          <div className="font-medium">{s.code}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">{s.description}</div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{s.grade}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{s.students_assessed}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.students_mastered}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(s.avg_mastery)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(s.pct_mastered)}</TableCell>
                      </TableRow>
                    ))}
                    {!standards.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No data yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CLASSES */}
        <TabsContent value="classes">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Classes</CardTitle>
                <CardDescription>Your classes by name; peers' classes anonymized</CardDescription>
              </div>
              <Button size="sm" variant="outline" disabled={!classes.length}
                onClick={() => exportCsv(`${subject}-department-classes.csv`,
                  ["Class", "Grade", "Owner", "Students", "Avg", "% mastered"],
                  classes.map((c) => [c.display_label, c.grade, c.is_own ? "You" : "Peer", c.student_count, c.avg_mastery, c.pct_mastered]))}>
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-40 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead className="text-right">% mastered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((c) => (
                      <TableRow key={c.course_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.is_own
                              ? <Link to={`/app/classes/${c.course_id}`} className="font-medium hover:underline">{c.display_label}</Link>
                              : <span>{c.display_label}</span>}
                            {c.is_own && <Badge variant="secondary" className="text-xs">Yours</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{c.grade ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.student_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(c.avg_mastery)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(c.pct_mastered)}</TableCell>
                      </TableRow>
                    ))}
                    {!classes.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No classes.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* STUDENTS */}
        <TabsContent value="students">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Students</CardTitle>
                  <CardDescription>Your students by name; peers' students pseudonymized</CardDescription>
                </div>
                <Button size="sm" variant="outline" disabled={!students.length}
                  onClick={() => exportCsv(`${subject}-department-students.csv`,
                    ["Student", "Owner", "Class", "Grade", "Standards assessed", "Standards mastered", "Avg", "Last activity"],
                    students.map((s) => [s.display_name, s.is_own ? "You" : "Peer", s.class_label, s.grade, s.standards_assessed, s.standards_mastered, s.avg_mastery, s.last_activity]))}>
                  Export CSV
                </Button>
              </div>
              <Input
                placeholder="Search your own students…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-40 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Assessed</TableHead>
                      <TableHead className="text-right">Mastered</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((s) => (
                      <TableRow key={s.student_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={s.is_own ? "font-medium" : "text-muted-foreground"}>{s.display_name}</span>
                            {s.is_own && <Badge variant="secondary" className="text-xs">Yours</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{s.class_label}</TableCell>
                        <TableCell>{s.grade ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.standards_assessed}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.standards_mastered}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(s.avg_mastery)}</TableCell>
                      </TableRow>
                    ))}
                    {!filteredStudents.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No students match.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASSESSMENTS */}
        <TabsContent value="assessments">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Common assessments</CardTitle>
                <CardDescription>Assessments matched by name across the department</CardDescription>
              </div>
              <Button size="sm" variant="outline" disabled={!assessments.length}
                onClick={() => exportCsv(`${subject}-department-assessments.csv`,
                  ["Assessment", "Teachers", "Classes", "Submissions", "Avg %", "Standards tagged"],
                  assessments.map((a) => [a.display_name, a.teacher_count, a.class_count, a.submission_count, a.avg_percentage, a.standards_tagged]))}>
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-40 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead className="text-right">Teachers</TableHead>
                      <TableHead className="text-right">Classes</TableHead>
                      <TableHead className="text-right">Submissions</TableHead>
                      <TableHead className="text-right">Avg %</TableHead>
                      <TableHead className="text-right">Standards</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessments.map((a) => (
                      <TableRow key={a.name_normalized}>
                        <TableCell className="font-medium">{a.display_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.teacher_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.class_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.submission_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.avg_percentage != null ? `${Number(a.avg_percentage).toFixed(0)}%` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.standards_tagged}</TableCell>
                      </TableRow>
                    ))}
                    {!assessments.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No common assessments yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
