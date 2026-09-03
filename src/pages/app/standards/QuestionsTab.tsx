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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Library, Search, ChevronRight, ChevronDown, Sparkles, Download, Loader2,
  ExternalLink, BookOpen, AlertCircle, FileUp,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import ImportQuizCsvDialog from "@/components/ImportQuizCsvDialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from "recharts";
import { RevealNamesToggle } from "@/components/RevealNamesToggle";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkTagActions } from "./BulkTagActions";
import { UntaggedQuestionsDialog, countUntaggedQuestions } from "./UntaggedQuestionsDialog";

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

type QuestionAnswer = { text: string | null; html: string | null; weight: number | null };

export type QuestionRow = {
  id: string;
  position: number | null;
  question_text: string | null;
  points_possible: number | null;
  assignment_id: string;
  assignments: { id: string; name: string; course_id: string } | null;
  answers: QuestionAnswer[] | null;
  item_type: string | null;
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

export default function QuestionsTab() {
  const [urlParams, setUrlParams] = useSearchParams();
  const urlStd = urlParams.get("std");
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("ALL");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [bank, setBank] = useState<BankRow[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedStandardId, setSelectedStandardId] = useState<string | null>(urlStd);
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [loadingQs, setLoadingQs] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<QuestionRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<
    { name: string; status: "ok" | "skipped" | "error"; responses: number; reason?: string }[] | null
  >(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [untaggedOpen, setUntaggedOpen] = useState(false);
  const [untaggedCount, setUntaggedCount] = useState<number | null>(null);
  const [selectedQs, setSelectedQs] = useState<Set<string>>(new Set());
  const refreshUntagged = () => countUntaggedQuestions().then(setUntaggedCount).catch(() => {});
  useEffect(() => { refreshUntagged(); }, []);

  // Sync external URL param changes (e.g., navigating from Library tab) into selection.
  useEffect(() => {
    if (urlStd && urlStd !== selectedStandardId) setSelectedStandardId(urlStd);
    // eslint-disable-next-line
  }, [urlStd]);

  // When the dialog closes, drop the std param from the URL.
  function clearSelectedStandard() {
    setSelectedStandardId(null);
    if (urlParams.get("std")) {
      setUrlParams((p) => { p.delete("std"); return p; });
    }
  }

  // --- Load courses ---
  useEffect(() => {
    supabase.from("courses").select("id, name").eq("hidden", false).is("archived_at", null).order("name").then(({ data }) => {
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
    setSelectedQs(new Set());
    const node = findNodeByStandardId(tree, standardId);
    const stdIds = collectStandardIds(node);
    if (stdIds.length === 0) { setQuestions([]); setLoadingQs(false); return; }

    // Pull tags honoring the status filter (default: all — confirmed AND ai-suggested)
    let qsQuery = supabase
      .from("question_standards")
      .select("question_id, standard_id, ai_suggested, confirmed, standards(code, description), quiz_questions!inner(id, position, question_text, points_possible, assignment_id, answers, item_type, assignments!inner(id, name, course_id))")
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
          answers: q.answers ?? null,
          item_type: q.item_type ?? null,
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
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setUntaggedOpen(true)}>
          <AlertCircle className="h-4 w-4 mr-2" />
          Untagged questions
          {untaggedCount != null && untaggedCount > 0 && (
            <Badge variant="secondary" className="ml-2 tabular-nums">{untaggedCount}</Badge>
          )}
        </Button>
        <Button variant="outline" onClick={() => setCsvOpen(true)}>
          <FileUp className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
        <Button onClick={importAllScores} disabled={importing}>
          {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Import quiz scores
        </Button>
      </div>

      <UntaggedQuestionsDialog
        open={untaggedOpen}
        onOpenChange={setUntaggedOpen}
        courses={courses}
        onChanged={() => { loadBank(); refreshUntagged(); if (selectedStandardId) loadQuestionsForStandard(selectedStandardId); }}
      />

      <ImportQuizCsvDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        courses={courses}
        defaultCourseId={courseId !== "ALL" ? courseId : undefined}
        onImported={() => { loadBank(); if (selectedStandardId) loadQuestionsForStandard(selectedStandardId); }}
      />

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

      {/* Per-quiz import results */}
      {importResults && importResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Import results</span>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setImportResults(null)}
              >
                Dismiss
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 max-h-64 overflow-y-auto">
            <ul className="text-xs divide-y">
              {importResults.map((r, i) => (
                <li key={i} className="py-1.5 flex items-center justify-between gap-2">
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 flex items-center gap-2">
                    {r.status === "ok" ? (
                      <Badge variant="outline" className="text-[11px] bg-mastery-high/10 border-mastery-high/30 text-mastery-high">
                        {r.responses} response{r.responses === 1 ? "" : "s"}
                      </Badge>
                    ) : r.status === "skipped" ? (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        skipped{r.reason ? ` — ${r.reason}` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] bg-mastery-low/10 border-mastery-low/30 text-mastery-low">
                        error{r.reason ? ` — ${r.reason}` : ""}
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Body: tree + question list */}
      {bank === null ? (
        <div className="grid lg:grid-cols-[420px_1fr] gap-4">
          <Skeleton className="h-[500px]" /><Skeleton className="h-[500px]" />
        </div>
      ) : bank.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4" style={{ fontFamily: "'Nunito Sans', system-ui, sans-serif" }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Library className="h-4 w-4 text-accent" /> Standards tree
              </CardTitle>
              <CardDescription className="text-sm">Click a standard to open its questions in a popout.</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-4 max-h-[75vh] overflow-y-auto">
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
        </div>
      )}

      {/* Questions popout dialog */}
      <Dialog open={!!selectedStandardId} onOpenChange={(open) => !open && clearSelectedStandard()}>
        <DialogContent
          className="max-w-4xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col"
          style={{ fontFamily: "'Nunito Sans', system-ui, sans-serif" }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" /> Questions for selected standard
            </DialogTitle>
            <DialogDescription>
              {questions ? `${questions.length} question${questions.length === 1 ? "" : "s"} found` : "Loading…"}
            </DialogDescription>
          </DialogHeader>
          {questions && questions.length > 0 && (
            <BulkTagActions
              selected={questions.filter((q) => selectedQs.has(q.id)).map((q) => ({ id: q.id, assignment_id: q.assignment_id }))}
              allIds={questions.map((q) => q.id)}
              onSelectAll={() => setSelectedQs(new Set(questions.map((q) => q.id)))}
              onClear={() => setSelectedQs(new Set())}
              onDone={() => { loadBank(); refreshUntagged(); if (selectedStandardId) loadQuestionsForStandard(selectedStandardId); }}
            />
          )}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {loadingQs ? (
              <div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
            ) : !questions || questions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No questions tagged to this standard yet.
              </div>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedQs.has(q.id)}
                    onCheckedChange={() => setSelectedQs((p) => { const n = new Set(p); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}
                    className="mt-5"
                    aria-label={`Select question ${q.position ?? ""}`}
                  />
                <button
                  type="button"
                  onClick={() => setOpenQuestion(q)}
                  className="flex-1 text-left rounded-lg border bg-card hover:bg-muted/40 transition p-4 flex items-start gap-3"
                >
                  <div className="shrink-0 text-xs text-muted-foreground tabular-nums w-10 pt-0.5">
                    Q{q.position ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm line-clamp-2">{q.question_text || <span className="italic text-muted-foreground">(no text)</span>}</div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {q.assignments?.name && (
                        <Badge variant="outline" className="text-[11px]">{q.assignments.name}</Badge>
                      )}
                      {q.is_suggested_only && (
                        <Badge className="text-[11px] bg-accent/15 text-accent border-accent/30 hover:bg-accent/15">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                        </Badge>
                      )}
                      {q.points_possible != null && (
                        <span className="text-[11px] text-muted-foreground">{q.points_possible} pts</span>
                      )}
                      {(q.standards ?? []).slice(0, 4).map((s, i) => (
                        <Badge key={i} variant="outline" className="text-[11px] font-code bg-accent/5 border-accent/30">{s.code}</Badge>
                      ))}
                      {(q.standards?.length ?? 0) > 4 && (
                        <span className="text-[11px] text-muted-foreground">+{q.standards!.length - 4}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 w-24 text-right">
                    {q.avg_pct != null ? (
                      <>
                        <div className="text-base font-semibold tabular-nums" style={{ color: bandColor(q.avg_pct) }}>
                          {Math.round(q.avg_pct * 100)}%
                        </div>
                        <div className="text-[11px] text-muted-foreground">{q.response_count ?? 0} responses</div>
                      </>
                    ) : (
                      <div className="text-[11px] text-muted-foreground italic">No scores</div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

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

export function bandColor(v: number) {
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
    <div style={{ fontFamily: "'Nunito Sans', system-ui, sans-serif" }}>
      {sortedChildren.map((child) => {
        const isOpen = expanded.has(child.code);
        const hasChildren = child.children.size > 0;
        const isSelected = child.row?.standard_id === selectedStandardId;
        const avg = child.totals.weight > 0 ? child.totals.weightedPct / child.totals.weight : null;
        return (
          <div key={child.code}>
            <div
              className={cn(
                "group flex items-center gap-1.5 py-1.5 pr-2 rounded-md hover:bg-muted/60",
                isSelected && "bg-accent/10",
              )}
              style={{ paddingLeft: 4 + depth * 18 }}
            >
              <button
                type="button"
                onClick={() => hasChildren && onToggle(child.code)}
                className={cn("h-6 w-6 inline-flex items-center justify-center text-muted-foreground", !hasChildren && "invisible")}
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => child.row && onSelect(child.row.standard_id)}
                className={cn(
                  "flex-1 min-w-0 flex items-center gap-2 text-left text-sm py-0.5",
                  child.row ? "cursor-pointer" : "cursor-default text-muted-foreground",
                )}
                disabled={!child.row}
                title={child.row?.description}
              >
                <span className="font-code shrink-0 text-sm">{child.code}</span>
                {child.row?.description && (
                  <span className="truncate text-muted-foreground text-sm">{child.row.description}</span>
                )}
              </button>
              <div className="shrink-0 flex items-center gap-2">
                <Badge variant="outline" className="text-xs h-5 px-1.5 font-code">
                  {child.totals.questions}q
                </Badge>
                {avg != null && (
                  <span className="text-xs tabular-nums font-medium" style={{ color: bandColor(avg) }}>
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

export function QuestionDrawer({ question, onClose }: { question: QuestionRow | null; onClose: () => void }) {
  const [retagging, setRetagging] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealedNames, setRevealedNames] = useState<Record<string, string>>({});

  // Reset reveal state whenever a different question is opened.
  useEffect(() => {
    setRevealed(false);
    setRevealedNames({});
  }, [question?.id]);

  if (!question) return null;

  async function revealNames(reason?: string) {
    if (!question) return false;
    setRevealLoading(true);
    const { data, error } = await supabase.rpc("reveal_question_identities", {
      _question_id: question.id,
      _reason: reason ?? null,
    });
    setRevealLoading(false);
    if (error) { toast.error(error.message); return false; }
    const map: Record<string, string> = {};
    for (const r of (data as any[]) ?? []) map[r.student_id] = r.real_name;
    setRevealedNames(map);
    setRevealed(true);
    return true;
  }
  function hideNames() {
    setRevealed(false);
    setRevealedNames({});
  }
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
      <SheetContent className="sm:max-w-2xl overflow-y-auto max-h-screen">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Question {question.position ?? "?"}
            {question.points_possible != null && (
              <Badge variant="outline" className="text-[11px]">{question.points_possible} pts</Badge>
            )}
          </SheetTitle>
          {question.assignments && (
            <SheetDescription>
              From <span className="font-medium">{question.assignments.name}</span>
            </SheetDescription>
          )}
          <div className="pt-2">
            <RevealNamesToggle
              revealed={revealed}
              loading={revealLoading}
              onReveal={revealNames}
              onHide={hideNames}
            />
          </div>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Question</div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
              {question.question_text || <span className="italic text-muted-foreground">(no text)</span>}
            </div>
          </div>
          {question.answers && question.answers.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Choices {question.item_type ? <span className="normal-case text-muted-foreground/70">· {question.item_type}</span> : null}
              </div>
              <ul className="space-y-1.5">
                {question.answers.map((a, i) => {
                  const isCorrect = (a.weight ?? 0) > 0;
                  return (
                    <li
                      key={i}
                      className={cn(
                        "rounded-md border p-2.5 text-sm flex items-start gap-2",
                        isCorrect ? "border-mastery-high/40 bg-mastery-high/5" : "bg-card"
                      )}
                    >
                      <span className="font-code text-xs text-muted-foreground shrink-0 mt-0.5 w-5">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span className="flex-1 min-w-0 whitespace-pre-wrap">
                        {a.text || <span className="italic text-muted-foreground">(no text)</span>}
                      </span>
                      {isCorrect && (
                        <Badge variant="outline" className="text-[10px] bg-mastery-high/10 border-mastery-high/30 text-mastery-high shrink-0">
                          correct
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Confirmed standards</div>
            {(question.standards?.length ?? 0) === 0 ? (
              <div className="text-xs text-muted-foreground italic">No confirmed tags.</div>
            ) : (
              <div className="space-y-2">
                {question.standards!.map((s, i) => (
                  <div key={i} className="rounded-md border p-2 text-sm">
                    <div className="font-code text-xs text-accent">{s.code}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{s.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <QuestionPerformanceChart questionId={question.id} revealedNames={revealedNames} />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Class average</div>
              <div className="text-2xl font-semibold tabular-nums mt-1" style={{ color: question.avg_pct != null ? bandColor(question.avg_pct) : undefined }}>
                {question.avg_pct != null ? `${Math.round(question.avg_pct * 100)}%` : "—"}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Responses</div>
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

// ──────────────────────── Question performance chart ────────────────────────
// Loads per-student responses for a single question and renders a 3-band
// distribution (Basic / Proficient / Advanced) with student names on hover.
const QB_BANDS = [
  { key: "basic"      as const, label: "Basic (<60%)",        short: "Basic",      color: "hsl(0 72% 51%)" },
  { key: "proficient" as const, label: "Proficient (60–80%)", short: "Proficient", color: "hsl(38 92% 50%)" },
  { key: "advanced"   as const, label: "Advanced (≥80%)",     short: "Advanced",   color: "hsl(160 84% 39%)" },
];
type QBBandKey = "basic" | "proficient" | "advanced";

function QuestionPerformanceChart({ questionId, revealedNames }: { questionId: string; revealedNames: Record<string, string> }) {
  const [loading, setLoading] = useState(true);
  // Store student IDs + pseudonyms per band so we can resolve real names dynamically
  // when the teacher toggles "reveal real names".
  type Entry = { id: string; pseudonym: string };
  const [idsByBand, setIdsByBand] = useState<Record<QBBandKey, Entry[]>>({ basic: [], proficient: [], advanced: [] });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("question_responses")
        .select("points, points_possible, student_id")
        .eq("question_id", questionId);
      if (cancelled) return;
      if (error || !data) {
        setIdsByBand({ basic: [], proficient: [], advanced: [] });
        setLoading(false);
        return;
      }
      // Fetch student names in a second query (no FK between question_responses
      // and students, so PostgREST embedding isn't available here).
      const studentIds = Array.from(new Set((data as any[]).map((r) => r.student_id).filter(Boolean)));
      const nameById = new Map<string, string>();
      if (studentIds.length > 0) {
        const { data: studs } = await supabase
          .from("students")
          .select("id, name")
          .in("id", studentIds);
        for (const s of (studs as any[] | null) ?? []) nameById.set(s.id, s.name);
      }
      const buckets: Record<QBBandKey, Entry[]> = { basic: [], proficient: [], advanced: [] };
      for (const r of data as any[]) {
        const pp = Number(r.points_possible ?? 0);
        const pts = Number(r.points ?? 0);
        if (!pp || pp <= 0) continue;
        const pct = pts / pp;
        const band: QBBandKey = pct < 0.6 ? "basic" : pct < 0.8 ? "proficient" : "advanced";
        buckets[band].push({ id: r.student_id, pseudonym: nameById.get(r.student_id) ?? "Unknown" });
      }
      setIdsByBand(buckets);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [questionId]);

  // Resolve display names per band, sorting alphabetically by the visible name.
  const namesByBand = useMemo(() => {
    const out: Record<QBBandKey, string[]> = { basic: [], proficient: [], advanced: [] };
    for (const k of Object.keys(idsByBand) as QBBandKey[]) {
      out[k] = idsByBand[k]
        .map((e) => revealedNames[e.id] ?? e.pseudonym)
        .sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [idsByBand, revealedNames]);

  const data = QB_BANDS.map((b) => ({
    name: b.short,
    band: b.key,
    color: b.color,
    count: namesByBand[b.key].length,
  }));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Student performance</div>
        <div className="text-[11px] text-muted-foreground">{total} student{total === 1 ? "" : "s"}</div>
      </div>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : total === 0 ? (
        <div className="text-xs text-muted-foreground italic py-6 text-center">No scored responses yet.</div>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
              <RechartsTooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                content={(props: any) => {
                  const { active, payload } = props;
                  if (!active || !payload || payload.length === 0) return null;
                  const row = payload[0].payload as { name: string; band: QBBandKey; color: string; count: number };
                  const names = namesByBand[row.band];
                  const MAX = 12;
                  const shown = names.slice(0, MAX);
                  const extra = names.length - shown.length;
                  return (
                    <div className="rounded-md border bg-popover/95 backdrop-blur px-3 py-2 shadow-md text-popover-foreground">
                      <div className="text-xs font-semibold mb-1" style={{ color: row.color }}>
                        {row.name}: {row.count}
                      </div>
                      {names.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground italic">No students</div>
                      ) : (
                        <ul className="space-y-0.5 max-w-[240px]">
                          {shown.map((n, i) => (
                            <li key={i} className="text-xs leading-tight truncate">• {n}</li>
                          ))}
                          {extra > 0 && <li className="text-[11px] text-muted-foreground">+{extra} more</li>}
                        </ul>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
