import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus } from "lucide-react";
import { isChapter } from "@/modules/curriculum/lib/textbook-chapter";

type Unit = { id: string; title: string; discipline: string | null; sort_order: number | null };
type Lesson = { id: string; unit_id: string; title: string; sort_order: number; chapter: unknown };
type Item = { id: string; title: string; subject: string | null; chapter: unknown };

export type NewChapter = { source: "lesson" | "library_item"; id: string; part_title: string | null };

export function AddChaptersDialog({ open, onClose, onAdd, existing }: { open: boolean; onClose: () => void; onAdd: (rows: NewChapter[]) => Promise<void>; existing: Set<string> }) {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [discipline, setDiscipline] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [partTitle, setPartTitle] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    (async () => {
      const [u, l, i] = await Promise.all([
        supabase.from("units").select("id, title, discipline, sort_order").order("sort_order"),
        supabase.from("curriculum_lessons").select("id, unit_id, title, sort_order, chapter").order("sort_order"),
        supabase.from("library_items").select("id, title, subject, chapter").eq("kind", "reading").order("updated_at", { ascending: false }),
      ]);
      setUnits((u.data ?? []) as Unit[]);
      setLessons((l.data ?? []) as Lesson[]);
      setItems((i.data ?? []) as Item[]);
      const first = (u.data ?? []).find((x: any) => x.discipline)?.discipline;
      if (first && !discipline) setDiscipline(first);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const disciplines = useMemo(() => Array.from(new Set((units ?? []).map((u) => u.discipline).filter(Boolean))) as string[], [units]);
  const subjectUnits = useMemo(() => (units ?? []).filter((u) => u.discipline === discipline), [units, discipline]);
  const subjectRows = useMemo(() => subjectUnits.flatMap((u) => lessons.filter((l) => l.unit_id === u.id).map((l) => ({ source: "lesson" as const, id: l.id, part_title: u.title }))).filter((r) => !existing.has(`lesson:${r.id}`)), [subjectUnits, lessons, existing]);

  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const ql = q.toLowerCase();
  const lessonOpts = lessons.filter((l) => !existing.has(`lesson:${l.id}`) && l.title.toLowerCase().includes(ql));
  const itemOpts = items.filter((i) => !existing.has(`library_item:${i.id}`) && i.title.toLowerCase().includes(ql));
  const unitTitle = (id: string) => units?.find((u) => u.id === id)?.title ?? "";

  async function addSubject() {
    if (!subjectRows.length) { toast.info("No new readings in this subject"); return; }
    setBusy(true); try { await onAdd(subjectRows); onClose(); } finally { setBusy(false); }
  }
  async function addPicked() {
    const rows: NewChapter[] = Array.from(picked).map((k) => { const [source, id] = k.split(":") as ["lesson" | "library_item", string]; return { source, id, part_title: partTitle.trim() || null }; });
    if (!rows.length) { toast.error("Pick at least one reading"); return; }
    setBusy(true); try { await onAdd(rows); onClose(); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add chapters</DialogTitle>
          <DialogDescription>Build from a whole subject (units become parts) or hand-pick individual readings from the Curriculum suite and your Library.</DialogDescription>
        </DialogHeader>
        {units === null ? <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading readings…</div> : (
          <Tabs defaultValue="subject">
            <TabsList className="grid grid-cols-2"><TabsTrigger value="subject">Build from a subject</TabsTrigger><TabsTrigger value="pick">Pick readings</TabsTrigger></TabsList>
            <TabsContent value="subject" className="space-y-3 pt-3">
              {disciplines.length === 0 ? <p className="text-sm text-muted-foreground">No units with a subject yet. Create units in the Lesson Planner first, or pick readings by hand.</p> : (
                <>
                  <div className="space-y-1.5">
                    <Label>Subject</Label>
                    <Select value={discipline} onValueChange={setDiscipline}><SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger><SelectContent>{disciplines.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="rounded-xl border border-border max-h-72 overflow-y-auto divide-y divide-border text-sm">
                    {subjectUnits.map((u) => {
                      const ls = lessons.filter((l) => l.unit_id === u.id);
                      return (
                        <div key={u.id} className="p-3">
                          <p className="font-semibold">{u.title} <span className="text-xs text-muted-foreground font-normal">· {ls.length} reading{ls.length === 1 ? "" : "s"}</span></p>
                          <ul className="mt-1 space-y-0.5 text-muted-foreground">{ls.map((l) => <li key={l.id} className="flex items-center gap-2 truncate">{l.title}{isChapter(l.chapter) && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Chapter</Badge>}{existing.has(`lesson:${l.id}`) && <span className="text-[10px]">(already in book)</span>}</li>)}</ul>
                        </div>
                      );
                    })}
                    {subjectUnits.length === 0 && <p className="p-3 text-muted-foreground">No units in this subject.</p>}
                  </div>
                  <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={addSubject} disabled={busy || !subjectRows.length}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Add {subjectRows.length} chapters</Button></DialogFooter>
                </>
              )}
            </TabsContent>
            <TabsContent value="pick" className="space-y-3 pt-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input placeholder="Search readings…" value={q} onChange={(e) => setQ(e.target.value)} />
                <Input placeholder="Part title for these chapters (optional)" value={partTitle} onChange={(e) => setPartTitle(e.target.value)} />
              </div>
              <div className="rounded-xl border border-border max-h-72 overflow-y-auto divide-y divide-border text-sm">
                {lessonOpts.map((l) => (
                  <label key={l.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-accent/30">
                    <Checkbox checked={picked.has(`lesson:${l.id}`)} onCheckedChange={() => toggle(`lesson:${l.id}`)} />
                    <span className="flex-1 truncate">{l.title}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[40%]">{unitTitle(l.unit_id)}</span>
                    {isChapter(l.chapter) && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Chapter</Badge>}
                  </label>
                ))}
                {itemOpts.map((i) => (
                  <label key={i.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-accent/30">
                    <Checkbox checked={picked.has(`library_item:${i.id}`)} onCheckedChange={() => toggle(`library_item:${i.id}`)} />
                    <span className="flex-1 truncate">{i.title}</span>
                    <span className="text-xs text-muted-foreground">Library{i.subject ? ` · ${i.subject}` : ""}</span>
                    {isChapter(i.chapter) && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Chapter</Badge>}
                  </label>
                ))}
                {!lessonOpts.length && !itemOpts.length && <p className="p-3 text-muted-foreground">No readings match.</p>}
              </div>
              <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={addPicked} disabled={busy || !picked.size}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Add {picked.size || ""} chapters</Button></DialogFooter>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
