// Question Bank — browse imported quiz questions organized by standard / substandard.
// Pulls aggregated counts from the analytics_question_bank RPC, then lazy-loads
// individual questions per standard.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Library, Search, ChevronRight, ChevronDown, Sparkles, Download, Loader2,
  ExternalLink, BookOpen, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type BankRow = {
  standard_id: string;
  code: string;
  parent_code: string;
  description: string;
  framework: string;
  subject: string;
  grade: string;
  tagged_question_count: number;
  response_count: number;
  avg_pct_correct: number | null;
};

type Course = { id: string; name: string };

type QuestionRow = {
  id: string;
  position: number | null;
  question_text: string | null;
  points_possible: number | null;
  assignment_id: string;
  assignments: { id: string; name: string; course_id: string } | null;
  // computed
  response_count?: number;
  avg_pct?: number | null;
  standards?: { code: string; description: string }[];
  is_suggested_only?: boolean; // true when none of this question's tags are confirmed
};

type TreeNode = {
  code: string;
  row?: BankRow;
  children: Map<string, TreeNode>;
  totals: { questions: number; responses: number; weightedPct: number; weight: number };
};

type StatusFilter = "ALL" | "SUGGESTED" | "CONFIRMED";

export default function QuestionBank() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("ALL");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [bank, setBank] = useState<BankRow[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedStandardId, setSelectedStandardId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [loadingQs, setLoadingQs] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<QuestionRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<
    { name: string; status: "ok" | "skipped" | "error"; responses: number; reason?: string }[] | null
  >(null);

  // --- Load courses ---
  useEffect(() => {
    supabase.from("courses").select("id, name").order("name").then(({ data }) => {
      setCourses((data ?? []) as Course[]);
    });
  }, []);

  // Build the bank ourselves so we can include AI-suggested rows (the
  // analytics_question_bank RPC only counts confirmed=true).
  async function loadBank() {
    setBank(null);

    // 1) Pull tags filtered by status, joined to question -> assignment -> course
    let tagsQuery = supabase
      .from("question_standards")
      .select("standard_id, ai_suggested, confirmed, quiz_questions!inner(id, assignment_id, assignments!inner(course_id))");
    if (statusFilter === "CONFIRMED") tagsQuery = tagsQuery.eq("confirmed", true);
    if (statusFilter === "SUGGESTED") tagsQuery = tagsQuery.eq("confirmed", false).eq("ai_suggested", true);
    const { data: tagRows, error: tErr } = await tagsQuery;
    if (tErr) { toast.error(tErr.message); setBank([]); return; }

    // Filter by course in JS (since the join is nested)
    const filteredTags = (tagRows ?? []).filter((t: any) => {
      if (courseId === "ALL") return true;
      return t.quiz_questions?.assignments?.course_id === courseId;
    });

    if (filteredTags.length === 0) { setBank([]); return; }

    // Aggregate per standard: distinct question count
    const perStd = new Map<string, { questionIds: Set<string> }>();
    for (const t of filteredTags as any[]) {
      const cur = perStd.get(t.standard_id) ?? { questionIds: new Set<string>() };
      cur.questionIds.add(t.quiz_questions.id);
      perStd.set(t.standard_id, cur);
    }
    const stdIds = Array.from(perStd.keys());

    // 2) Pull standards metadata
    const { data: stdRows } = await supabase
      .from("standards")
      .select("id, code, description, framework, subject, grade")
      .in("id", stdIds);

    // 3) Response stats — average pct correct per standard
    const allQuestionIds = Array.from(new Set(filteredTags.map((t: any) => t.quiz_questions.id)));
    const { data: respRows } = await supabase
      .from("question_responses")
      .select("question_id, points, points_possible")
      .in("question_id", allQuestionIds);
    const respByQ = new Map<string, { n: number; sumPct: number }>();
    for (const r of (respRows ?? []) as any[]) {
      const pp = Number(r.points_possible);
      if (!pp || pp <= 0 || r.points == null) continue;
      const pct = Math.max(0, Math.min(1, Number(r.points) / pp));
      const cur = respByQ.get(r.question_id) ?? { n: 0, sumPct: 0 };
      cur.n += 1; cur.sumPct += pct;
      respByQ.set(r.question_id, cur);
    }

    const rows: BankRow[] = [];
    for (const std of (stdRows ?? []) as any[]) {
      const info = perStd.get(std.id);
      if (!info) continue;
      // Apply subject/framework filters here
      if (subjectFilter !== "ALL" && std.subject !== subjectFilter) continue;
      const fw = std.framework ?? "STATE";
      if (frameworkFilter !== "ALL" && fw !== frameworkFilter) continue;
      let n = 0, sum = 0;
      for (const qid of info.questionIds) {
        const r = respByQ.get(qid);
        if (r) { n += r.n; sum += r.sumPct; }
      }
      rows.push({
        standard_id: std.id,
        code: std.code,
        parent_code: std.code.replace(/[-.][^-.]+$/, ""),
        description: std.description,
        framework: fw,
        subject: std.subject,
        grade: std.grade,
        tagged_question_count: info.questionIds.size,
        response_count: n,
        avg_pct_correct: n > 0 ? sum / n : null,
      });
    }
    setBank(rows);
  }
  useEffect(() => { loadBank(); /* eslint-disable-next-line */ }, [courseId, subjectFilter, frameworkFilter, statusFilter]);

  // --- Distinct filter options from bank rows ---
  const subjects = useMemo(() => {
    const s = new Set<string>();
    (bank ?? []).forEach((r) => s.add(r.subject));
    return Array.from(s).sort();
  }, [bank]);
  const frameworks = useMemo(() => {
    const s = new Set<string>();
    (bank ?? []).forEach((r) => s.add(r.framework));
    return Array.from(s).sort();
  }, [bank]);

  // --- Build tree from bank rows ---
  const tree = useMemo(() => {
    const root: TreeNode = { code: "", children: new Map(), totals: blankTotals() };
    if (!bank) return root;
    const filtered = bank.filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    });
    for (const row of filtered) {
      // Build chain from root → parent → row.code
      const chain = chainFor(row.code);
      let node = root;
      for (let i = 0; i < chain.length; i++) {
        const seg = chain[i];
        if (!node.children.has(seg)) {
          node.children.set(seg, { code: seg, children: new Map(), totals: blankTotals() });
        }
        node = node.children.get(seg)!;
      }
      node.row = row;
    }
    // Roll up totals
    rollup(root);
    return root;
  }, [bank, search]);

  // --- Auto-expand top-level when there are few branches ---
  useEffect(() => {
    if (!tree.children.size) return;
    if (tree.children.size <= 6) {
      setExpanded((p) => {
        const n = new Set(p);
        for (const k of tree.children.keys()) n.add(k);
        return n;
      });
    }
  }, [tree]);

  // --- Load questions for the selected standard (or descendants) ---
  useEffect(() => {
    if (!selectedStandardId || !bank) { setQuestions(null); return; }
    loadQuestionsForStandard(selectedStandardId);
    // eslint-disable-next-line
  }, [selectedStandardId, bank, courseId, statusFilter]);

  async function loadQuestionsForStandard(standardId: string) {
    setLoadingQs(true);
    setQuestions(null);
    const node = findNodeByStandardId(tree, standardId);
    const stdIds = collectStandardIds(node);
    if (stdIds.length === 0) { setQuestions([]); setLoadingQs(false); return; }

    // Pull tags honoring the status filter (default: all — confirmed AND ai-suggested)
    let qsQuery = supabase
      .from("question_standards")
      .select("question_id, standard_id, ai_suggested, confirmed, standards(code, description), quiz_questions!inner(id, position, question_text, points_possible, assignment_id, assignments!inner(id, name, course_id))")
      .in("standard_id", stdIds);
    if (statusFilter === "CONFIRMED") qsQuery = qsQuery.eq("confirmed", true);
    if (statusFilter === "SUGGESTED") qsQuery = qsQuery.eq("confirmed", false).eq("ai_suggested", true);
    const { data: qsRows, error: qsErr } = await qsQuery;
    if (qsErr) { toast.error(qsErr.message); setLoadingQs(false); return; }

    const byId = new Map<string, QuestionRow & { _anyConfirmed: boolean }>();
    for (const t of (qsRows as any[]) ?? []) {
      const q = t.quiz_questions;
      if (!q) continue;
      if (courseId !== "ALL" && q.assignments?.course_id !== courseId) continue;
      if (!byId.has(q.id)) {
        byId.set(q.id, {
          id: q.id,
          position: q.position,
          question_text: q.question_text,
          points_possible: q.points_possible,
          assignment_id: q.assignment_id,
          assignments: q.assignments,
          standards: [],
          _anyConfirmed: false,
        });
      }
      const row = byId.get(q.id)!;
      if (t.confirmed) row._anyConfirmed = true;
      const std = t.standards;
      if (std) row.standards!.push({ code: std.code, description: std.description });
    }

    const list: QuestionRow[] = Array.from(byId.values()).map((r) => ({
      ...r,
      is_suggested_only: !r._anyConfirmed,
    }));

    if (list.length) {
      const ids = list.map((q) => q.id);
      const { data: responses } = await supabase
        .from("question_responses")
        .select("question_id, points, points_possible")
        .in("question_id", ids);
      const stats = new Map<string, { n: number; sumPct: number }>();
      for (const r of (responses ?? []) as any[]) {
        const pp = Number(r.points_possible);
        if (!pp || pp <= 0 || r.points == null) continue;
        const pct = Math.max(0, Math.min(1, Number(r.points) / pp));
        const cur = stats.get(r.question_id) ?? { n: 0, sumPct: 0 };
        cur.n += 1; cur.sumPct += pct;
        stats.set(r.question_id, cur);
      }
      for (const q of list) {
        const s = stats.get(q.id);
        q.response_count = s?.n ?? 0;
        q.avg_pct = s && s.n > 0 ? s.sumPct / s.n : null;
      }
    }
    list.sort((a, b) => {
      const ap = a.avg_pct ?? 999;
      const bp = b.avg_pct ?? 999;
      if (ap !== bp) return ap - bp;
      return (a.position ?? 0) - (b.position ?? 0);
    });
    setQuestions(list);
    setLoadingQs(false);
  }

  // --- Import scores ---
  async function importAllScores() {
    setImporting(true);
    setImportResults(null);
    const body: any = {};
    if (courseId !== "ALL") body.course_id = courseId;
    // No filter = sync every quiz the teacher owns.
    const { data, error } = await supabase.functions.invoke("canvas-sync-question-scores", { body });
    setImporting(false);
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const stats = (data as any).stats ?? {};
    const recompute = (data as any).recompute;
    const recomputeNote = recompute && recompute.snapshots > 0
      ? ` Mastery updated for ${recompute.snapshots} entries.`
      : "";
    toast.success(
      `Imported ${stats.responses ?? 0} response${stats.responses === 1 ? "" : "s"} from ${stats.quizzes ?? 0} quiz${stats.quizzes === 1 ? "" : "zes"}.${recomputeNote}`,
    );
    setImportResults(((data as any).results ?? []) as any);
    loadBank();
    if (selectedStandardId) loadQuestionsForStandard(selectedStandardId);
  }

  const totalQuestions = bank?.reduce((a, r) => a + r.tagged_question_count, 0) ?? 0;
  const totalResponses = bank?.reduce((a, r) => a + r.response_count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-semibold mb-2">Question Bank</h1>
          <p className="text-muted-foreground">
            Every imported quiz question, organized by the standards (and substandards) it assesses.
          </p>
        </div>
        <Button onClick={importAllScores} disabled={importing}>
          {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Import quiz scores
        </Button>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Course</label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All my courses</SelectItem>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Framework</label>
            <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {frameworks.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All tags</SelectItem>
                <SelectItem value="SUGGESTED">AI-suggested only</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">Search standards</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code or keyword…" className="pl-7 h-9" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            <span className="font-medium text-foreground">{totalQuestions}</span> tagged questions ·{" "}
            <span className="font-medium text-foreground">{totalResponses}</span> student responses
          </div>
        </CardContent>
      </Card>

      {/* Body: tree + question list */}
      {bank === null ? (
        <div className="grid lg:grid-cols-[420px_1fr] gap-4">
          <Skeleton className="h-[500px]" /><Skeleton className="h-[500px]" />
        </div>
      ) : bank.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid lg:grid-cols-[420px_1fr] gap-4 items-start">
          <Card className="lg:sticky lg:top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Library className="h-4 w-4 text-accent" /> Standards tree
              </CardTitle>
              <CardDescription className="text-xs">Click a standard to load its questions.</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-3 max-h-[70vh] overflow-y-auto">
              <TreeView
                node={tree}
                depth={0}
                expanded={expanded}
                onToggle={(code) => setExpanded((p) => {
                  const n = new Set(p); if (n.has(code)) n.delete(code); else n.add(code); return n;
                })}
                selectedStandardId={selectedStandardId}
                onSelect={setSelectedStandardId}
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            {!selectedStandardId ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
                <BookOpen className="h-8 w-8 mx-auto mb-3 text-accent" />
                Pick a standard from the tree to see its questions.
              </CardContent></Card>
            ) : loadingQs ? (
              <div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
            ) : !questions || questions.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
                No questions tagged to this standard yet.
              </CardContent></Card>
            ) : (
              questions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setOpenQuestion(q)}
                  className="w-full text-left rounded-lg border bg-card hover:bg-muted/40 transition p-4 flex items-start gap-3"
                >
                  <div className="shrink-0 text-xs text-muted-foreground tabular-nums w-10 pt-0.5">
                    Q{q.position ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm line-clamp-2">{q.question_text || <span className="italic text-muted-foreground">(no text)</span>}</div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {q.assignments?.name && (
                        <Badge variant="outline" className="text-[10px]">{q.assignments.name}</Badge>
                      )}
                      {q.is_suggested_only && (
                        <Badge className="text-[10px] bg-accent/15 text-accent border-accent/30 hover:bg-accent/15">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                        </Badge>
                      )}
                      {q.points_possible != null && (
                        <span className="text-[10px] text-muted-foreground">{q.points_possible} pts</span>
                      )}
                      {(q.standards ?? []).slice(0, 4).map((s, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-mono bg-accent/5 border-accent/30">{s.code}</Badge>
                      ))}
                      {(q.standards?.length ?? 0) > 4 && (
                        <span className="text-[10px] text-muted-foreground">+{q.standards!.length - 4}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 w-24 text-right">
                    {q.avg_pct != null ? (
                      <>
                        <div className="text-base font-semibold tabular-nums" style={{ color: bandColor(q.avg_pct) }}>
                          {Math.round(q.avg_pct * 100)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">{q.response_count ?? 0} responses</div>
                      </>
                    ) : (
                      <div className="text-[10px] text-muted-foreground italic">No scores</div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Question detail drawer */}
      <QuestionDrawer question={openQuestion} onClose={() => setOpenQuestion(null)} />
    </div>
  );
}

function blankTotals() {
  return { questions: 0, responses: 0, weightedPct: 0, weight: 0 };
}

// Build the chain of ancestor codes for a code, e.g.
//   PS-MS-1-1.a → ["PS-MS-1", "PS-MS-1-1", "PS-MS-1-1.a"]
function chainFor(code: string): string[] {
  const chain: string[] = [];
  let cur = code;
  // Walk up by stripping the last [-.][^-.]+ segment
  const parents: string[] = [];
  while (true) {
    const m = cur.match(/^(.+)[-.][^-.]+$/);
    if (!m) break;
    cur = m[1];
    parents.unshift(cur);
    if (parents.length > 8) break; // safety
  }
  chain.push(...parents, code);
  return chain;
}

function rollup(node: TreeNode) {
  for (const c of node.children.values()) {
    rollup(c);
    node.totals.questions += c.totals.questions;
    node.totals.responses += c.totals.responses;
    node.totals.weightedPct += c.totals.weightedPct;
    node.totals.weight += c.totals.weight;
  }
  if (node.row) {
    node.totals.questions += node.row.tagged_question_count;
    node.totals.responses += node.row.response_count;
    if (node.row.avg_pct_correct != null && node.row.response_count > 0) {
      node.totals.weightedPct += Number(node.row.avg_pct_correct) * node.row.response_count;
      node.totals.weight += node.row.response_count;
    }
  }
}

function findNodeByStandardId(root: TreeNode, standardId: string): TreeNode | null {
  if (root.row?.standard_id === standardId) return root;
  for (const c of root.children.values()) {
    const f = findNodeByStandardId(c, standardId);
    if (f) return f;
  }
  return null;
}

function collectStandardIds(node: TreeNode | null): string[] {
  if (!node) return [];
  const out: string[] = [];
  if (node.row) out.push(node.row.standard_id);
  for (const c of node.children.values()) out.push(...collectStandardIds(c));
  return out;
}

function bandColor(v: number) {
  if (v >= 0.8) return "hsl(var(--mastery-high))";
  if (v >= 0.6) return "hsl(var(--mastery-mid))";
  return "hsl(var(--mastery-low))";
}

function TreeView({
  node, depth, expanded, onToggle, selectedStandardId, onSelect,
}: {
  node: TreeNode; depth: number; expanded: Set<string>;
  onToggle: (code: string) => void;
  selectedStandardId: string | null;
  onSelect: (id: string) => void;
}) {
  const sortedChildren = useMemo(
    () => Array.from(node.children.values()).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [node],
  );

  return (
    <div>
      {sortedChildren.map((child) => {
        const isOpen = expanded.has(child.code);
        const hasChildren = child.children.size > 0;
        const isSelected = child.row?.standard_id === selectedStandardId;
        const avg = child.totals.weight > 0 ? child.totals.weightedPct / child.totals.weight : null;
        return (
          <div key={child.code}>
            <div
              className={cn(
                "group flex items-center gap-1 py-1 pr-2 rounded-md hover:bg-muted/60",
                isSelected && "bg-accent/10",
              )}
              style={{ paddingLeft: 4 + depth * 14 }}
            >
              <button
                type="button"
                onClick={() => hasChildren && onToggle(child.code)}
                className={cn("h-5 w-5 inline-flex items-center justify-center text-muted-foreground", !hasChildren && "invisible")}
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => child.row && onSelect(child.row.standard_id)}
                className={cn(
                  "flex-1 min-w-0 flex items-center gap-2 text-left text-xs py-0.5",
                  child.row ? "cursor-pointer" : "cursor-default text-muted-foreground",
                )}
                disabled={!child.row}
                title={child.row?.description}
              >
                <span className="font-mono shrink-0">{child.code}</span>
                {child.row?.description && (
                  <span className="truncate text-muted-foreground">{child.row.description}</span>
                )}
              </button>
              <div className="shrink-0 flex items-center gap-1.5">
                <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                  {child.totals.questions}q
                </Badge>
                {avg != null && (
                  <span className="text-[10px] tabular-nums" style={{ color: bandColor(avg) }}>
                    {Math.round(avg * 100)}%
                  </span>
                )}
              </div>
            </div>
            {hasChildren && isOpen && (
              <TreeView node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle}
                selectedStandardId={selectedStandardId} onSelect={onSelect} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuestionDrawer({ question, onClose }: { question: QuestionRow | null; onClose: () => void }) {
  const [retagging, setRetagging] = useState(false);
  if (!question) return null;
  async function retagAi() {
    if (!question) return;
    setRetagging(true);
    const { data, error } = await supabase.functions.invoke("tag-question-standards", {
      body: { assignment_id: question.assignment_id },
    });
    setRetagging(false);
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    toast.success("Re-tag complete — refresh to see updates.");
  }
  return (
    <Sheet open={!!question} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Question {question.position ?? "?"}
            {question.points_possible != null && (
              <Badge variant="outline" className="text-[10px]">{question.points_possible} pts</Badge>
            )}
          </SheetTitle>
          {question.assignments && (
            <SheetDescription>
              From <span className="font-medium">{question.assignments.name}</span>
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Question</div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
              {question.question_text || <span className="italic text-muted-foreground">(no text)</span>}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Confirmed standards</div>
            {(question.standards?.length ?? 0) === 0 ? (
              <div className="text-xs text-muted-foreground italic">No confirmed tags.</div>
            ) : (
              <div className="space-y-2">
                {question.standards!.map((s, i) => (
                  <div key={i} className="rounded-md border p-2 text-sm">
                    <div className="font-mono text-xs text-accent">{s.code}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{s.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Class average</div>
              <div className="text-2xl font-semibold tabular-nums mt-1" style={{ color: question.avg_pct != null ? bandColor(question.avg_pct) : undefined }}>
                {question.avg_pct != null ? `${Math.round(question.avg_pct * 100)}%` : "—"}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Responses</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{question.response_count ?? 0}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={retagAi} disabled={retagging}>
              {retagging ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Re-tag with AI
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/review">
                <ExternalLink className="h-3 w-3 mr-1" /> Open in Tag Review
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-3">
        <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
        <div className="text-sm text-muted-foreground max-w-md mx-auto">
          No tagged questions yet. Sync your Canvas quizzes from the <Link to="/app" className="underline">Dashboard</Link>,
          then go to <Link to="/app/review" className="underline">Tag Review</Link> and run <strong>AI tag by question</strong> on a quiz.
        </div>
      </CardContent>
    </Card>
  );
}
