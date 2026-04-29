// Department report builder — generates configurable data tables and charts
// (bar, line, heatmap, box-plot) with grouping, filtering, aggregation, sort
// & top-N controls, plus CSV / PNG / PDF exports.
//
// Privacy: this component never fetches raw peer data. All data comes from
// the security-definer RPCs already in use by DepartmentDashboard, which
// pseudonymize peers before returning rows.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { Download, Image as ImageIcon, FileText, RefreshCcw } from "lucide-react";
import { ChartContainer } from "@/components/ui/chart";

// ---------- Types ----------
type Dataset = "standards" | "classes" | "students" | "assessments" | "matrix" | "studentStandard";
type ChartKind = "table" | "bar" | "line" | "heatmap" | "box";
type Aggregation = "avg" | "median" | "pct_mastered" | "attempts" | "count";

type Props = {
  subject: string;
  schoolYear: string;
  grades: string[]; // empty = all
};

type StandardRow = { standard_id: string; code: string; description: string; grade: string; framework: string; students_assessed: number; students_mastered: number; avg_mastery: number | null; pct_mastered: number | null };
type ClassRow = { course_id: string; is_own: boolean; display_label: string; grade: string | null; student_count: number; avg_mastery: number | null; pct_mastered: number | null };
type StudentRow = { student_id: string; is_own: boolean; display_name: string; class_label: string; grade: string | null; standards_assessed: number; standards_mastered: number; avg_mastery: number | null; last_activity: string | null };
type AssessmentRow = { name_normalized: string; display_name: string; teacher_count: number; class_count: number; submission_count: number; avg_percentage: number | null; standards_tagged: number };
type MatrixRow = { standard_id: string; standard_code: string; standard_description: string; standard_grade: string; course_id: string; is_own: boolean; class_label: string; class_grade: string | null; students_assessed: number; students_mastered: number; avg_mastery: number | null; pct_mastered: number | null };
type StudentStandardRow = { student_id: string; is_own: boolean; student_label: string; class_label: string; standard_id: string; standard_code: string; mastery_score: number | null; mastered: boolean };

const DATASET_OPTIONS: { value: Dataset; label: string; description: string }[] = [
  { value: "standards", label: "Standards summary", description: "Mastery rolled up per standard" },
  { value: "classes", label: "Classes summary", description: "Mastery rolled up per class" },
  { value: "students", label: "Students summary", description: "Mastery rolled up per student" },
  { value: "assessments", label: "Common assessments", description: "Assessments matched across teachers" },
  { value: "matrix", label: "Standards × Classes matrix", description: "Heatmap-ready grid" },
  { value: "studentStandard", label: "Students × Standards matrix", description: "Per-student mastery on each standard" },
];

const GROUP_BY_FOR: Record<Dataset, { value: string; label: string }[]> = {
  standards: [{ value: "code", label: "Standard" }, { value: "grade", label: "Grade" }, { value: "framework", label: "Framework" }],
  classes: [{ value: "display_label", label: "Class" }, { value: "grade", label: "Grade" }, { value: "owner", label: "Owner (you / peer)" }],
  students: [{ value: "display_name", label: "Student" }, { value: "class_label", label: "Class" }, { value: "grade", label: "Grade" }, { value: "owner", label: "Owner (you / peer)" }],
  assessments: [{ value: "display_name", label: "Assessment" }],
  matrix: [{ value: "standard_code", label: "Standard" }, { value: "class_label", label: "Class" }, { value: "standard_grade", label: "Grade" }],
  studentStandard: [{ value: "student_label", label: "Student" }, { value: "standard_code", label: "Standard" }, { value: "class_label", label: "Class" }],
};

