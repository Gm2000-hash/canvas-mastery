// Principal view: building-level analytics with combinable filters and
// one- or two-dimension breakdowns (teacher, subject, grade, course, student, standard).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { ArrowUpDown, Download, Filter, School, Users, GraduationCap, BookMarked, ListChecks, X, ChevronRight } from "lucide-react";
import { recentSchoolYears, currentSchoolYearLabel } from "@/lib/schoolYear";
import { useRole } from "@/hooks/useRole";
import { useProfile } from "@/contexts/ProfileContext";
import { RevealNamesToggle } from "@/components/RevealNamesToggle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Dim = "teacher" | "subject" | "grade" | "course" | "student" | "standard";
const DIMS: { value: Dim; label: string }[] = [
  { value: "teacher", label: "Teacher" },
  { value: "subject", label: "Subject" },
  { value: "grade", label: "Grade" },
  { value: "course", label: "Course" },
  { value: "student", label: "Student" },
  { value: "standard", label: "Standard" },
];

type Options = {
  school: string | null;
  teachers: { id: string; name: string }[];
  subjects: string[];
  grades: string[];
  courses: { id: string; name: string; teacher_id: string; teacher_name: string; subject: string | null; grade: string | null }[];
  school_years: string[];
};
type Overview = {
  teacher_count: number; class_count: number; student_count: number; standards_assessed: number;
  avg_mastery: number | null; pct_mastered: number | null; basic: number; proficient: number; advanced: number;
  trend: { label: string; ts: string; avg: number; n: number }[];
};
type Row = {
  key1: string; label1: string; key2: string | null; label2: string | null;
  teacher_count: number; class_count: number; student_count: number; standards_assessed: number;
  avg_mastery: number | null; pct_mastered: number | null; basic: number; proficient: number; advanced: number;
};

export type BuildingFilters = {
  teachers: string[]; subjects: string[]; grades: string[]; courses: string[];
  schoolYear: string | null; studentSearch: string;
};

