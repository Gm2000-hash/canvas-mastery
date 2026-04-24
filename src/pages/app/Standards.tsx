import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, BookMarked } from "lucide-react";
import { FRAMEWORKS, getFramework, SUBJECTS, GRADES, STATES, type FrameworkId } from "@/lib/frameworks";

type Standard = {
  id: string;
  teacher_id: string | null;
  code: string;
  description: string;
  subject: string;
  grade: string;
  state: string;
  framework: string | null;
};

export default function Standards() {
  const [rows, setRows] = useState<Standard[]>([]);
  const [filter, setFilter] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("ALL");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "STATE" | "NATIONAL">("ALL");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [profile, setProfile] = useState<{ state: string | null; default_subject: string | null; default_grade: string | null } | null>(null);

  async function load() {
    const { data } = await supabase.from("standards").select("*").order("code");
    setRows((data as any) ?? []);
  }
  useEffect(() => {
    load();
    supabase.from("profiles").select("state, default_subject, default_grade").maybeSingle().then(({ data }) => setProfile(data as any));
  }, []);

  // Distinct frameworks/subjects/grades present in the loaded rows for filter chip options
  const presentFrameworks = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.framework ?? "STATE"));
    return Array.from(s);
  }, [rows]);

  const visible = rows.filter((r) => {
    const fw = r.framework ?? "STATE";
    if (frameworkFilter !== "ALL" && fw !== frameworkFilter) return false;
    if (subjectFilter !== "ALL" && r.subject !== subjectFilter) return false;
    if (gradeFilter !== "ALL" && r.grade !== gradeFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      if (!r.code.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-semibold mb-2">Standards library</h1>
          <p className="text-muted-foreground">Seeded standards (shared) + your custom ones.</p>
        </div>
        <AddStandardDialog defaults={profile} onAdded={load} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Filter by code or keyword…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Framework</Label>
          <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All frameworks</SelectItem>
              {presentFrameworks.map((f) => (
                <SelectItem key={f} value={f}>{getFramework(f).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Subject</Label>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Grade</Label>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{visible.length} of {rows.length}</div>
      </div>

      {visible.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <BookMarked className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No standards match. Seed your library from <strong>Settings → What I teach → Seed</strong>.</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {visible.map((s) => {
            const fw = getFramework(s.framework);
            return (
              <div key={s.id} className="p-4 flex items-start gap-4 hover:bg-muted/30">
                <div className="font-mono text-xs text-muted-foreground w-40 shrink-0 pt-0.5 break-all">{s.code}</div>
                <div className="flex-1 min-w-0 text-sm">{s.description}</div>
                <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]" title={fw.description}>{fw.shortLabel}</Badge>
                  <span>{s.state || "—"} · {s.subject} · G{s.grade}</span>
                </div>
                {s.teacher_id !== null && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const { error } = await supabase.from("standards").delete().eq("id", s.id);
                    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
                  }}><Trash2 className="h-3 w-3" /></Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddStandardDialog({ defaults, onAdded }: { defaults: any; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [framework, setFramework] = useState<FrameworkId>("STATE");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState(defaults?.state ?? "");
  const [subject, setSubject] = useState(defaults?.default_subject ?? "");
  const [grade, setGrade] = useState(defaults?.default_grade ?? "");
  const fw = getFramework(framework);

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
    if (!code.trim() || !description.trim() || !subject || !grade) { toast.error("Code, description, subject and grade are required"); return; }
    if (!fw.national && !state) { toast.error("State is required for state standards"); return; }
    const { error } = await supabase.from("standards").insert({
      teacher_id: u.user.id,
      code: code.trim(),
      description: description.trim(),
      state: state || "",
      subject,
      grade,
      framework,
    });
    if (error) toast.error(error.message); else { toast.success("Added"); onAdded(); setOpen(false); setCode(""); setDescription(""); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add custom standard</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a custom standard</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Framework</Label>
            <Select value={framework} onValueChange={(v) => setFramework(v as FrameworkId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FRAMEWORKS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{fw.description}</p>
          </div>
          <div className="space-y-2"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. DIST-MATH-7.4" /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>State {fw.national && <span className="text-muted-foreground text-xs">(opt.)</span>}</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={add}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
