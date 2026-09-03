// Lists imported quiz questions that have no standard tag yet, with bulk
// AI tagging and manual "apply standard" actions.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { BulkTagActions } from "./BulkTagActions";

type Row = { id: string; position: number | null; question_text: string | null; assignment_id: string; assignment_name: string; course_id: string };

export async function countUntaggedQuestions(): Promise<number> {
  const [{ count: total }, tagged] = await Promise.all([
    supabase.from("quiz_questions").select("id", { count: "exact", head: true }),
    fetchTaggedIds(),
  ]);
  return Math.max(0, (total ?? 0) - tagged.size);
}

async function fetchTaggedIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await supabase.from("question_standards").select("question_id").range(from, from + 999);
    (data ?? []).forEach((r: any) => ids.add(r.question_id));
    if (!data || data.length < 1000) break;
  }
  return ids;
}

export function UntaggedQuestionsDialog({ open, onOpenChange, courses, onChanged, subjectHint }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: { id: string; name: string }[];
  onChanged: () => void;
  subjectHint?: string | null;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [courseId, setCourseId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setRows(null);
    setSelected(new Set());
    const tagged = await fetchTaggedIds();
    const out: Row[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await supabase.from("quiz_questions")
        .select("id, position, question_text, assignment_id, assignments!inner(name, course_id)")
        .order("created_at", { ascending: false }).range(from, from + 999);
      if (error) { toast.error(error.message); break; }
      (data ?? []).forEach((q: any) => {
        if (!tagged.has(q.id)) out.push({ id: q.id, position: q.position, question_text: q.question_text, assignment_id: q.assignment_id, assignment_name: q.assignments?.name ?? "Quiz", course_id: q.assignments?.course_id });
      });
      if (!data || data.length < 1000) break;
    }
    setRows(out);
  }

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (rows ?? []).filter((r) =>
      (courseId === "ALL" || r.course_id === courseId) &&
      (!needle || (r.question_text ?? "").toLowerCase().includes(needle) || r.assignment_name.toLowerCase().includes(needle)),
    ).slice(0, 500);
  }, [rows, courseId, search]);

  const selectedRows = useMemo(() => (rows ?? []).filter((r) => selected.has(r.id)), [rows, selected]);
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col" style={{ fontFamily: "'Nunito Sans', system-ui, sans-serif" }}>
        <DialogHeader>
          <DialogTitle>Untagged questions</DialogTitle>
          <DialogDescription>
            {rows ? `${rows.length} imported question${rows.length === 1 ? "" : "s"} ha${rows.length === 1 ? "s" : "ve"} no standard yet. Select some, then let AI suggest tags or apply a standard yourself.` : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All my courses</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text or quiz name…" className="pl-7 h-9" />
          </div>
        </div>

        <BulkTagActions
          selected={selectedRows}
          allIds={visible.map((v) => v.id)}
          onSelectAll={() => setSelected(new Set(visible.map((v) => v.id)))}
          onClear={() => setSelected(new Set())}
          onDone={() => { load(); onChanged(); }}
          subjectHint={subjectHint}
        />

        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
          {!rows ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            : visible.length === 0 ? <div className="py-12 text-center text-muted-foreground text-sm">Every question here has at least one standard. Nice.</div>
            : visible.map((r) => (
              <label key={r.id} className="flex items-start gap-3 rounded-lg border bg-card hover:bg-muted/40 transition p-3 cursor-pointer">
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} className="mt-0.5" />
                <div className="shrink-0 text-xs text-muted-foreground tabular-nums w-8 pt-0.5">Q{r.position ?? "?"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm line-clamp-2">{r.question_text?.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() || <span className="italic text-muted-foreground">(no text)</span>}</div>
                  <Badge variant="outline" className="text-[11px] mt-1">{r.assignment_name}</Badge>
                </div>
              </label>
            ))}
          {rows && visible.length === 500 && <p className="text-xs text-muted-foreground text-center py-2">Showing the first 500 — narrow by course or search to see more.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
