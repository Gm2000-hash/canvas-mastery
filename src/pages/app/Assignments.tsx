import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Check, Trash2, Loader2, RefreshCw, BookOpen, Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ImportQuizCsvDialog from "@/components/ImportQuizCsvDialog";

type Discipline = { id: string; state: string | null; subject: string; grade: string; framework: string | null; is_default: boolean };

type Assignment = {
  id: string; name: string; kind: "assignment" | "quiz"; description: string | null;
  course_id: string; due_at: string | null; canvas_quiz_id: number | null;
};
type Course = { id: string; name: string; discipline_id: string | null };
type StandardTag = {
  id: string; standard_id: string; ai_suggested: boolean; confirmed: boolean; confidence: number | null; rationale: string | null;
  standards: { code: string; description: string };
};

export default function Assignments() {
  const [params, setParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [courseId, setCourseId] = useState<string>(params.get("course") ?? "");
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [tagsByAssignment, setTagsByAssignment] = useState<Record<string, StandardTag[]>>({});
  const [recomputing, setRecomputing] = useState(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [csvOpen, setCsvOpen] = useState(false);

  const currentCourse = useMemo(() => (courses ?? []).find((c) => c.id === courseId) ?? null, [courses, courseId]);
  const effectiveDiscipline = useMemo(() => {
    if (!currentCourse) return null;
    if (currentCourse.discipline_id) return disciplines.find((d) => d.id === currentCourse.discipline_id) ?? null;
    return disciplines.find((d) => d.is_default) ?? null;
  }, [currentCourse, disciplines]);

  async function loadCourses() {
    const { data } = await supabase.from("courses").select("id, name, discipline_id").order("name");
    setCourses((data as Course[]) ?? []);
    if (!courseId && data?.length) setCourseId(data[0].id);
  }
  async function loadDisciplines() {
    const { data } = await supabase
      .from("teacher_disciplines")
      .select("id, state, subject, grade, framework, is_default")
      .order("grade");
    setDisciplines((data as Discipline[]) ?? []);
  }
  useEffect(() => { loadCourses(); loadDisciplines(); /* eslint-disable-next-line */ }, []);

  async function loadAssignments(cid: string) {
    setAssignments(null);
    const { data: a } = await supabase
      .from("assignments").select("id, name, kind, description, course_id, due_at, canvas_quiz_id")
      .eq("course_id", cid).order("due_at", { ascending: false, nullsFirst: false }).order("name");
    setAssignments(a ?? []);
    if (a?.length) {
      const ids = a.map((x) => x.id);
      const { data: tags } = await supabase
        .from("assignment_standards")
        .select("id, assignment_id, standard_id, ai_suggested, confirmed, confidence, rationale, standards ( code, description )")
        .in("assignment_id", ids);
      const map: Record<string, StandardTag[]> = {};
      for (const t of (tags as any[]) ?? []) {
        (map[t.assignment_id] ??= []).push(t as StandardTag);
      }
      setTagsByAssignment(map);
    }
  }
  useEffect(() => { if (courseId) { setParams((p) => { p.set("course", courseId); return p; }, { replace: true }); loadAssignments(courseId); } /* eslint-disable-next-line */ }, [courseId]);

  async function recompute() {
    setRecomputing(true);
    const { data, error } = await supabase.functions.invoke("recompute-mastery");
    setRecomputing(false);
    if (error) { toast.error((error as any).message); return; }
    toast.success(`Mastery recomputed (${(data as any).snapshots} entries)`);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-semibold mb-2">Assignments</h1>
          <p className="text-muted-foreground">Tag each assignment with one or more standards.</p>
        </div>
        <Button variant="outline" onClick={recompute} disabled={recomputing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${recomputing ? "animate-spin" : ""}`} />
          Recompute mastery
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Course:</span>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>{(courses ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        {currentCourse && (
          <DisciplinePicker
            course={currentCourse}
            disciplines={disciplines}
            effective={effectiveDiscipline}
            onChange={async (newId) => {
              const { error } = await supabase
                .from("courses")
                .update({ discipline_id: newId })
                .eq("id", currentCourse.id);
              if (error) { toast.error(error.message); return; }
              toast.success("Discipline updated for this course");
              await loadCourses();
            }}
          />
        )}
      </div>

      {assignments === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : assignments.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No assignments. Run a sync from the Dashboard.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              tags={tagsByAssignment[a.id] ?? []}
              onChange={() => loadAssignments(courseId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentRow({ assignment, tags, onChange }: { assignment: Assignment; tags: StandardTag[]; onChange: () => void }) {
  const [tagging, setTagging] = useState(false);
  const [importing, setImporting] = useState(false);

  async function aiSuggest() {
    setTagging(true);
    const { data, error } = await supabase.functions.invoke("tag-standards", { body: { assignment_id: assignment.id } });
    setTagging(false);
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const d = data as any;
    const n = d.suggestions?.length ?? 0;
    if (n > 0) {
      toast.success(`${n} suggestion${n > 1 ? "s" : ""} added — review & confirm`);
    } else {
      const disc = d.discipline ?? {};
      const label = `${disc.framework ?? "STATE"} ${disc.subject ?? ""} grade ${disc.grade ?? "?"}`.trim();
      const used = d.questions_used ?? 0;
      const candidates = d.candidate_count ?? 0;
      toast.warning(
        `No strong match in ${label} (${candidates} standards, ${used} quiz question${used === 1 ? "" : "s"} read).`,
        { description: "Try changing this course's discipline above, or use + Add to tag manually." },
      );
    }
    onChange();
  }

  async function importScores() {
    setImporting(true);
    const { data, error } = await supabase.functions.invoke("canvas-sync-question-scores", {
      body: { assignment_ids: [assignment.id] },
    });
    setImporting(false);
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const stats = (data as any).stats ?? {};
    const recompute = (data as any).recompute;
    const result = ((data as any).results ?? [])[0];
    if (result?.status === "skipped") {
      toast.message(`Skipped: ${result.reason ?? "no data"}`);
    } else if (result?.status === "error") {
      toast.error(result.reason ?? "Import failed");
    } else {
      const note = recompute && recompute.snapshots > 0
        ? ` Mastery updated (${recompute.snapshots}).`
        : "";
      toast.success(`Imported ${stats.responses ?? 0} response${stats.responses === 1 ? "" : "s"}.${note}`);
    }
  }

  async function confirmTag(t: StandardTag) {
    const { error } = await supabase.from("assignment_standards").update({ confirmed: true }).eq("id", t.id);
    if (error) toast.error(error.message); else { toast.success(`Confirmed ${t.standards.code}`); onChange(); }
  }
  async function removeTag(t: StandardTag) {
    const { error } = await supabase.from("assignment_standards").delete().eq("id", t.id);
    if (error) toast.error(error.message); else onChange();
  }

  const confirmed = tags.filter((t) => t.confirmed);
  const suggested = tags.filter((t) => !t.confirmed);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              {assignment.name}
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{assignment.kind}</Badge>
            </CardTitle>
            {assignment.description && (
              <CardDescription className="line-clamp-2 mt-1">{assignment.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={aiSuggest} disabled={tagging}>
              {tagging ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              AI suggest
            </Button>
            {assignment.kind === "quiz" && (
              <Button
                size="sm"
                variant="outline"
                onClick={importScores}
                disabled={importing || !assignment.canvas_quiz_id}
                title={!assignment.canvas_quiz_id ? "No Canvas quiz linked" : "Import per-question scores from Canvas"}
              >
                {importing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                Import scores
              </Button>
            )}
            <AddStandardDialog assignmentId={assignment.id} onAdded={onChange} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {confirmed.map((t) => (
            <Badge key={t.id} className="bg-mastery-high/10 text-mastery-high border-mastery-high/30 hover:bg-mastery-high/20" variant="outline">
              <Check className="h-3 w-3 mr-1" /> {t.standards.code}
              <button onClick={() => removeTag(t)} className="ml-2 text-mastery-high/70 hover:text-mastery-high"><Trash2 className="h-3 w-3" /></button>
            </Badge>
          ))}
          {suggested.map((t) => (
            <div key={t.id} className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/5 px-2 py-1 text-xs">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="font-mono">{t.standards.code}</span>
              {t.confidence != null && <span className="text-muted-foreground">({Math.round(t.confidence * 100)}%)</span>}
              <span className="truncate max-w-[280px] text-muted-foreground">— {t.standards.description}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 ml-1" onClick={() => confirmTag(t)}><Check className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => removeTag(t)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          {tags.length === 0 && <span className="text-xs text-muted-foreground italic">No standards tagged yet.</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function AddStandardDialog({ assignmentId, onAdded }: { assignmentId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [standards, setStandards] = useState<{ id: string; code: string; description: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("standards").select("id, code, description").order("code").limit(1000);
      setStandards(data ?? []);
    })();
  }, [open]);

  async function add(stdId: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("assignment_standards").upsert({
      teacher_id: u.user.id, assignment_id: assignmentId, standard_id: stdId, ai_suggested: false, confirmed: true,
    }, { onConflict: "assignment_id,standard_id" });
    if (error) toast.error(error.message);
    else { toast.success("Standard added"); onAdded(); setOpen(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">+ Add</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a standard</DialogTitle>
          <DialogDescription>Search by code or keyword.</DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="e.g. 7.RP.A.2 or proportional" />
          <CommandList>
            <CommandEmpty>No standards found.</CommandEmpty>
            <CommandGroup>
              {standards.map((s) => (
                <CommandItem key={s.id} value={`${s.code} ${s.description}`} onSelect={() => add(s.id)}>
                  <span className="font-mono text-xs mr-2 text-muted-foreground">{s.code}</span>
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

function discLabel(d: Discipline | null): string {
  if (!d) return "—";
  const fw = d.framework && d.framework !== "STATE" ? d.framework : (d.state || "STATE");
  return `${fw} · ${d.subject} · Grade ${d.grade}`;
}

function DisciplinePicker({
  course, disciplines, effective, onChange,
}: {
  course: Course;
  disciplines: Discipline[];
  effective: Discipline | null;
  onChange: (newId: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const isExplicit = !!course.discipline_id;
  const sorted = useMemo(() => {
    return [...disciplines].sort((a, b) => {
      const ag = parseInt(a.grade) || 99;
      const bg = parseInt(b.grade) || 99;
      if (ag !== bg) return ag - bg;
      return a.subject.localeCompare(b.subject);
    });
  }, [disciplines]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="text-xs">
            <span className="text-muted-foreground">Discipline:</span>{" "}
            <span className="font-medium">{discLabel(effective)}</span>
            {!isExplicit && <span className="text-muted-foreground italic"> (default)</span>}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="text-xs text-muted-foreground px-2 pt-1 pb-2">
          AI suggestions and standards lookups will use this discipline for this course.
        </div>
        <div className="space-y-1">
          {sorted.map((d) => {
            const selected = course.discipline_id === d.id || (!course.discipline_id && d.is_default);
            return (
              <button
                key={d.id}
                onClick={async () => { await onChange(d.id); setOpen(false); }}
                className={`w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-accent flex items-center justify-between gap-2 ${selected ? "bg-accent/50" : ""}`}
              >
                <span className="truncate">{discLabel(d)}</span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}
          {disciplines.length === 0 && (
            <div className="text-xs text-muted-foreground px-2 py-3">
              No disciplines yet. Add one in Settings.
            </div>
          )}
          {isExplicit && (
            <button
              onClick={async () => { await onChange(null); setOpen(false); }}
              className="w-full text-left text-xs text-muted-foreground rounded-md px-2 py-1.5 hover:bg-accent mt-1 border-t pt-2"
            >
              Reset to teacher default
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