const AGG_OPTIONS_FOR: Record<Dataset, { value: Aggregation; label: string }[]> = {
  standards: [
    { value: "avg", label: "Avg mastery" },
    { value: "pct_mastered", label: "% mastered" },
    { value: "attempts", label: "Students assessed" },
    { value: "count", label: "Row count" },
  ],
  classes: [
    { value: "avg", label: "Avg mastery" },
    { value: "pct_mastered", label: "% mastered" },
    { value: "attempts", label: "Students" },
    { value: "count", label: "Row count" },
  ],
  students: [
    { value: "avg", label: "Avg mastery" },
    { value: "pct_mastered", label: "% mastered" },
    { value: "attempts", label: "Standards assessed" },
    { value: "median", label: "Median mastery" },
    { value: "count", label: "Row count" },
  ],
  assessments: [
    { value: "avg", label: "Avg %" },
    { value: "attempts", label: "Submissions" },
    { value: "count", label: "Row count" },
  ],
  matrix: [
    { value: "avg", label: "Avg mastery" },
    { value: "pct_mastered", label: "% mastered" },
  ],
  studentStandard: [
    { value: "avg", label: "Avg mastery" },
    { value: "pct_mastered", label: "% mastered" },
  ],
};

const CHART_OPTIONS_FOR: Record<Dataset, ChartKind[]> = {
  standards: ["table", "bar", "line"],
  classes: ["table", "bar"],
  students: ["table", "bar", "box"],
  assessments: ["table", "bar"],
  matrix: ["table", "heatmap", "bar"],
  studentStandard: ["table", "heatmap", "box"],
};

