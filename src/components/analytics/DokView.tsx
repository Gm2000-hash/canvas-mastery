// Depth of Knowledge analytics: coverage + performance by DOK level, per
// standard × DOK (to expose gaps), and over time.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Link } from "react-router-dom";
import { FRAMEWORKS } from "@/lib/frameworks";
import { DOK_LEVELS, dokName } from "@/components/library/libraryTypes";

type BreakdownRow = { dok_level: number | null; question_count: number; standards_covered: number; responses: number; students: number; avg_pct_correct: number | null };
type MatrixRow = { standard_id: string; code: string; description: string; subject: string; framework: string; dok_level: number | null; question_count: number; responses: number; avg_pct_correct: number | null };
type TrendRow = { bucket_label: string; bucket_ts: string | null; dok_level: number | null; question_count: number; responses: number; avg_pct_correct: number | null };

const DOK_COLOR: Record<string, string> = {
  "1": "hsl(38 92% 50%)",
  "2": "hsl(160 84% 39%)",
  "3": "hsl(217 91% 60%)",
  "4": "hsl(262 83% 58%)",
  untagged: "hsl(0 0% 60%)",
};
const dokKey = (l: number | null) => (l == null ? "untagged" : String(l));
const dokTitle = (l: number | null) => (l == null ? "Untagged" : `DOK ${l}`);

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(Number(n) * 100).toFixed(0)}%`;
}
function scoreColor(n: number | null | undefined) {
  if (n == null) return undefined;
  const v = Number(n);
  return v >= 0.8 ? "hsl(var(--mastery-high, 160 84% 39%))" : v >= 0.6 ? "hsl(var(--mastery-mid, 38 92% 50%))" : "hsl(var(--mastery-low, 0 84% 60%))";
}

export function DokView({ courseId, subjects }: { courseId: string | null; subjects: string[] }) {
  const [subject, setSubject] = useState("ALL");
  const [framework, setFramework] = useState("ALL");
  const [granularity, setGranularity] = useState<"week" | "month">("week");
  const [filter, setFilter] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownRow[] | null>(null);
  const [matrix, setMatrix] = useState<MatrixRow[] | null>(null);
  const [trends, setTrends] = useState<TrendRow[] | null>(null);

  const subj = subject === "ALL" ? null : subject;
  const fw = framework === "ALL" ? null : framework;

  useEffect(() => {
    setBreakdown(null); setMatrix(null);
    supabase.rpc("analytics_dok_breakdown" as any, { _course_id: courseId, _subject: subj, _framework: fw })
      .then(({ data }) => setBreakdown((data as any) ?? []));
    supabase.rpc("analytics_dok_standard_matrix" as any, { _course_id: courseId, _subject: subj, _framework: fw })
      .then(({ data }) => setMatrix((data as any) ?? []));
  }, [courseId, subj, fw]);

  useEffect(() => {
    setTrends(null);
    supabase.rpc("analytics_dok_trends" as any, { _course_id: courseId, _subject: subj, _granularity: granularity })
      .then(({ data }) => setTrends((data as any) ?? []));
  }, [courseId, subj, granularity]);

  const totalQuestions = (breakdown ?? []).reduce((a, r) => a + r.question_count, 0);
  const untagged = (breakdown ?? []).find((r) => r.dok_level == null)?.question_count ?? 0;

  // Standard × DOK pivot
  const pivot = useMemo(() => {
    const byStd = new Map<string, { code: string; description: string; framework: string; cells: Record<string, { q: number; r: number; avg: number | null }> }>();
    for (const r of matrix ?? []) {
      const e = byStd.get(r.standard_id) ?? { code: r.code, description: r.description, framework: r.framework, cells: {} };
      e.cells[dokKey(r.dok_level)] = { q: r.question_count, r: r.responses, avg: r.avg_pct_correct };
      byStd.set(r.standard_id, e);
    }
    let rows = Array.from(byStd.entries()).map(([id, v]) => ({ id, ...v }));
    const f = filter.trim().toLowerCase();
    if (f) rows = rows.filter((r) => r.code.toLowerCase().includes(f) || r.description.toLowerCase().includes(f));
    if (gapsOnly) rows = rows.filter((r) => !(r.cells["2"]?.q) || !(r.cells["3"]?.q));
    return rows.sort((a, b) => a.code.localeCompare(b.code));
  }, [matrix, filter, gapsOnly]);

  const gapCount = useMemo(() => pivot.filter((r) => !(r.cells["2"]?.q) || !(r.cells["3"]?.q)).length, [pivot]);

  // Trend pivot: one row per bucket, one series per DOK level
  const { chartData, seriesKeys } = useMemo(() => {
    const buckets = new Map<string, any>();
    const keys = new Set<string>();
    for (const r of trends ?? []) {
      if (r.avg_pct_correct == null) continue;
      const k = dokTitle(r.dok_level);
      keys.add(k);
      const b = buckets.get(r.bucket_label) ?? { bucket: r.bucket_label, _ts: r.bucket_ts };
      b[k] = Math.round(Number(r.avg_pct_correct) * 100);
      buckets.set(r.bucket_label, b);
    }
    const order = ["DOK 1", "DOK 2", "DOK 3", "DOK 4", "Untagged"];
    return {
      chartData: Array.from(buckets.values()).sort((a, b) => (a._ts || "").localeCompare(b._ts || "")),
      seriesKeys: order.filter((k) => keys.has(k)),
    };
  }, [trends]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Depth of Knowledge coverage</CardTitle>
              <CardDescription>How much of your assessment sits at each DOK level, and how students perform there. Gaps at DOK 2–3 mean a standard has only been checked at recall.</CardDescription>
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All subjects</SelectItem>
                    {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Framework</Label>
                <Select value={framework} onValueChange={setFramework}>
                  <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All frameworks</SelectItem>
                    {FRAMEWORKS.map((f) => <SelectItem key={f.id} value={f.id}>{f.shortLabel}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {breakdown === null ? <Skeleton className="h-28 w-full" /> : totalQuestions === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No questions in this scope yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[...DOK_LEVELS.map((d) => d.level), null].map((lvl) => {
                const r = breakdown.find((b) => (b.dok_level ?? null) === lvl);
                const share = r ? r.question_count / totalQuestions : 0;
                return (
                  <div key={dokKey(lvl)} className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: DOK_COLOR[dokKey(lvl)] + "66" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm" style={{ color: DOK_COLOR[dokKey(lvl)] }}>{dokTitle(lvl)}</span>
                      <span className="text-xs text-muted-foreground">{lvl == null ? "no level yet" : dokName(lvl)}</span>
                    </div>
                    <div className="text-2xl font-semibold tabular-nums">{r?.question_count ?? 0}<span className="text-xs font-normal text-muted-foreground ml-1">q · {(share * 100).toFixed(0)}%</span></div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: DOK_COLOR[dokKey(lvl)] }} /></div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{r?.standards_covered ?? 0} standards</span>
                      <span style={{ color: scoreColor(r?.avg_pct_correct) }} className="font-medium">{pct(r?.avg_pct_correct)} correct</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {untagged > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {untagged.toLocaleString()} question{untagged === 1 ? " has" : "s have"} no DOK level yet — run <Link to="/app/library" className="underline">Tag everything with DOK</Link> in the Library.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Performance by DOK over time</CardTitle>
              <CardDescription>Average % correct per DOK level. A DOK 1 line far above DOK 3 signals students recall but struggle to reason.</CardDescription>
            </div>
            <div className="flex rounded-md border overflow-hidden h-9">
              {(["week", "month"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGranularity(g)}
                  className={`px-3 text-xs font-medium transition ${granularity === g ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                  {g === "week" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trends === null ? <Skeleton className="h-72 w-full" /> : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No question-level scores yet. Import quiz scores from the Question bank to see trends.</p>
          ) : (
            <ChartContainer config={Object.fromEntries(seriesKeys.map((k) => [k, { label: k, color: DOK_COLOR[k === "Untagged" ? "untagged" : k.replace("DOK ", "")] }]))} className="h-80 w-full">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {seriesKeys.map((k) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={DOK_COLOR[k === "Untagged" ? "untagged" : k.replace("DOK ", "")]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Standard × DOK</CardTitle>
              <CardDescription>Questions and % correct for each standard at each level. "—" is a gap: that standard has never been assessed at that depth.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter standards…" className="h-9 w-[200px]" />
              <button type="button" onClick={() => setGapsOnly((v) => !v)}
                className={`h-9 px-3 rounded-md border text-xs font-medium transition ${gapsOnly ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                Gaps only{matrix && gapCount > 0 ? ` (${gapCount})` : ""}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {matrix === null ? <Skeleton className="h-60 w-full m-6" /> : pivot.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{gapsOnly ? "No gaps — every standard here is assessed at DOK 2 and 3." : "No tagged questions in this scope yet."}</p>
          ) : (
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="min-w-[260px]">Standard</TableHead>
                    {DOK_LEVELS.map((d) => <TableHead key={d.level} className="text-center" style={{ color: DOK_COLOR[String(d.level)] }}>DOK {d.level}</TableHead>)}
                    <TableHead className="text-center text-muted-foreground">Untagged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pivot.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2"><span className="font-code text-sm">{r.code}</span><Badge variant="outline" className="text-[10px]">{r.framework}</Badge></div>
                        <div className="text-xs text-muted-foreground line-clamp-1" title={r.description}>{r.description}</div>
                      </TableCell>
                      {[...DOK_LEVELS.map((d) => String(d.level)), "untagged"].map((k) => {
                        const c = r.cells[k];
                        const gap = !c?.q && k !== "untagged" && (k === "2" || k === "3");
                        return (
                          <TableCell key={k} className={`text-center tabular-nums ${gap ? "bg-destructive/5" : ""}`}>
                            {c?.q ? (
                              <div>
                                <div className="font-medium" style={{ color: scoreColor(c.avg) }}>{pct(c.avg)}</div>
                                <div className="text-[11px] text-muted-foreground">{c.q} q · {c.r} resp</div>
                              </div>
                            ) : <span className={gap ? "text-destructive/70" : "text-muted-foreground/50"}>—</span>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
