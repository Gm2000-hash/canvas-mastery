// Tag Review screen — fast, dense workflow for confirming or rejecting AI-suggested standards.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Check, Sparkles, Trash2, X, Loader2, Filter, ChevronUp, ChevronDown, Replace, ListChecks, ChevronRight,
} from "lucide-react";

type Course = { id: string; name: string; discipline_id: string | null };
type Discipline = { id: string; state: string; subject: string; grade: string };
type Assignment = {
  id: string; name: string; kind: "assignment" | "quiz"; course_id: string;
  due_at: string | null; description: string | null;
};
type Tag = {
  id: string; assignment_id: string; standard_id: string;
  ai_suggested: boolean; confirmed: boolean; confidence: number | null; rationale: string | null;
  standards: { code: string; description: string } | null;
};
type StatusFilter = "untagged" | "ai" | "confirmed" | "all";
type SortKey = "recent" | "due" | "alpha";
type QuizQuestion = {
  id: string; assignment_id: string; position: number | null;
  question_text: string | null; points_possible: number | null;
};
type QTag = {
  id: string; question_id: string; standard_id: string;
  ai_suggested: boolean; confirmed: boolean; confidence: number | null; rationale: string | null;
  standards: { code: string; description: string } | null;
};

export default function Review() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tagsByAssignment, setTagsByAssignment] = useState<Record<string, Tag[]>>({});
  const [questionCountByAssignment, setQuestionCountByAssignment] = useState<Record<string, number>>({});
  const [questionsByAssignment, setQuestionsByAssignment] = useState<Record<string, QuizQuestion[]>>({});
  const [qTagsByQuestion, setQTagsByQuestion] = useState<Record<string, QTag[]>>({});
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [questionTagBusy, setQuestionTagBusy] = useState<Set<string>>(new Set());
  const [allStandards, setAllStandards] = useState<{ id: string; code: string; description: string; state: string; subject: string; grade: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [courseFilter, setCourseFilter] = useState<Set<string>>(new Set());
  const [disciplineFilter, setDisciplineFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ai");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [scoreImportBusy, setScoreImportBusy] = useState<Set<string>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  async function importQuestionScores(assignmentId: string) {
    setScoreImportBusy((p) => new Set(p).add(assignmentId));
    const { data, error } = await supabase.functions.invoke("canvas-sync-question-scores", {
      body: { assignment_ids: [assignmentId] },
    });
    setScoreImportBusy((p) => { const n = new Set(p); n.delete(assignmentId); return n; });
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const stats = (data as any).stats ?? {};
    const results = (data as any).results ?? [];
    const r = results[0];
    if (r?.status === "error") toast.error(`Import failed: ${r.reason ?? "unknown"}`);
    else if (r?.status === "skipped") toast.message(`Skipped: ${r.reason ?? "no eligible questions"}`);
    else toast.success(`Imported ${stats.responses ?? 0} per-question response${stats.responses === 1 ? "" : "s"}.`);
  }


  async function loadAll() {
    setLoading(true);
    const [{ data: cs }, { data: ds }, { data: a }, { data: stds }] = await Promise.all([
      supabase.from("courses").select("id, name, discipline_id").eq("hidden", false).order("name"),
      supabase.from("teacher_disciplines").select("id, state, subject, grade").order("created_at"),
      supabase.from("assignments").select("id, name, kind, course_id, due_at, description"),
      supabase.from("standards").select("id, code, description, state, subject, grade").order("code").limit(2000),
    ]);
    const visibleCourseIds = new Set(((cs ?? []) as Course[]).map((c) => c.id));
    const visibleAssignments = ((a ?? []) as Assignment[]).filter((x) => visibleCourseIds.has(x.course_id));
    setCourses((cs ?? []) as Course[]);
    setDisciplines((ds ?? []) as Discipline[]);
    setAssignments(visibleAssignments);
    setAllStandards((stds ?? []) as any);

    if (visibleAssignments.length) {
      const ids = visibleAssignments.map((x) => x.id);
      const [{ data: tags }, { data: qs }] = await Promise.all([
        supabase
          .from("assignment_standards")
          .select("id, assignment_id, standard_id, ai_suggested, confirmed, confidence, rationale, standards ( code, description )")
          .in("assignment_id", ids),
        supabase
          .from("quiz_questions")
          .select("id, assignment_id")
          .in("assignment_id", ids),
      ]);
      const map: Record<string, Tag[]> = {};
      for (const t of (tags as any[]) ?? []) {
        (map[t.assignment_id] ??= []).push(t as Tag);
      }
      setTagsByAssignment(map);
      const counts: Record<string, number> = {};
      for (const q of (qs as any[]) ?? []) counts[q.assignment_id] = (counts[q.assignment_id] ?? 0) + 1;
      setQuestionCountByAssignment(counts);
    } else {
      setTagsByAssignment({});
      setQuestionCountByAssignment({});
    }
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  // Lazy-load question detail + per-question tags for one assignment
  async function loadQuestionsFor(assignmentId: string) {
    const [{ data: qs }, { data: qts }] = await Promise.all([
      supabase.from("quiz_questions")
        .select("id, assignment_id, position, question_text, points_possible")
        .eq("assignment_id", assignmentId).order("position"),
      supabase.from("question_standards")
        .select("id, question_id, standard_id, ai_suggested, confirmed, confidence, rationale, standards ( code, description ), quiz_questions!inner ( assignment_id )")
        .eq("quiz_questions.assignment_id", assignmentId),
    ]);
    setQuestionsByAssignment((m) => ({ ...m, [assignmentId]: (qs ?? []) as QuizQuestion[] }));
    const tagMap: Record<string, QTag[]> = {};
    for (const t of (qts as any[]) ?? []) (tagMap[t.question_id] ??= []).push(t as QTag);
    setQTagsByQuestion((m) => ({ ...m, ...tagMap }));
  }

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const disciplineById = useMemo(() => new Map(disciplines.map((d) => [d.id, d])), [disciplines]);

  const filtered = useMemo(() => {
    let list = assignments.slice();
    if (courseFilter.size) list = list.filter((a) => courseFilter.has(a.course_id));
    if (disciplineFilter.size) {
      list = list.filter((a) => {
        const c = courseById.get(a.course_id);
        return c?.discipline_id ? disciplineFilter.has(c.discipline_id) : false;
      });
    }
    if (statusFilter !== "all") {
      list = list.filter((a) => {
        const tags = tagsByAssignment[a.id] ?? [];
        const hasAi = tags.some((t) => t.ai_suggested && !t.confirmed);
        const hasConfirmed = tags.some((t) => t.confirmed);
        if (statusFilter === "untagged") return tags.length === 0;
        if (statusFilter === "ai") return hasAi;
        if (statusFilter === "confirmed") return hasConfirmed && !hasAi;
        return true;
      });
    }
    if (sortKey === "due") {
      list.sort((a, b) => {
        const ad = a.due_at ? new Date(a.due_at).getTime() : -Infinity;
        const bd = b.due_at ? new Date(b.due_at).getTime() : -Infinity;
        return bd - ad;
      });
    } else if (sortKey === "alpha") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // recent: by due_at desc, nulls last; falls back to name
      list.sort((a, b) => {
        const ad = a.due_at ? new Date(a.due_at).getTime() : 0;
        const bd = b.due_at ? new Date(b.due_at).getTime() : 0;
        if (bd !== ad) return bd - ad;
        return a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [assignments, tagsByAssignment, courseFilter, disciplineFilter, statusFilter, sortKey, courseById]);

  // Keep activeIdx in range
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIdx]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (filtered.length === 0) return;
      const a = filtered[activeIdx];
      if (!a) return;
      const tags = tagsByAssignment[a.id] ?? [];
      const firstSuggested = tags.find((x) => x.ai_suggested && !x.confirmed);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault(); setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key.toLowerCase() === "y" && firstSuggested) {
        e.preventDefault(); confirmTag(firstSuggested);
      } else if (e.key.toLowerCase() === "n" && firstSuggested) {
        e.preventDefault(); removeTag(firstSuggested);
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault(); aiSuggest(a.id);
      } else if (e.key === " ") {
        e.preventDefault(); toggleSelect(a.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, activeIdx, tagsByAssignment]);

  // Scroll active into view
  useEffect(() => {
    cardRefs.current[activeIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  function toggleSelect(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function confirmTag(t: Tag) {
    const { error } = await supabase.from("assignment_standards").update({ confirmed: true }).eq("id", t.id);
    if (error) toast.error(error.message); else { loadAll(); }
  }
  async function removeTag(t: Tag) {
    const { error } = await supabase.from("assignment_standards").delete().eq("id", t.id);
    if (error) toast.error(error.message); else loadAll();
  }
  async function aiSuggest(assignmentId: string) {
    const { data, error } = await supabase.functions.invoke("tag-standards", { body: { assignment_id: assignmentId } });
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const n = (data as any).suggestions?.length ?? 0;
    toast.success(n ? `${n} suggestion${n > 1 ? "s" : ""}` : "No strong match");
    loadAll();
  }

  async function aiSuggestByQuestion(assignmentId: string) {
    setQuestionTagBusy((p) => new Set(p).add(assignmentId));
    const { data, error } = await supabase.functions.invoke("tag-question-standards", { body: { assignment_id: assignmentId } });
    setQuestionTagBusy((p) => { const n = new Set(p); n.delete(assignmentId); return n; });
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const qn = (data as any).questions_tagged ?? 0;
    const rn = (data as any).assignment_rollup_count ?? 0;
    toast.success(`Tagged ${qn} question${qn === 1 ? "" : "s"} → ${rn} assignment-level standard${rn === 1 ? "" : "s"}`);
    setExpandedQuestions((p) => new Set(p).add(assignmentId));
    await loadQuestionsFor(assignmentId);
    loadAll();
  }

  async function toggleExpand(assignmentId: string) {
    setExpandedQuestions((p) => {
      const n = new Set(p);
      if (n.has(assignmentId)) n.delete(assignmentId);
      else { n.add(assignmentId); loadQuestionsFor(assignmentId); }
      return n;
    });
  }

  async function confirmQTag(t: QTag, assignmentId: string) {
    const { error } = await supabase.from("question_standards").update({ confirmed: true }).eq("id", t.id);
    if (error) toast.error(error.message); else loadQuestionsFor(assignmentId);
  }
  async function removeQTag(t: QTag, assignmentId: string) {
    const { error } = await supabase.from("question_standards").delete().eq("id", t.id);
    if (error) toast.error(error.message); else loadQuestionsFor(assignmentId);
  }

  async function bulkConfirmAll() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected).flatMap((aid) =>
      (tagsByAssignment[aid] ?? []).filter((t) => t.ai_suggested && !t.confirmed).map((t) => t.id),
    );
    if (ids.length === 0) { toast.info("Nothing to confirm in selection"); setBulkBusy(false); return; }
    const { error } = await supabase.from("assignment_standards").update({ confirmed: true }).in("id", ids);
    setBulkBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`Confirmed ${ids.length} suggestion${ids.length === 1 ? "" : "s"}`); setSelected(new Set()); loadAll(); }
  }

  async function bulkRejectAll() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected).flatMap((aid) =>
      (tagsByAssignment[aid] ?? []).filter((t) => t.ai_suggested && !t.confirmed).map((t) => t.id),
    );
    if (ids.length === 0) { toast.info("Nothing to reject in selection"); setBulkBusy(false); return; }
    const { error } = await supabase.from("assignment_standards").delete().in("id", ids);
    setBulkBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`Rejected ${ids.length} suggestion${ids.length === 1 ? "" : "s"}`); setSelected(new Set()); loadAll(); }
  }

  async function bulkAiSuggest() {
    const targets = filtered.filter((a) => (tagsByAssignment[a.id] ?? []).length === 0);
    if (targets.length === 0) { toast.info("No untagged assignments in current view"); return; }
    setBulkBusy(true);
    let ok = 0;
    for (const a of targets.slice(0, 25)) { // cap to avoid runaway loops
      try {
        const { data, error } = await supabase.functions.invoke("tag-standards", { body: { assignment_id: a.id } });
        if (!error && !(data as any)?.error) ok++;
      } catch { /* continue */ }
    }
    setBulkBusy(false);
    toast.success(`AI tagged ${ok} of ${Math.min(targets.length, 25)} assignments`);
    loadAll();
  }

  async function bulkTagByQuestion() {
    const targets = Array.from(selected)
      .map((id) => assignments.find((a) => a.id === id))
      .filter((a): a is Assignment => !!a && a.kind === "quiz" && (questionCountByAssignment[a.id] ?? 0) > 0);
    if (targets.length === 0) { toast.info("Pick one or more synced quizzes first"); return; }
    setBulkBusy(true);
    let ok = 0;
    for (const a of targets.slice(0, 10)) {
      try {
        const { data, error } = await supabase.functions.invoke("tag-question-standards", { body: { assignment_id: a.id } });
        if (!error && !(data as any)?.error) ok++;
      } catch { /* continue */ }
    }
    setBulkBusy(false);
    toast.success(`Question-tagged ${ok} of ${Math.min(targets.length, 10)} quizzes`);
    loadAll();
  }
  const teachStandards = useMemo(() => {
    const keys = new Set(disciplines.map((d) => `${d.state}|${d.subject}|${d.grade}`));
    return allStandards.filter((s) => keys.has(`${s.state}|${s.subject}|${s.grade}`));
  }, [allStandards, disciplines]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Tag Review</h1>
            <p className="text-muted-foreground">Confirm or override AI-suggested standards. Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">J</kbd>/<kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">K</kbd> to move, <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">Y</kbd> to confirm, <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">N</kbd> to reject, <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">A</kbd> to AI-suggest.</p>
          </div>
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <MultiSelect
              label="Course"
              options={courses.map((c) => ({ value: c.id, label: c.name }))}
              selected={courseFilter}
              onChange={setCourseFilter}
            />
            <MultiSelect
              label="Discipline"
              options={disciplines.map((d) => ({ value: d.id, label: `${d.subject} · ${d.grade} · ${d.state}` }))}
              selected={disciplineFilter}
              onChange={setDisciplineFilter}
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ai">AI-suggested (needs review)</SelectItem>
                <SelectItem value="untagged">Untagged</SelectItem>
                <SelectItem value="confirmed">Confirmed only</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="due">By due date</SelectItem>
                <SelectItem value="alpha">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={bulkAiSuggest} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                AI suggest for untagged
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-10 -mx-2 px-2">
            <Card className="border-primary/40 bg-primary/5 shadow-card">
              <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium">{selected.size} selected</span>
                <Button size="sm" onClick={bulkConfirmAll} disabled={bulkBusy}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Confirm all suggestions
                </Button>
                <Button size="sm" variant="outline" onClick={bulkRejectAll} disabled={bulkBusy}>
                  <X className="h-3.5 w-3.5 mr-1" /> Reject all suggestions
                </Button>
                <Button size="sm" variant="outline" onClick={bulkTagByQuestion} disabled={bulkBusy}>
                  {bulkBusy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ListChecks className="h-3.5 w-3.5 mr-1" />}
                  Tag by question (quizzes)
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cards */}
        {loading ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Nothing to review with these filters.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((a, idx) => {
              const tags = tagsByAssignment[a.id] ?? [];
              const suggested = tags.filter((t) => t.ai_suggested && !t.confirmed);
              const confirmed = tags.filter((t) => t.confirmed);
              const course = courseById.get(a.course_id);
              const disc = course?.discipline_id ? disciplineById.get(course.discipline_id) : null;
              const isActive = idx === activeIdx;
              const qCount = questionCountByAssignment[a.id] ?? 0;
              const isQuiz = a.kind === "quiz";
              const isExpanded = expandedQuestions.has(a.id);
              const qBusy = questionTagBusy.has(a.id);
              return (
                <Card
                  key={a.id}
                  ref={(el) => { cardRefs.current[idx] = el; }}
                  className={`transition-colors ${isActive ? "ring-2 ring-primary/60" : ""}`}
                  onClick={() => setActiveIdx(idx)}
                >
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selected.has(a.id)}
                        onCheckedChange={() => toggleSelect(a.id)}
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{a.name}</span>
                          <Badge variant="outline" className="text-[11px] uppercase">{a.kind}</Badge>
                          {isQuiz && qCount > 0 && (
                            <Badge variant="outline" className="text-[11px]">
                              {qCount} question{qCount === 1 ? "" : "s"}
                            </Badge>
                          )}
                          {course && <span className="text-xs text-muted-foreground truncate">{course.name}</span>}
                          {disc && (
                            <Badge variant="outline" className="text-[11px] bg-accent/5 text-accent border-accent/30">
                              {disc.subject} · {disc.grade}
                            </Badge>
                          )}
                          {a.due_at && (
                            <span className="text-xs text-muted-foreground">due {new Date(a.due_at).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {confirmed.map((t) => (
                            <Badge key={t.id} className="bg-mastery-high/10 text-mastery-high border-mastery-high/30" variant="outline">
                              <Check className="h-3 w-3 mr-1" /> {t.standards?.code}
                              <button onClick={(e) => { e.stopPropagation(); removeTag(t); }} className="ml-1.5 opacity-70 hover:opacity-100">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          {suggested.map((t) => (
                            <Tooltip key={t.id}>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/5 px-2 py-0.5 text-xs">
                                  <Sparkles className="h-3 w-3 text-accent" />
                                  <span className="font-code">{t.standards?.code}</span>
                                  {t.confidence != null && (
                                    <span className="text-muted-foreground">{Math.round(t.confidence * 100)}%</span>
                                  )}
                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0 ml-0.5" onClick={(e) => { e.stopPropagation(); confirmTag(t); }} title="Confirm (Y)">
                                    <Check className="h-3 w-3 text-mastery-high" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); removeTag(t); }} title="Reject (N)">
                                    <X className="h-3 w-3" />
                                  </Button>
                                  <OverrideButton
                                    standards={teachStandards}
                                    onPick={async (newStdId) => {
                                      // Reject the suggestion, then add the override as confirmed
                                      const { data: u } = await supabase.auth.getUser();
                                      if (!u.user) return;
                                      await supabase.from("assignment_standards").delete().eq("id", t.id);
                                      const { error } = await supabase.from("assignment_standards").upsert({
                                        teacher_id: u.user.id, assignment_id: a.id, standard_id: newStdId,
                                        ai_suggested: false, confirmed: true,
                                      }, { onConflict: "assignment_id,standard_id" });
                                      if (error) toast.error(error.message); else { toast.success("Overridden"); loadAll(); }
                                    }}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <div className="font-medium">{t.standards?.code}</div>
                                <div className="text-xs mb-1">{t.standards?.description}</div>
                                {t.rationale && <div className="text-xs italic opacity-80">"{t.rationale}"</div>}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                          <AddStandardInline
                            assignmentId={a.id}
                            standards={teachStandards}
                            onAdded={loadAll}
                          />
                          {tags.length === 0 && (
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={(e) => { e.stopPropagation(); aiSuggest(a.id); }}>
                              <Sparkles className="h-3 w-3 mr-1" /> AI suggest
                            </Button>
                          )}
                          {isQuiz && qCount > 0 && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                disabled={qBusy}
                                onClick={(e) => { e.stopPropagation(); aiSuggestByQuestion(a.id); }}
                                title="Run the 8-keyword matcher on each question, then roll up to the assignment"
                              >
                                {qBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ListChecks className="h-3 w-3 mr-1" />}
                                Tag by question
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                disabled={scoreImportBusy.has(a.id)}
                                onClick={(e) => { e.stopPropagation(); importQuestionScores(a.id); }}
                                title="Pull per-student per-question scores from Canvas"
                              >
                                {scoreImportBusy.has(a.id)
                                  ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  : <Sparkles className="h-3 w-3 mr-1" />}
                                Import scores
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={(e) => { e.stopPropagation(); toggleExpand(a.id); }}
                              >
                                <ChevronRight className={`h-3 w-3 mr-1 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                {isExpanded ? "Hide" : "Show"} questions
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.max(0, idx - 1)); }}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.min(filtered.length - 1, idx + 1)); }}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {isQuiz && isExpanded && (
                      <div className="mt-3 ml-7 border-l-2 border-muted pl-3 space-y-2">
                        {!questionsByAssignment[a.id] ? (
                          <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading questions…
                          </div>
                        ) : questionsByAssignment[a.id].length === 0 ? (
                          <div className="text-xs text-muted-foreground py-2">No questions synced for this quiz.</div>
                        ) : (
                          questionsByAssignment[a.id].map((q) => {
                            const qTags = qTagsByQuestion[q.id] ?? [];
                            const qConfirmed = qTags.filter((t) => t.confirmed);
                            const qSuggested = qTags.filter((t) => t.ai_suggested && !t.confirmed);
                            return (
                              <div key={q.id} className="text-xs border rounded-md p-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-start gap-2">
                                  <span className="font-code text-muted-foreground shrink-0">Q{q.position ?? "?"}</span>
                                  <span className="line-clamp-2 flex-1">{q.question_text ?? <em className="text-muted-foreground">(no text)</em>}</span>
                                  {q.points_possible != null && (
                                    <span className="shrink-0 text-muted-foreground">{q.points_possible} pts</span>
                                  )}
                                </div>
                                {(qConfirmed.length > 0 || qSuggested.length > 0) && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {qConfirmed.map((t) => (
                                      <Badge key={t.id} className="bg-mastery-high/10 text-mastery-high border-mastery-high/30 text-[11px]" variant="outline">
                                        <Check className="h-2.5 w-2.5 mr-0.5" /> {t.standards?.code}
                                        <button onClick={() => removeQTag(t, a.id)} className="ml-1 opacity-70 hover:opacity-100">
                                          <Trash2 className="h-2.5 w-2.5" />
                                        </button>
                                      </Badge>
                                    ))}
                                    {qSuggested.map((t) => (
                                      <Tooltip key={t.id}>
                                        <TooltipTrigger asChild>
                                          <div className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/5 px-1.5 py-0.5 text-[11px]">
                                            <Sparkles className="h-2.5 w-2.5 text-accent" />
                                            <span className="font-code">{t.standards?.code}</span>
                                            {t.confidence != null && <span className="text-muted-foreground">{Math.round(t.confidence * 100)}%</span>}
                                            <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={() => confirmQTag(t, a.id)} title="Confirm">
                                              <Check className="h-2.5 w-2.5 text-mastery-high" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={() => removeQTag(t, a.id)} title="Reject">
                                              <X className="h-2.5 w-2.5" />
                                            </Button>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm">
                                          <div className="font-medium">{t.standards?.code}</div>
                                          <div className="text-xs mb-1">{t.standards?.description}</div>
                                          {t.rationale && <div className="text-xs italic opacity-80 whitespace-pre-wrap">"{t.rationale}"</div>}
                                        </TooltipContent>
                                      </Tooltip>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function MultiSelect({
  label, options, selected, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = selected.size === 0 ? `All ${label.toLowerCase()}s` : `${selected.size} ${label.toLowerCase()}${selected.size === 1 ? "" : "s"}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs">{label}: {summary}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filter by {label.toLowerCase()}</DialogTitle>
          <DialogDescription>Select one or more. Empty = no filter.</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto space-y-1">
          {options.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No options</div>}
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer">
              <Checkbox
                checked={selected.has(o.value)}
                onCheckedChange={() => {
                  const next = new Set(selected);
                  if (next.has(o.value)) next.delete(o.value); else next.add(o.value);
                  onChange(next);
                }}
              />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-between">
          <Button size="sm" variant="ghost" onClick={() => onChange(new Set())}>Clear</Button>
          <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OverrideButton({
  standards, onPick,
}: {
  standards: { id: string; code: string; description: string }[];
  onPick: (standardId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => e.stopPropagation()} title="Override">
          <Replace className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Override with another standard</DialogTitle>
          <DialogDescription>Rejects the AI suggestion and assigns the standard you pick.</DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search code or keyword…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {standards.map((s) => (
                <CommandItem key={s.id} value={`${s.code} ${s.description}`} onSelect={() => { onPick(s.id); setOpen(false); }}>
                  <span className="font-code text-xs mr-2 text-muted-foreground">{s.code}</span>
                  <span className="truncate">{s.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function AddStandardInline({
  assignmentId, standards, onAdded,
}: {
  assignmentId: string;
  standards: { id: string; code: string; description: string }[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  async function add(stdId: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("assignment_standards").upsert({
      teacher_id: u.user.id, assignment_id: assignmentId, standard_id: stdId,
      ai_suggested: false, confirmed: true,
    }, { onConflict: "assignment_id,standard_id" });
    if (error) toast.error(error.message); else { toast.success("Added"); setOpen(false); onAdded(); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={(e) => e.stopPropagation()}>+ Add</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add a standard manually</DialogTitle>
          <DialogDescription>Search by code or keyword.</DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {standards.map((s) => (
                <CommandItem key={s.id} value={`${s.code} ${s.description}`} onSelect={() => add(s.id)}>
                  <span className="font-code text-xs mr-2 text-muted-foreground">{s.code}</span>
                  <span className="truncate">{s.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