function median(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}
function pct(n: number | null | undefined, digits = 0) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(digits)}%`;
}
function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString();
}

export default function DepartmentReports({ subject, schoolYear, grades }: Props) {
  // ---------- Configuration state ----------
  const [dataset, setDataset] = useState<Dataset>("standards");
  const [groupBy, setGroupBy] = useState<string>("code");
  const [aggregation, setAggregation] = useState<Aggregation>("avg");
  const [chart, setChart] = useState<ChartKind>("table");
  const [topN, setTopN] = useState<string>("25");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [scopeOwn, setScopeOwn] = useState<"all" | "own" | "peers">("all");

  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<any[]>([]);

  const exportRef = useRef<HTMLDivElement>(null);

  // Reset dependent fields when dataset changes
  useEffect(() => {
    const gOpts = GROUP_BY_FOR[dataset];
    setGroupBy(gOpts[0].value);
    const aOpts = AGG_OPTIONS_FOR[dataset];
    setAggregation(aOpts[0].value);
    const cOpts = CHART_OPTIONS_FOR[dataset];
    if (!cOpts.includes(chart)) setChart(cOpts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  // ---------- Data fetching ----------
  async function runQuery() {
    setLoading(true);
    const _grades = grades.length ? grades : null;
    const args = { _subject: subject, _grades, _school_year: schoolYear };
    let data: any = null;
    if (dataset === "standards") {
      const res = await supabase.rpc("department_standards", args);
      data = res.data ?? [];
    } else if (dataset === "classes") {
      const res = await supabase.rpc("department_classes", args);
      data = res.data ?? [];
    } else if (dataset === "students") {
      const res = await supabase.rpc("department_students", args);
      data = res.data ?? [];
    } else if (dataset === "assessments") {
      const res = await supabase.rpc("department_assessments", args);
      data = res.data ?? [];
    } else if (dataset === "matrix") {
      const res = await supabase.rpc("department_standard_class_matrix", args);
      data = res.data ?? [];
    } else if (dataset === "studentStandard") {
      const res = await supabase.rpc("department_student_standard_matrix", args);
      data = res.data ?? [];
    }
    setRawRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  // Re-run on filter / dataset changes
  useEffect(() => { runQuery(); /* eslint-disable-next-line */ }, [dataset, subject, schoolYear, JSON.stringify(grades)]);

  // ---------- Derived: filter + group + aggregate ----------
  const filteredRows = useMemo(() => {
    let rows = rawRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    }
    if (scopeOwn !== "all" && rows.length && "is_own" in rows[0]) {
      rows = rows.filter((r) => (scopeOwn === "own" ? r.is_own : !r.is_own));
    }
    return rows;
  }, [rawRows, search, scopeOwn]);

  // Aggregation engine: returns rows of {key, value, n, raw}
  const aggregated = useMemo(() => {
    if (!filteredRows.length) return [] as { key: string; value: number | null; n: number; raw?: any }[];
    const groups = new Map<string, any[]>();
    for (const r of filteredRows) {
      let key: string;
      if (groupBy === "owner") key = r.is_own ? "You" : "Peers";
      else key = String(r[groupBy] ?? "—");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const out: { key: string; value: number | null; n: number; raw?: any[] }[] = [];
    for (const [key, items] of groups.entries()) {
      let value: number | null = null;
      if (aggregation === "count") value = items.length;
      else if (aggregation === "avg") {
        const nums = items.map((i) => Number(i.avg_mastery ?? i.avg_percentage ?? i.mastery_score)).filter((n) => Number.isFinite(n));
        // assessments uses 0-100 already; mastery uses 0-1
        value = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      } else if (aggregation === "median") {
        const nums = items.map((i) => Number(i.avg_mastery ?? i.mastery_score)).filter((n) => Number.isFinite(n));
        value = median(nums);
      } else if (aggregation === "pct_mastered") {
        const nums = items.map((i) => Number(i.pct_mastered)).filter((n) => Number.isFinite(n));
        if (nums.length) value = nums.reduce((a, b) => a + b, 0) / nums.length;
        else {
          // fallback for studentStandard: share of `mastered=true`
          const masteredCount = items.filter((i) => i.mastered === true).length;
          value = items.length ? masteredCount / items.length : null;
        }
      } else if (aggregation === "attempts") {
        const candidates = ["students_assessed", "student_count", "submission_count", "standards_assessed"];
        const sum = items.reduce((acc, i) => {
          for (const c of candidates) if (i[c] != null) return acc + Number(i[c]);
          return acc;
        }, 0);
        value = sum;
      }
      out.push({ key, value, n: items.length, raw: items });
    }
    // Sort
    out.sort((a, b) => {
      const av = a.value ?? -Infinity;
      const bv = b.value ?? -Infinity;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    const n = parseInt(topN, 10);
    return Number.isFinite(n) && n > 0 ? out.slice(0, n) : out;
  }, [filteredRows, groupBy, aggregation, sortDir, topN]);

  // Heatmap-specific data: rows = standards, cols = classes (or students × standards)
  const heatmap = useMemo(() => {
    if (dataset !== "matrix" && dataset !== "studentStandard") return null;
    const rowKey = dataset === "matrix" ? "standard_code" : "student_label";
    const colKey = dataset === "matrix" ? "class_label" : "standard_code";
    const valueKey = dataset === "matrix"
      ? (aggregation === "pct_mastered" ? "pct_mastered" : "avg_mastery")
      : "mastery_score";
    const rowsSet = new Set<string>();
    const colsSet = new Set<string>();
    const map = new Map<string, number | null>();
    for (const r of filteredRows) {
      const rk = String(r[rowKey] ?? "—");
      const ck = String(r[colKey] ?? "—");
      rowsSet.add(rk); colsSet.add(ck);
      const v = r[valueKey];
      map.set(`${rk}|${ck}`, v == null ? null : Number(v));
    }
    const rowList = Array.from(rowsSet).sort();
    const colList = Array.from(colsSet).sort();
    const limit = parseInt(topN, 10) || 25;
    return {
      rows: rowList.slice(0, limit),
      cols: colList.slice(0, Math.min(colList.length, 20)),
      get: (r: string, c: string) => map.get(`${r}|${c}`) ?? null,
    };
  }, [filteredRows, dataset, aggregation, topN]);

  // Box-plot data per group
  const boxData = useMemo(() => {
    if (chart !== "box") return [];
    const groups = new Map<string, number[]>();
    for (const r of filteredRows) {
      const key = groupBy === "owner" ? (r.is_own ? "You" : "Peers") : String(r[groupBy] ?? "—");
      const v = Number(r.avg_mastery ?? r.mastery_score);
      if (Number.isFinite(v)) {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(v);
      }
    }
    const out: any[] = [];
    for (const [key, nums] of groups.entries()) {
      const sorted = [...nums].sort((a, b) => a - b);
      const min = sorted[0] ?? 0;
      const max = sorted[sorted.length - 1] ?? 0;
      const q1 = quantile(sorted, 0.25);
      const med = quantile(sorted, 0.5);
      const q3 = quantile(sorted, 0.75);
      out.push({ key, min, q1, median: med, q3, max, n: nums.length });
    }
    out.sort((a, b) => b.median - a.median);
    const n = parseInt(topN, 10);
    return Number.isFinite(n) && n > 0 ? out.slice(0, n) : out;
  }, [filteredRows, chart, groupBy, topN]);

  // ---------- Exports ----------
  function exportCsv() {
    let headers: string[]; let rows: any[][];
    if (chart === "box") {
      headers = ["Group", "n", "Min", "Q1", "Median", "Q3", "Max"];
      rows = boxData.map((b) => [b.key, b.n, b.min, b.q1, b.median, b.q3, b.max]);
    } else if (heatmap && (chart === "heatmap" || chart === "table") && (dataset === "matrix" || dataset === "studentStandard")) {
      headers = [dataset === "matrix" ? "Standard" : "Student", ...heatmap.cols];
      rows = heatmap.rows.map((r) => [r, ...heatmap.cols.map((c) => heatmap.get(r, c))]);
    } else {
      headers = ["Group", "Value", "n"];
      rows = aggregated.map((r) => [r.key, r.value, r.n]);
    }
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${subject}-${dataset}-${chart}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPng() {
    if (!exportRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(exportRef.current, { backgroundColor: "#ffffff", scale: 2 });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${subject}-${dataset}-${chart}.png`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  async function exportPdf() {
    if (!exportRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const { default: jsPDF } = await import("jspdf");
    const canvas = await html2canvas(exportRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 36;
    pdf.setFontSize(14);
    pdf.text(`${subject} Department — ${DATASET_OPTIONS.find((d) => d.value === dataset)?.label}`, margin, margin);
    pdf.setFontSize(10);
    pdf.text(`School year: ${schoolYear}${grades.length ? ` · Grades: ${grades.join(", ")}` : ""}`, margin, margin + 16);
    const ratio = canvas.width / canvas.height;
    let w = pageW - margin * 2;
    let h = w / ratio;
    if (h > pageH - margin * 2 - 40) {
      h = pageH - margin * 2 - 40;
      w = h * ratio;
    }
    pdf.addImage(img, "PNG", margin, margin + 30, w, h);
    pdf.save(`${subject}-${dataset}-${chart}.pdf`);
  }

  // ---------- Color scale for heatmap (uses semantic tokens) ----------
  function heatColor(v: number | null): string {
    if (v == null) return "hsl(var(--muted))";
    // 0..1 mastery → red(low) → yellow(mid) → green(high)
    const n = Math.max(0, Math.min(1, v));
    const hue = Math.round(n * 130); // 0=red, 130=green-ish
    return `hsl(${hue} 70% 55% / ${0.25 + n * 0.6})`;
  }

  // ---------- Render ----------
  const datasetLabel = DATASET_OPTIONS.find((d) => d.value === dataset)?.label ?? dataset;
  const aggLabel = AGG_OPTIONS_FOR[dataset].find((a) => a.value === aggregation)?.label ?? aggregation;

  return (
    <div className="space-y-4">
      {/* Builder controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report builder</CardTitle>
          <CardDescription>
            Combine grouping, aggregation, and chart type. Real names appear only for your own students and classes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Dataset">
              <Select value={dataset} onValueChange={(v) => setDataset(v as Dataset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATASET_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Group by">
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GROUP_BY_FOR[dataset].map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Aggregation">
              <Select value={aggregation} onValueChange={(v) => setAggregation(v as Aggregation)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGG_OPTIONS_FOR[dataset].map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Chart">
              <Select value={chart} onValueChange={(v) => setChart(v as ChartKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHART_OPTIONS_FOR[dataset].map((o) => (
                    <SelectItem key={o} value={o}>{labelForChart(o)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Sort">
              <Select value={sortDir} onValueChange={(v) => setSortDir(v as "asc" | "desc")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Highest first</SelectItem>
                  <SelectItem value="asc">Lowest first</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Top N">
              <Input type="number" min={1} max={500} value={topN} onChange={(e) => setTopN(e.target.value)} />
            </Field>
            <Field label="Scope">
              <Select value={scopeOwn} onValueChange={(v) => setScopeOwn(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teachers</SelectItem>
                  <SelectItem value="own">Only mine</SelectItem>
                  <SelectItem value="peers">Only peers</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Search">
              <Input placeholder="Filter rows…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={runQuery} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={loading || !filteredRows.length}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportPng} disabled={loading || !filteredRows.length}>
              <ImageIcon className="h-4 w-4 mr-1" /> PNG
            </Button>
            <Button size="sm" variant="outline" onClick={exportPdf} disabled={loading || !filteredRows.length}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Badge variant="secondary" className="ml-auto self-center">
              {filteredRows.length.toLocaleString()} rows · {datasetLabel}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Output */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{datasetLabel} — {labelForChart(chart)}</CardTitle>
          <CardDescription>
            {chart === "table" ? "Grouped & aggregated data" : `Aggregation: ${aggLabel}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={exportRef} className="bg-background p-3 rounded-md">
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : !filteredRows.length ? (
              <div className="text-center text-muted-foreground py-12 text-sm">No data for the current filters.</div>
            ) : chart === "table" ? (
              renderTable()
            ) : chart === "bar" ? (
              renderBar()
            ) : chart === "line" ? (
              renderLine()
            ) : chart === "heatmap" ? (
              renderHeatmap()
            ) : chart === "box" ? (
              renderBox()
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ---------- Renderers ----------
  function renderTable() {
    if ((dataset === "matrix" || dataset === "studentStandard") && heatmap) {
      return (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">{dataset === "matrix" ? "Standard" : "Student"}</TableHead>
                {heatmap.cols.map((c) => <TableHead key={c} className="text-right whitespace-nowrap">{c}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {heatmap.rows.map((r) => (
                <TableRow key={r}>
                  <TableCell className="font-medium sticky left-0 bg-background">{r}</TableCell>
                  {heatmap.cols.map((c) => {
                    const v = heatmap.get(r, c);
                    return <TableCell key={c} className="text-right tabular-nums">{v == null ? "—" : pct(v)}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead className="text-right">{aggLabel}</TableHead>
            <TableHead className="text-right">n</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {aggregated.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="font-medium">{r.key}</TableCell>
              <TableCell className="text-right tabular-nums">{formatAggValue(r.value)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(r.n)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  function renderBar() {
    const data = aggregated.map((r) => ({ key: r.key, value: r.value ?? 0, n: r.n }));
    return (
      <ChartContainer config={{ value: { label: aggLabel, color: "hsl(var(--primary))" } }} className="h-[420px]">
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(v) => isPctAgg() ? `${(v * 100).toFixed(0)}%` : String(v)} />
          <YAxis type="category" dataKey="key" tick={{ fontSize: 11 }} width={140} />
          <Tooltip formatter={(v: any) => isPctAgg() ? pct(Number(v), 1) : fmtNum(Number(v))} />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    );
  }

  function renderLine() {
    const data = aggregated.map((r) => ({ key: r.key, value: r.value ?? 0 }));
    return (
      <ChartContainer config={{ value: { label: aggLabel, color: "hsl(var(--primary))" } }} className="h-[360px]">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="key" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={70} interval={0} />
          <YAxis tickFormatter={(v) => isPctAgg() ? `${(v * 100).toFixed(0)}%` : String(v)} />
          <Tooltip formatter={(v: any) => isPctAgg() ? pct(Number(v), 1) : fmtNum(Number(v))} />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
        </LineChart>
      </ChartContainer>
    );
  }

  function renderHeatmap() {
    if (!heatmap) return <div className="text-sm text-muted-foreground">Heatmap requires the Standards × Classes or Students × Standards dataset.</div>;
    return (
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background p-2 text-left">{dataset === "matrix" ? "Standard" : "Student"}</th>
              {heatmap.cols.map((c) => (
                <th key={c} className="p-2 text-left whitespace-nowrap font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((r) => (
              <tr key={r}>
                <td className="sticky left-0 bg-background p-2 font-medium whitespace-nowrap">{r}</td>
                {heatmap.cols.map((c) => {
                  const v = heatmap.get(r, c);
                  return (
                    <td
                      key={c}
                      className="p-2 text-center tabular-nums border border-border"
                      style={{ backgroundColor: heatColor(v), minWidth: 64 }}
                      title={`${r} × ${c}: ${v == null ? "no data" : pct(v, 1)}`}
                    >
                      {v == null ? "—" : pct(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <span>0%</span>
          <div className="h-2 w-40 rounded" style={{ background: "linear-gradient(to right, hsl(0 70% 55% / 0.3), hsl(60 70% 55% / 0.6), hsl(130 70% 55% / 0.85))" }} />
          <span>100%</span>
        </div>
      </div>
    );
  }

  function renderBox() {
    // Custom box-plot rendered with composed Bars (whiskers as thin bars)
    return (
      <ChartContainer config={{ box: { label: "Box", color: "hsl(var(--primary))" } }} className="h-[420px]">
        <BarChart data={boxData} margin={{ left: 60, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="key" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} interval={0} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d: any = payload[0].payload;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow">
                  <div className="font-medium">{d.key}</div>
                  <div>n = {d.n}</div>
                  <div>min: {pct(d.min, 1)}</div>
                  <div>Q1: {pct(d.q1, 1)}</div>
                  <div>median: {pct(d.median, 1)}</div>
                  <div>Q3: {pct(d.q3, 1)}</div>
                  <div>max: {pct(d.max, 1)}</div>
                </div>
              );
            }}
          />
          {/* Stack: invisible (q1) + box body (q3-q1) + median dot drawn via Cell color shift */}
          <Bar dataKey="q1" stackId="box" fill="transparent" />
          <Bar dataKey={(d: any) => d.q3 - d.q1} stackId="box" fill="hsl(var(--primary) / 0.5)" name="IQR">
            {boxData.map((_, i) => <Cell key={i} fill="hsl(var(--primary) / 0.5)" />)}
          </Bar>
          {/* Whisker line from min to max via separate Bar overlay */}
          <Bar dataKey={(d: any) => d.max - d.min} fill="transparent" stroke="hsl(var(--primary))" strokeWidth={1} />
        </BarChart>
      </ChartContainer>
    );
  }

  function isPctAgg() {
    return aggregation === "avg" || aggregation === "median" || aggregation === "pct_mastered";
  }
  function formatAggValue(v: number | null) {
    if (v == null) return "—";
    if (aggregation === "count" || aggregation === "attempts") return fmtNum(v);
    // assessments avg is 0-100, treat values >1.5 as percentage points
    if (Number(v) > 1.5) return `${Number(v).toFixed(1)}%`;
    return pct(v, 1);
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

function labelForChart(c: ChartKind) {
  return c === "table" ? "Data table"
    : c === "bar" ? "Bar chart"
    : c === "line" ? "Line chart"
    : c === "heatmap" ? "Heatmap"
    : "Box plot";
}
