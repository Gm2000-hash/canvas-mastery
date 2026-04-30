import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, BookMarked, Library } from "lucide-react";
import { FRAMEWORKS, getFramework, SUBJECTS, GRADES, STATES, type FrameworkId } from "@/lib/frameworks";
import QuestionsTab from "./standards/QuestionsTab";

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
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "questions" ? "questions" : "library";
  const setTab = (v: string) => {
    setParams((p) => {
      if (v === "library") p.delete("tab"); else p.set("tab", v);
      p.delete("std");
      return p;
    });
  };
  const openStandardInQuestions = (standardId: string) => {
    setParams((p) => {
      p.set("tab", "questions");
      p.set("std", standardId);
      return p;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Standards library</h1>
        <p className="text-muted-foreground">
          Browse standards by framework and explore the quiz questions tagged to each one.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="library" className="gap-2">
            <BookMarked className="h-4 w-4" /> Library
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-2">
            <Library className="h-4 w-4" /> Questions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-0">
          <StandardsLibraryTab onOpenQuestions={openStandardInQuestions} />
        </TabsContent>
        <TabsContent value="questions" className="mt-0">
          <QuestionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StandardsLibraryTab({ onOpenQuestions }: { onOpenQuestions: (standardId: string) => void }) {
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

  // If the user changes scope (State/National), drop a framework filter that no
  // longer fits — otherwise the dropdown would show an empty/invisible value.
  useEffect(() => {
    if (frameworkFilter === "ALL") return;
    const meta = getFramework(frameworkFilter);
    if (scopeFilter === "STATE" && meta.national) setFrameworkFilter("ALL");
    if (scopeFilter === "NATIONAL" && !meta.national) setFrameworkFilter("ALL");
  }, [scopeFilter, frameworkFilter]);

  // Distinct frameworks/subjects/grades present in the loaded rows for filter chip options
  const presentFrameworks = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.framework ?? "STATE"));
    return Array.from(s);
  }, [rows]);

  // Per-subject breakdown so teachers can see "what coverage do I have for Science?
  // → 24 NGSS (national) + 12 Idaho (state)" at a glance.
  const subjectBreakdown = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    rows.forEach((r) => {
      const fw = r.framework ?? "STATE";
      if (!map.has(r.subject)) map.set(r.subject, new Map());
      const inner = map.get(r.subject)!;
      inner.set(fw, (inner.get(fw) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const visible = rows.filter((r) => {
    const fw = r.framework ?? "STATE";
    const meta = getFramework(fw);
    if (frameworkFilter !== "ALL" && fw !== frameworkFilter) return false;
    if (scopeFilter === "STATE" && meta.national) return false;
    if (scopeFilter === "NATIONAL" && !meta.national) return false;
    if (subjectFilter !== "ALL" && r.subject !== subjectFilter) return false;
    if (gradeFilter !== "ALL" && r.grade !== gradeFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      if (!r.code.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Color palette for framework badges so each library is instantly recognizable.
  const fwBadgeClass = (fwId: string) => {
    const meta = getFramework(fwId);
    if (!meta.national) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    switch (meta.id) {
      case "NGSS": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
      case "CCSS_MATH": return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
      case "CCSS_ELA": return "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30";
      case "C3_SS": return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
      case "AP": return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30";
      case "IB": return "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Mix state-specific standards (e.g. Idaho Science) and national frameworks (e.g. NGSS, Common Core) per subject.
        </p>
        <AddStandardDialog defaults={profile} onAdded={load} />
      </div>

      {/* Per-subject coverage so teachers see at a glance which frameworks
          cover each subject they teach (state vs national). */}
      {subjectBreakdown.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Coverage by subject</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjectBreakdown.map(([subj, fwMap]) => {
                const entries = Array.from(fwMap.entries());
                const stateCount = entries.filter(([fw]) => !getFramework(fw).national).reduce((a, [, c]) => a + c, 0);
                const nationalCount = entries.filter(([fw]) => getFramework(fw).national).reduce((a, [, c]) => a + c, 0);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => { setSubjectFilter(subj); setFrameworkFilter("ALL"); setScopeFilter("ALL"); }}
                    className="text-left rounded-lg border bg-background hover:bg-muted/40 transition p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{subj}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {stateCount > 0 && <span>State {stateCount}</span>}
                        {stateCount > 0 && nationalCount > 0 && <span> · </span>}
                        {nationalCount > 0 && <span>National {nationalCount}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {entries.sort((a, b) => b[1] - a[1]).map(([fw, count]) => {
                        const meta = getFramework(fw);
                        return (
                          <Badge key={fw} variant="outline" className={`text-[11px] ${fwBadgeClass(fw)}`} title={meta.description}>
                            {meta.shortLabel} · {count}
                          </Badge>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Filter by code or keyword…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Scope</Label>
          <div className="flex rounded-md border overflow-hidden h-9">
            {(["ALL", "STATE", "NATIONAL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                className={`px-3 text-xs font-medium transition ${
                  scopeFilter === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                }`}
              >
                {s === "ALL" ? "All" : s === "STATE" ? "State" : "National"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Framework</Label>
          <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All frameworks</SelectItem>
              {FRAMEWORKS
                .filter((f) => {
                  if (scopeFilter === "STATE") return !f.national;
                  if (scopeFilter === "NATIONAL") return f.national;
                  return true;
                })
                .map((f) => {
                  const isPresent = presentFrameworks.includes(f.id);
                  return (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}{!isPresent && " (not seeded)"}
                    </SelectItem>
                  );
                })}
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
            const fwId = s.framework ?? "STATE";
            const fw = getFramework(fwId);
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenQuestions(s.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenQuestions(s.id); } }}
                className="p-4 flex items-start gap-3 hover:bg-muted/40 cursor-pointer transition-colors"
                title="View questions tagged to this standard"
              >
                <Badge
                  variant="outline"
                  className={`text-[11px] shrink-0 mt-0.5 ${fwBadgeClass(fwId)}`}
                  title={`${fw.label}${fw.national ? " (national)" : " (state)"} — ${fw.description}`}
                >
                  {fw.shortLabel}
                </Badge>
                <div className="font-code text-xs text-muted-foreground w-36 shrink-0 pt-0.5 break-all">{s.code}</div>
                <div className="flex-1 min-w-0 text-sm">{s.description}</div>
                <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5">
                  <span className={fw.national ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                    {fw.national ? "National" : "State"}
                  </span>
                  <span>·</span>
                  <span>{s.state || "—"} · {s.subject} · G{s.grade}</span>
                </div>
                {s.teacher_id !== null && (
                  <Button size="sm" variant="ghost" onClick={async (e) => {
                    e.stopPropagation();
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
