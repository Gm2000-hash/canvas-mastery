import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSync } from "@/contexts/SyncContext";

type CanvasCourse = {
  canvas_course_id: number;
  name: string;
  course_code: string | null;
  term: string | null;
  workflow_state: string | null;
  total_students: number | null;
  already_imported: boolean;
  current_discipline_id: string | null;
};

type Discipline = { id: string; state: string; subject: string; grade: string; is_default: boolean };

export function ImportCoursesDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<CanvasCourse[] | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [disciplineByCourse, setDisciplineByCourse] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState("");
  const { syncing: importing, runCanvasSync } = useSync();

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
    // Pre-fill discipline picks from existing imports + default
    const defaultDisc = (ds ?? []).find((d) => d.is_default)?.id ?? "";
    const map: Record<number, string> = {};
    for (const c of list) {
      map[c.canvas_course_id] = c.current_discipline_id ?? defaultDisc;
    }
    setDisciplineByCourse(map);
    // Pre-select already imported courses for convenience? No — leave selection empty.
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

  async function importNow() {
    if (selected.size === 0) { toast.error("Pick at least one course"); return; }
    const assignments = Array.from(selected).map((cid) => ({
      canvas_course_id: cid,
      discipline_id: disciplineByCourse[cid] || null,
    }));
    // Close immediately — the global sync pill keeps the user informed
    // and the sync continues even if they navigate away.
    setOpen(false);
    onImported?.();
    await runCanvasSync({
      course_ids: Array.from(selected),
      discipline_assignments: assignments,
    });
    onImported?.();
  }

  const filtered = (courses ?? []).filter((c) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.course_code ?? "").toLowerCase().includes(q) ||
      (c.term ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Download className="h-4 w-4 mr-2" /> Import courses</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import courses from Canvas</DialogTitle>
          <DialogDescription>
            Pick which Canvas courses to track and which discipline they belong to. You can change this later on the Courses page.
          </DialogDescription>
        </DialogHeader>

        {disciplines.length === 0 && !loading && (
          <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm">
            Add at least one discipline in <span className="font-medium">Settings → Disciplines</span> before importing — the AI needs to know which standards library to use.
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, code, or term…" className="pl-7 h-8" />
          </div>
          <Button size="sm" variant="ghost" onClick={() => selectAllVisible(filtered)}>Select all visible</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Reload
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
          {loading || courses === null ? (
            <div className="p-3 space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-center text-muted-foreground">No courses match.</div>
          ) : (
            filtered.map((c) => {
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
                      {c.workflow_state && c.workflow_state !== "available" && (
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
            })
          )}
        </div>

        <DialogFooter>
          <div className="text-xs text-muted-foreground mr-auto">{selected.size} selected</div>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>Cancel</Button>
          <Button onClick={importNow} disabled={importing || selected.size === 0}>
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {selected.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
