import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertTriangle, Download, History as HistoryIcon, Loader2, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSync } from "@/contexts/SyncContext";
import { currentSchoolYearLabel } from "@/lib/schoolYear";
import { BackfillReportDialog } from "@/components/BackfillReportDialog";

type CanvasCourse = {
  canvas_course_id: number;
  name: string;
  course_code: string | null;
  term: string | null;
  workflow_state: string | null;
  total_students: number | null;
  end_at: string | null;
  school_year: string | null;
  already_imported: boolean;
  current_discipline_id: string | null;
};

type Discipline = { id: string; state: string; subject: string; grade: string; is_default: boolean };

type Props = {
  onImported?: () => void;
  /** "all" = standard import; "backfill" = focus on previous school years. */
  mode?: "all" | "backfill";
  /** Custom trigger button. Defaults to a primary "Import courses" button. */
  trigger?: React.ReactNode;
};

const ANY = "__any__";

export function ImportCoursesDialog({ onImported, mode = "all", trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<CanvasCourse[] | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [disciplineByCourse, setDisciplineByCourse] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState("");
  const [yearFilter, setYearFilter] = useState<string>(ANY);
  const [hideAlreadyImported, setHideAlreadyImported] = useState(mode === "backfill");
  const [pastOnly, setPastOnly] = useState(mode === "backfill");
  const { syncing: importing, runCanvasSync } = useSync();

  // Confirmation + report state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState<CanvasCourse[]>([]);
  const [pendingFresh, setPendingFresh] = useState<number[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCourseIds, setReportCourseIds] = useState<string[]>([]);

  const isBackfill = mode === "backfill";
  const currentYear = useMemo(() => currentSchoolYearLabel(), []);

  async function load() {
    setLoading(true);
    setCourses(null);
    const [{ data: ds }, listRes] = await Promise.all([
      supabase.from("teacher_disciplines").select("id, state, subject, grade, is_default").order("created_at"),
      supabase.functions.invoke("canvas-list-courses"),
    ]);
    setDisciplines((ds ?? []) as Discipline[]);
    setLoading(false);
    if (listRes.error) { toast.error((listRes.error as any).message ?? "Failed to load Canvas courses"); return; }
    if ((listRes.data as any)?.error) { toast.error((listRes.data as any).error); return; }
    const list = ((listRes.data as any)?.courses ?? []) as CanvasCourse[];
    setCourses(list);
    const defaultDisc = (ds ?? []).find((d) => d.is_default)?.id ?? "";
    const map: Record<number, string> = {};
    for (const c of list) {
      map[c.canvas_course_id] = c.current_discipline_id ?? defaultDisc;
    }
    setDisciplineByCourse(map);
    setSelected(new Set());
  }

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllVisible(filtered: CanvasCourse[]) {
    setSelected(new Set(filtered.map((c) => c.canvas_course_id)));
  }
  function clearSelection() { setSelected(new Set()); }

  async function performImport(canvasIds: number[]) {
    if (canvasIds.length === 0) {
      toast.info("Nothing to import after skipping duplicates.");
      return;
    }
    const assignments = canvasIds.map((cid) => ({
      canvas_course_id: cid,
      discipline_id: disciplineByCourse[cid] || null,
    }));
    setOpen(false);
    onImported?.();
    const result = await runCanvasSync({
      course_ids: canvasIds,
      discipline_assignments: assignments,
    });
    onImported?.();

    // Post-backfill report — only for the back-fill flow and only on success
    if (isBackfill && result.ok) {
      const { data: rows } = await supabase
        .from("courses")
        .select("id, canvas_course_id")
        .in("canvas_course_id", canvasIds);
      const internalIds = (rows ?? []).map((r) => r.id as string);
      if (internalIds.length > 0) {
        setReportCourseIds(internalIds);
        setReportOpen(true);
      }
    }
  }

  function handleImportClick() {
    if (selected.size === 0) { toast.error("Pick at least one course"); return; }
    const list = Array.from(selected);
    const dupes = (courses ?? []).filter(
      (c) => c.already_imported && selected.has(c.canvas_course_id),
    );
    const fresh = list.filter(
      (cid) => !(courses ?? []).find((c) => c.canvas_course_id === cid)?.already_imported,
    );

    if (dupes.length > 0) {
      setPendingDuplicates(dupes);
      setPendingFresh(fresh);
      setConfirmOpen(true);
      return;
    }
    void performImport(list);
  }

  // Available school years across all courses, newest first
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    for (const c of courses ?? []) if (c.school_year) years.add(c.school_year);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [courses]);

  const filtered = useMemo(() => {
    return (courses ?? []).filter((c) => {
      if (hideAlreadyImported && c.already_imported) return false;
      if (pastOnly && c.school_year && c.school_year === currentYear) return false;
      if (yearFilter !== ANY && c.school_year !== yearFilter) return false;
      if (!filter.trim()) return true;
      const q = filter.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.course_code ?? "").toLowerCase().includes(q) ||
        (c.term ?? "").toLowerCase().includes(q)
      );
    });
  }, [courses, filter, yearFilter, hideAlreadyImported, pastOnly, currentYear]);

  // Group filtered courses by school year for back-fill view
  const grouped = useMemo(() => {
    const map = new Map<string, CanvasCourse[]>();
    for (const c of filtered) {
      const key = c.school_year ?? "Unknown year";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const defaultTrigger = isBackfill ? (
    <Button variant="outline">
      <HistoryIcon className="h-4 w-4 mr-2" /> Back-fill previous classes
    </Button>
  ) : (
    <Button><Download className="h-4 w-4 mr-2" /> Import courses</Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isBackfill ? "Back-fill previous classes" : "Import courses from Canvas"}
          </DialogTitle>
          <DialogDescription>
            {isBackfill
              ? "Pull in concluded Canvas courses to back-fill student data — past assignments, submissions, and quiz responses are imported and tied to each student's longitudinal record."
              : "Pick which Canvas courses to track and which discipline they belong to. You can change this later on the Courses page."}
          </DialogDescription>
        </DialogHeader>

        {disciplines.length === 0 && !loading && (
          <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm">
            Add at least one discipline in <span className="font-medium">Settings → Disciplines</span> before importing — the AI needs to know which standards library to use.
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, code, or term…" className="pl-7 h-8" />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="School year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All school years</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>{y}{y === currentYear ? " (current)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={pastOnly ? "secondary" : "ghost"}
            onClick={() => setPastOnly((v) => !v)}
            title="Hide courses from the current school year"
          >
            Past years only
          </Button>
          <Button
            size="sm"
            variant={hideAlreadyImported ? "secondary" : "ghost"}
            onClick={() => setHideAlreadyImported((v) => !v)}
          >
            Hide already imported
          </Button>
          <Button size="sm" variant="ghost" onClick={() => selectAllVisible(filtered)}>Select visible</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Reload
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
          {loading || courses === null ? (
            <div className="p-3 space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-center text-muted-foreground">
              {isBackfill
                ? "No previous Canvas classes found that match these filters."
                : "No courses match."}
            </div>
          ) : (
            grouped.map(([year, list]) => (
              <div key={year}>
                <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b flex items-center justify-between">
                  <span>
                    {year}
                    {year === currentYear && (
                      <Badge variant="outline" className="ml-2 text-[9px]">current</Badge>
                    )}
                  </span>
                  <button
                    className="text-[10px] hover:text-foreground"
                    onClick={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const c of list) next.add(c.canvas_course_id);
                        return next;
                      })
                    }
                  >
                    Select all in {year}
                  </button>
                </div>
                <div className="divide-y">
                  {list.map((c) => {
                    const isSelected = selected.has(c.canvas_course_id);
                    return (
                      <label key={c.canvas_course_id} className="flex items-start gap-3 p-3 hover:bg-muted/40 cursor-pointer">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(c.canvas_course_id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{c.name}</span>
                            {c.course_code && <Badge variant="outline" className="text-[10px]">{c.course_code}</Badge>}
                            {c.already_imported && <Badge className="text-[10px] bg-mastery-high/10 text-mastery-high border-mastery-high/30" variant="outline">Already imported</Badge>}
                            {c.workflow_state === "completed" && (
                              <Badge variant="outline" className="text-[10px]">concluded</Badge>
                            )}
                            {c.workflow_state && c.workflow_state !== "available" && c.workflow_state !== "completed" && (
                              <Badge variant="outline" className="text-[10px] capitalize">{c.workflow_state}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {c.term ?? "No term"} · {c.total_students ?? 0} students
                          </div>
                        </div>
                        <div className="w-44 shrink-0" onClick={(e) => e.preventDefault()}>
                          <Select
                            value={disciplineByCourse[c.canvas_course_id] ?? ""}
                            onValueChange={(v) => setDisciplineByCourse((m) => ({ ...m, [c.canvas_course_id]: v }))}
                            disabled={disciplines.length === 0}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Discipline" /></SelectTrigger>
                            <SelectContent>
                              {disciplines.map((d) => (
                                <SelectItem key={d.id} value={d.id} className="text-xs">
                                  {d.subject} · {d.grade} · {d.state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <div className="text-xs text-muted-foreground mr-auto">
            {selected.size} selected
            {isBackfill && selected.size > 0 && " · will sync students, assignments, submissions & quiz responses"}
          </div>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>Cancel</Button>
          <Button onClick={handleImportClick} disabled={importing || selected.size === 0}>
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isBackfill ? "Back-fill" : "Import"} {selected.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