export function filterArgs(f: BuildingFilters) {
  return {
    _teachers: f.teachers.length ? f.teachers : null,
    _subjects: f.subjects.length ? f.subjects : null,
    _grades: f.grades.length ? f.grades : null,
    _courses: f.courses.length ? f.courses : null,
    _school_year: f.schoolYear,
    _student_search: f.studentSearch.trim() || null,
  };
}

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(Number(v) * 100)}%`);
const BAND_COLORS = { basic: "hsl(0 70% 55%)", proficient: "hsl(45 85% 50%)", advanced: "hsl(140 55% 42%)" };

export default function BuildingAnalytics() {
  const { isPrincipal, isAdmin, loading: roleLoading } = useRole();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [options, setOptions] = useState<Options | null>(null);
  const [filters, setFilters] = useState<BuildingFilters>({
    teachers: params.get("teachers")?.split(",").filter(Boolean) ?? [],
    subjects: params.get("subjects")?.split(",").filter(Boolean) ?? [],
    grades: params.get("grades")?.split(",").filter(Boolean) ?? [],
    courses: params.get("courses")?.split(",").filter(Boolean) ?? [],
    schoolYear: params.get("year") ?? currentSchoolYearLabel(),
    studentSearch: params.get("q") ?? "",
  });
  const [dim1, setDim1] = useState<Dim>((params.get("by") as Dim) || "teacher");
  const [dim2, setDim2] = useState<Dim | "none">((params.get("by2") as Dim) || "none");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sort, setSort] = useState<{ col: keyof Row; dir: 1 | -1 }>({ col: "label1", dir: 1 });
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  const [revealing, setRevealing] = useState(false);

  // keep URL in sync (shareable views)
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.teachers.length) p.set("teachers", filters.teachers.join(","));
    if (filters.subjects.length) p.set("subjects", filters.subjects.join(","));
    if (filters.grades.length) p.set("grades", filters.grades.join(","));
    if (filters.courses.length) p.set("courses", filters.courses.join(","));
    if (filters.schoolYear) p.set("year", filters.schoolYear);
    if (filters.studentSearch) p.set("q", filters.studentSearch);
    p.set("by", dim1);
    if (dim2 !== "none") p.set("by2", dim2);
    setParams(p, { replace: true });
  }, [filters, dim1, dim2, setParams]);

  useEffect(() => {
    if (roleLoading) return;
    if (!isPrincipal && !isAdmin) navigate("/app", { replace: true });
  }, [roleLoading, isPrincipal, isAdmin, navigate]);

  useEffect(() => {
    (supabase as any).rpc("building_filter_options", { _school_year: filters.schoolYear }).then(({ data, error }: any) => {
      if (error) toast.error(error.message);
      setOptions((data as Options) ?? null);
    });
  }, [filters.schoolYear]);

  const load = useCallback(async () => {
    setOverview(null); setRows(null); setRevealed(new Map());
    const args = filterArgs(filters);
    const dims = dim2 === "none" ? [dim1] : [dim1, dim2];
    const [{ data: ov, error: e1 }, { data: br, error: e2 }] = await Promise.all([
      (supabase as any).rpc("building_overview", args),
      (supabase as any).rpc("building_breakdown", { _dims: dims, ...args }),
    ]);
    if (e1) toast.error(e1.message);
    if (e2) toast.error(e2.message);
    setOverview(Array.isArray(ov) ? ov[0] ?? null : ov);
    setRows((br as Row[]) ?? []);
  }, [filters, dim1, dim2]);

  useEffect(() => { load(); }, [load]);

  // cascading course options
  const courseOptions = useMemo(() => {
    if (!options) return [];
    return options.courses.filter((c) =>
      (!filters.teachers.length || filters.teachers.includes(c.teacher_id)) &&
      (!filters.subjects.length || (c.subject && filters.subjects.includes(c.subject))) &&
      (!filters.grades.length || (c.grade && filters.grades.includes(c.grade)))
    );
  }, [options, filters.teachers, filters.subjects, filters.grades]);

  const sortedRows = useMemo(() => {
    if (!rows) return null;
    const r = [...rows];
    r.sort((a, b) => {
      const av = a[sort.col] as any, bv = b[sort.col] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (typeof av === "number" ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
    return r;
  }, [rows, sort]);

  const setSortCol = (col: keyof Row) => setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: col === "label1" || col === "label2" ? 1 : -1 }));

  const activeCount = filters.teachers.length + filters.subjects.length + filters.grades.length + filters.courses.length + (filters.studentSearch ? 1 : 0);

  const studentIdsInView = useMemo(() => {
    if (!rows) return [];
    const ids = new Set<string>();
    for (const r of rows) {
      if (dim1 === "student") ids.add(r.key1);
      if (dim2 === "student" && r.key2) ids.add(r.key2);
    }
    return [...ids];
  }, [rows, dim1, dim2]);

  async function reveal(pin: string, reason?: string) {
    if (!studentIdsInView.length) { toast.info("Break down by Student to reveal names."); return false; }
    setRevealing(true);
    const { data, error } = await (supabase as any).rpc("reveal_building_identities", { _student_ids: studentIdsInView, _pin: pin, _reason: reason ?? null });
    setRevealing(false);
    if (error) {
      toast.error(error.message.includes("PIN_INVALID") ? "Incorrect PIN." : error.message.includes("PIN_NOT_SET") ? "Set a security PIN first." : error.message);
      return false;
    }
    const m = new Map<string, string>();
    for (const r of data ?? []) m.set(r.student_id, r.real_name);
    setRevealed(m);
    return true;
  }

  const nameFor = (key: string, label: string, dim: Dim) => (dim === "student" && revealed.get(key)) || label;

  function exportCsv() {
    if (!sortedRows) return;
    const headers = [DIMS.find((d) => d.value === dim1)!.label, ...(dim2 !== "none" ? [DIMS.find((d) => d.value === dim2)!.label] : []),
      "Teachers", "Classes", "Students", "Standards", "Avg mastery", "% mastered", "Basic", "Proficient", "Advanced"];
    const body = sortedRows.map((r) => [nameFor(r.key1, r.label1, dim1), ...(dim2 !== "none" ? [nameFor(r.key2 ?? "", r.label2 ?? "", dim2 as Dim)] : []),
      r.teacher_count, r.class_count, r.student_count, r.standards_assessed, pct(r.avg_mastery), pct(r.pct_mastered), r.basic, r.proficient, r.advanced]);
    const esc = (v: any) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [headers, ...body].map((r) => r.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `building-${dim1}${dim2 !== "none" ? `-${dim2}` : ""}.csv`; a.click();
  }

  // Drill-down: clicking a row narrows the filter or opens the student.
  function drill(r: Row, which: 1 | 2) {
    const dim = which === 1 ? dim1 : (dim2 as Dim);
    const key = which === 1 ? r.key1 : r.key2!;
    if (dim === "student") { navigate(`/app/building/students/${key}`); return; }
    if (dim === "standard") return;
    const next = { ...filters };
    if (dim === "teacher") { next.teachers = [key]; setDim1("course"); }
    if (dim === "course") { next.courses = [key]; setDim1("student"); }
    if (dim === "subject") { next.subjects = [key]; setDim1("teacher"); }
    if (dim === "grade") { next.grades = [key]; setDim1("teacher"); }
    setDim2("none");
    setFilters(next);
  }

  if (roleLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!profile?.school && !isAdmin) {
    return (
      <Card><CardHeader><CardTitle>Set your school first</CardTitle>
        <CardDescription>Building analytics show every teacher at your school. Add your school in <Link className="underline" to="/app/settings#profile">Settings</Link>.</CardDescription></CardHeader></Card>
    );
  }

  const bandData = overview ? [
    { band: "Basic", value: overview.basic, fill: BAND_COLORS.basic },
    { band: "Proficient", value: overview.proficient, fill: BAND_COLORS.proficient },
    { band: "Advanced", value: overview.advanced, fill: BAND_COLORS.advanced },
  ] : [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-accent mb-2">Building analytics</div>
          <h1 className="font-display text-3xl sm:text-4xl text-primary flex items-center gap-3">
            <School className="h-7 w-7 text-accent" /> {options?.school ?? profile?.school ?? "Your building"}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">Mastery across every teacher at your school. Combine filters, then break the data down by teacher, subject, grade, course, student, or standard.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filters.schoolYear ?? "all"} onValueChange={(v) => setFilters({ ...filters, schoolYear: v === "all" ? null : v })}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="School year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {Array.from(new Set([...(options?.school_years ?? []), ...recentSchoolYears(4)])).sort().reverse().map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Filter bar */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <MultiPicker label="Teachers" items={(options?.teachers ?? []).map((t) => ({ value: t.id, label: t.name }))}
              selected={filters.teachers} onChange={(v) => setFilters({ ...filters, teachers: v, courses: [] })} />
            <MultiPicker label="Subjects" items={(options?.subjects ?? []).map((s) => ({ value: s, label: s }))}
              selected={filters.subjects} onChange={(v) => setFilters({ ...filters, subjects: v, courses: [] })} />
            <MultiPicker label="Grades" items={(options?.grades ?? []).sort().map((g) => ({ value: g, label: `Grade ${g}` }))}
              selected={filters.grades} onChange={(v) => setFilters({ ...filters, grades: v, courses: [] })} />
            <MultiPicker label="Courses" items={courseOptions.map((c) => ({ value: c.id, label: `${c.name} · ${c.teacher_name}` }))}
              selected={filters.courses} onChange={(v) => setFilters({ ...filters, courses: v })} />
            <Input value={filters.studentSearch} onChange={(e) => setFilters({ ...filters, studentSearch: e.target.value })}
              placeholder="Student code…" className="h-9 w-[150px]" />
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => setFilters({ ...filters, teachers: [], subjects: [], grades: [], courses: [], studentSearch: "" })}>
                <X className="h-4 w-4 mr-1" /> Clear ({activeCount})
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Break down by</span>
            <Select value={dim1} onValueChange={(v) => setDim1(v as Dim)}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{DIMS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-muted-foreground">then</span>
            <Select value={dim2} onValueChange={(v) => setDim2(v as Dim | "none")}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {DIMS.filter((d) => d.value !== dim1).map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <RevealNamesToggle revealed={revealed.size > 0} loading={revealing} onReveal={reveal} onHide={() => setRevealed(new Map())}
                disabled={studentIdsInView.length === 0} />
              <Button variant="outline" size="sm" className="h-9" onClick={exportCsv} disabled={!sortedRows?.length}>
                <Download className="h-4 w-4 mr-1.5" /> CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview tiles */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Tile icon={Users} label="Teachers" value={overview?.teacher_count} />
        <Tile icon={GraduationCap} label="Classes" value={overview?.class_count} />
        <Tile icon={ListChecks} label="Students" value={overview?.student_count} />
        <Tile icon={BookMarked} label="Avg mastery" value={overview ? pct(overview.avg_mastery) : undefined} />
        <Tile icon={BookMarked} label="% standards mastered" value={overview ? pct(overview.pct_mastered) : undefined} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Students by band</CardTitle><CardDescription>Average mastery per student: Basic &lt;60%, Proficient 60–80%, Advanced ≥80%.</CardDescription></CardHeader>
          <CardContent>
            {!overview ? <Skeleton className="h-48" /> : (
              <ChartContainer config={{ value: { label: "Students" } }} className="h-48 w-full">
                <ResponsiveContainer>
                  <BarChart data={bandData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="band" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {bandData.map((d) => <Cell key={d.band} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Mastery trend</CardTitle><CardDescription>Weekly average of the latest mastery scores in scope.</CardDescription></CardHeader>
          <CardContent>
            {!overview ? <Skeleton className="h-48" /> : overview.trend.length === 0 ? <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No mastery data yet.</div> : (
              <ChartContainer config={{ avg: { label: "Avg mastery" } }} className="h-48 w-full">
                <ResponsiveContainer>
                  <LineChart data={overview.trend.map((t) => ({ ...t, avg: Math.round(Number(t.avg) * 100) }))}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Breakdown by {DIMS.find((d) => d.value === dim1)?.label}{dim2 !== "none" ? ` × ${DIMS.find((d) => d.value === dim2)?.label}` : ""}</CardTitle>
          <CardDescription>Click a row to drill in. Bands count students by their average mastery within that row.</CardDescription>
        </CardHeader>
        <CardContent>
          {!sortedRows ? <Skeleton className="h-40" /> : sortedRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No data for these filters. {options && options.teachers.length === 0 && <>No teachers at <strong>{options.school}</strong> have set their school yet — ask them to add it in Settings.</>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead col="label1" sort={sort} onSort={setSortCol}>{DIMS.find((d) => d.value === dim1)?.label}</SortHead>
                    {dim2 !== "none" && <SortHead col="label2" sort={sort} onSort={setSortCol}>{DIMS.find((d) => d.value === dim2)?.label}</SortHead>}
                    {dim1 !== "teacher" && dim2 !== "teacher" && <SortHead col="teacher_count" sort={sort} onSort={setSortCol} right>Teachers</SortHead>}
                    {dim1 !== "course" && dim2 !== "course" && <SortHead col="class_count" sort={sort} onSort={setSortCol} right>Classes</SortHead>}
                    <SortHead col="student_count" sort={sort} onSort={setSortCol} right>Students</SortHead>
                    <SortHead col="standards_assessed" sort={sort} onSort={setSortCol} right>Standards</SortHead>
                    <SortHead col="avg_mastery" sort={sort} onSort={setSortCol} right>Avg mastery</SortHead>
                    <SortHead col="pct_mastered" sort={sort} onSort={setSortCol} right>% mastered</SortHead>
                    <TableHead className="text-right">Bands</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r) => {
                    const total = r.basic + r.proficient + r.advanced || 1;
                    return (
                      <TableRow key={`${r.key1}|${r.key2 ?? ""}`} className="cursor-pointer" onClick={() => drill(r, dim2 !== "none" && dim2 === "student" ? 2 : 1)}>
                        <TableCell className="font-medium">{nameFor(r.key1, r.label1, dim1)}</TableCell>
                        {dim2 !== "none" && <TableCell>{nameFor(r.key2 ?? "", r.label2 ?? "—", dim2 as Dim)}</TableCell>}
                        {dim1 !== "teacher" && dim2 !== "teacher" && <TableCell className="text-right tabular-nums">{r.teacher_count}</TableCell>}
                        {dim1 !== "course" && dim2 !== "course" && <TableCell className="text-right tabular-nums">{r.class_count}</TableCell>}
                        <TableCell className="text-right tabular-nums">{r.student_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.standards_assessed}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Badge variant="outline" className={cn(r.avg_mastery != null && Number(r.avg_mastery) >= 0.8 && "border-transparent bg-[hsl(140_55%_42%/0.15)]", r.avg_mastery != null && Number(r.avg_mastery) < 0.6 && "border-transparent bg-[hsl(0_70%_55%/0.15)]")}>{pct(r.avg_mastery)}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pct(r.pct_mastered)}</TableCell>
                        <TableCell>
                          <div className="flex h-2.5 w-32 ml-auto rounded-full overflow-hidden bg-muted" title={`Basic ${r.basic} · Proficient ${r.proficient} · Advanced ${r.advanced}`}>
                            <div style={{ width: `${(r.basic / total) * 100}%`, background: BAND_COLORS.basic }} />
                            <div style={{ width: `${(r.proficient / total) * 100}%`, background: BAND_COLORS.proficient }} />
                            <div style={{ width: `${(r.advanced / total) * 100}%`, background: BAND_COLORS.advanced }} />
                          </div>
                        </TableCell>
                        <TableCell className="w-8 text-muted-foreground"><ChevronRight className="h-4 w-4" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ icon: Icon, label, value }: { icon: any; label: string; value: number | string | undefined }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-soft">
      <Icon className="h-4 w-4 text-accent mb-3" />
      <div className="text-2xl sm:text-3xl font-display font-semibold tabular-nums text-primary leading-none">
        {value === undefined ? <Skeleton className="h-8 w-14" /> : value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-2 uppercase tracking-wider font-medium">{label}</div>
    </div>
  );
}

function SortHead({ col, sort, onSort, right, children }: { col: keyof Row; sort: { col: keyof Row; dir: 1 | -1 }; onSort: (c: keyof Row) => void; right?: boolean; children: React.ReactNode }) {
  return (
    <TableHead className={cn(right && "text-right")}>
      <button type="button" className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.col === col && "text-foreground font-semibold")} onClick={() => onSort(col)}>
        {children} <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );
}

function MultiPicker({ label, items, selected, onChange }: { label: string; items: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const shown = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={selected.length ? "secondary" : "outline"} size="sm" className="h-9 rounded-full">
          {label}{selected.length ? <Badge className="ml-1.5 h-5 px-1.5" variant="default">{selected.length}</Badge> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        {items.length > 8 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} className="h-8 mb-2" />}
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {shown.length === 0 && <div className="text-xs text-muted-foreground p-2">Nothing available.</div>}
          {shown.map((i) => {
            const on = selected.includes(i.value);
            return (
              <label key={i.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary cursor-pointer">
                <Checkbox checked={on} onCheckedChange={(c) => onChange(c ? [...selected, i.value] : selected.filter((v) => v !== i.value))} />
                <span className="truncate">{i.label}</span>
              </label>
            );
          })}
        </div>
        {selected.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-1 h-8" onClick={() => onChange([])}>Clear</Button>}
      </PopoverContent>
    </Popover>
  );
}
