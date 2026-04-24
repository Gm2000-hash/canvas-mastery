import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, BookMarked } from "lucide-react";

type Standard = { id: string; teacher_id: string | null; code: string; description: string; subject: string; grade: string; state: string };

export default function Standards() {
  const [rows, setRows] = useState<Standard[]>([]);
  const [filter, setFilter] = useState("");
  const [profile, setProfile] = useState<{ state: string | null; default_subject: string | null; default_grade: string | null } | null>(null);

  async function load() {
    const { data } = await supabase.from("standards").select("*").order("code");
    setRows((data as any) ?? []);
  }
  useEffect(() => {
    load();
    supabase.from("profiles").select("state, default_subject, default_grade").maybeSingle().then(({ data }) => setProfile(data as any));
  }, []);

  const visible = rows.filter((r) =>
    !filter ||
    r.code.toLowerCase().includes(filter.toLowerCase()) ||
    r.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-semibold mb-2">Standards library</h1>
          <p className="text-muted-foreground">Seeded standards (shared) + your custom ones.</p>
        </div>
        <AddStandardDialog defaults={profile} onAdded={load} />
      </div>

      <Input placeholder="Filter by code or keyword…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-md" />

      {visible.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <BookMarked className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No standards yet. Seed your library from <strong>Settings → Seed your standards library</strong>.</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {visible.map((s) => (
            <div key={s.id} className="p-4 flex items-start gap-4 hover:bg-muted/30">
              <div className="font-mono text-xs text-muted-foreground w-32 shrink-0 pt-0.5">{s.code}</div>
              <div className="flex-1 min-w-0 text-sm">{s.description}</div>
              <div className="text-xs text-muted-foreground shrink-0">{s.state} · {s.subject} · G{s.grade}</div>
              {s.teacher_id !== null && (
                <Button size="sm" variant="ghost" onClick={async () => {
                  const { error } = await supabase.from("standards").delete().eq("id", s.id);
                  if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
                }}><Trash2 className="h-3 w-3" /></Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddStandardDialog({ defaults, onAdded }: { defaults: any; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState(defaults?.state ?? "");
  const [subject, setSubject] = useState(defaults?.default_subject ?? "");
  const [grade, setGrade] = useState(defaults?.default_grade ?? "");

  useEffect(() => {
    if (defaults) {
      setState(defaults.state ?? "");
      setSubject(defaults.default_subject ?? "");
      setGrade(defaults.default_grade ?? "");
    }
  }, [defaults]);

  async function add() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!code.trim() || !description.trim() || !state || !subject || !grade) { toast.error("All fields required"); return; }
    const { error } = await supabase.from("standards").insert({
      teacher_id: u.user.id, code: code.trim(), description: description.trim(),
      state, subject, grade,
    });
    if (error) toast.error(error.message); else { toast.success("Added"); onAdded(); setOpen(false); setCode(""); setDescription(""); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add custom standard</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a custom standard</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. DIST-MATH-7.4" /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>State</Label><Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div className="space-y-2"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={add}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
