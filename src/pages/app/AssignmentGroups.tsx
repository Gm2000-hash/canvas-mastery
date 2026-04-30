import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Sparkles, Check, Trash2, RefreshCw, Edit2, Plus, X, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Course = { id: string; name: string };

type ClassGroup = {
  id: string;
  name: string;
  course_count: number;
  course_ids: string[];
  course_names: string[];
  assessment_group_count: number;
  pending_suggestion_count: number;
  created_at: string;
  updated_at: string;
};

type AssessmentGroup = {
  group_id: string;
  name: string;
  kind: "assignment" | "quiz";
  member_count: number;
  course_count: number;
  total_submissions: number;
  avg_percentage: number | null;
  course_names: string[] | null;
  class_group_id?: string | null;
};

type Suggestion = {
  id: string;
  class_group_id: string;
  assignment_ids: string[];
  suggested_name: string;
  confidence: number | null;
  rationale: string | null;
};

export default function AssignmentGroups() {
  const [classGroups, setClassGroups] = useState<ClassGroup[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assessmentGroups, setAssessmentGroups] = useState<Record<string, AssessmentGroup[]>>({});
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [loading, setLoading] = useState(false);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClassGroup | null>(null);
  const [manualPickerCg, setManualPickerCg] = useState<ClassGroup | null>(null);

  async function loadAll() {
    setLoading(true);
    const [cgRes, coursesRes, agRes] = await Promise.all([
      supabase.rpc("list_class_groups" as any),
      supabase.from("courses").select("id, name").order("name"),
      supabase.rpc("list_assignment_groups" as any),
    ]);
    if (cgRes.error) toast.error(cgRes.error.message);
    const cgs = ((cgRes.data as any) ?? []) as ClassGroup[];
    setClassGroups(cgs);
    setCourses((coursesRes.data ?? []) as Course[]);

    // Bucket assessment groups by class_group_id (need to fetch class_group_id separately)
    const ags = ((agRes.data as any) ?? []) as AssessmentGroup[];
    if (ags.length > 0) {
      const { data: linkData } = await supabase
        .from("assignment_groups")
        .select("id, class_group_id")
        .in("id", ags.map((a) => a.group_id));
      const linkMap = new Map<string, string | null>();
      (linkData ?? []).forEach((r: any) => linkMap.set(r.id, r.class_group_id));
      const buckets: Record<string, AssessmentGroup[]> = {};
      for (const ag of ags) {
        const k = linkMap.get(ag.group_id) ?? "__legacy__";
        (buckets[k] ??= []).push(ag);
      }
      setAssessmentGroups(buckets);
    } else {
      setAssessmentGroups({});
    }

    // Pending suggestions
    const { data: sugData } = await supabase
      .from("assessment_match_suggestions")
      .select("id, class_group_id, assignment_ids, suggested_name, confidence, rationale")
      .is("dismissed_at", null)
      .is("applied_group_id", null);
    const sBuckets: Record<string, Suggestion[]> = {};
    (sugData ?? []).forEach((s: any) => {
      (sBuckets[s.class_group_id] ??= []).push(s as Suggestion);
    });
    setSuggestions(sBuckets);

    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  async function deleteClassGroup(id: string) {
    if (!confirm("Delete this class group? Equivalent-assessment links inside it will be detached but not deleted.")) return;
    const { error } = await supabase.from("class_groups").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Class group deleted");
    loadAll();
  }

  async function findMatches(cg: ClassGroup) {
    if (cg.course_count < 2) {
      toast.error("Add at least two classes to find equivalent assessments.");
      return;
    }
    setMatchingId(cg.id);
    try {
      const { data, error } = await supabase.functions.invoke("match-assessments-in-group", {
        body: { class_group_id: cg.id },
      });
      if (error) throw error;
      const count = (data as any)?.count ?? 0;
      toast.success(count > 0 ? `Found ${count} possible match${count === 1 ? "" : "es"}` : "No new matches found");
      await loadAll();
      setExpanded((e) => ({ ...e, [cg.id]: true }));
    } catch (e: any) {
      toast.error(e?.message ?? "AI match failed");
    } finally {
      setMatchingId(null);
    }
  }

  async function confirmSuggestion(s: Suggestion, cg: ClassGroup) {
    const { error } = await supabase.rpc("apply_assignment_group_in_class_group" as any, {
      _class_group_id: cg.id,
      _name: s.suggested_name,
      _assignment_ids: s.assignment_ids,
      _group_id: null,
    });
    if (error) { toast.error(error.message); return; }
    await supabase
      .from("assessment_match_suggestions")
      .update({ applied_group_id: null, dismissed_at: new Date().toISOString() })
      .eq("id", s.id);
    toast.success("Equivalent assessment confirmed");
    loadAll();
  }

  async function dismissSuggestion(s: Suggestion) {
    const { error } = await supabase
      .from("assessment_match_suggestions")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    loadAll();
  }

  async function confirmAllSuggestions(cg: ClassGroup) {
    const list = suggestions[cg.id] ?? [];
    if (list.length === 0) return;
    if (!confirm(`Approve all ${list.length} suggested equivalent assessments for "${cg.name}"?`)) return;
    let ok = 0;
    let fail = 0;
    for (const s of list) {
      const { error } = await supabase.rpc("apply_assignment_group_in_class_group" as any, {
        _class_group_id: cg.id,
        _name: s.suggested_name,
        _assignment_ids: s.assignment_ids,
        _group_id: null,
      });
      if (error) { fail++; continue; }
      await supabase
        .from("assessment_match_suggestions")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", s.id);
      ok++;
    }
    if (ok > 0) toast.success(`Approved ${ok} suggestion${ok === 1 ? "" : "s"}${fail ? ` (${fail} failed)` : ""}`);
    if (ok === 0 && fail > 0) toast.error("Failed to approve suggestions");
    loadAll();
  }

  async function deleteAssessmentGroup(groupId: string) {
    if (!confirm("Delete this equivalent-assessment grouping? Member assignments will be ungrouped (no data lost).")) return;
    const { error } = await supabase.from("assignment_groups").delete().eq("id", groupId);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    loadAll();
  }

  async function attachLegacyToClassGroup(groupId: string, classGroupId: string) {
    const { error } = await supabase
      .from("assignment_groups")
      .update({ class_group_id: classGroupId })
      .eq("id", groupId);
    if (error) { toast.error(error.message); return; }
    toast.success("Attached to class group");
    loadAll();
  }

  return (
    <div className="space-y-10 pb-12">
      <header className="border-b pb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium tracking-wide uppercase">
              <Layers className="h-3.5 w-3.5" /> Class Groups
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Group sections.<br />
              <span className="text-muted-foreground">Match assessments.</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Bundle your class sections (e.g. all periods of <span className="text-foreground font-medium">8th Grade Science A</span>),
              then let AI find equivalent assessments <em>within</em> each group — keeping matches scoped to the right prep.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> New class group</Button>
              </DialogTrigger>
              <ClassGroupDialog
                courses={courses}
                onClose={() => setCreateOpen(false)}
                onSaved={() => { setCreateOpen(false); loadAll(); }}
              />
            </Dialog>
          </div>
        </div>
      </header>

      {loading && !classGroups && <Skeleton className="h-32" />}
      {classGroups && classGroups.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div className="text-sm text-muted-foreground max-w-sm mx-auto">
              You haven't created any class groups yet. Create one to start grouping equivalent assessments across sections.
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first group
            </Button>
          </CardContent>
        </Card>
      )}


      <div className="space-y-3">
        {classGroups?.map((cg) => {
          const isOpen = expanded[cg.id] ?? true;
          const groupAGs = assessmentGroups[cg.id] ?? [];
          const groupSugs = suggestions[cg.id] ?? [];
          return (
            <Card key={cg.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [cg.id]: !isOpen }))}
                      className="flex items-center gap-1.5 text-left"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <CardTitle className="text-base">{cg.name}</CardTitle>
                    </button>
                    <CardDescription className="mt-1 flex flex-wrap gap-1.5 ml-5">
                      <Badge variant="outline">{cg.course_count} {cg.course_count === 1 ? "class" : "classes"}</Badge>
                      <Badge variant="outline">{cg.assessment_group_count} confirmed</Badge>
                      {cg.pending_suggestion_count > 0 && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" variant="outline">
                          {cg.pending_suggestion_count} suggested
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => findMatches(cg)}
                      disabled={matchingId === cg.id || cg.course_count < 2}
                    >
                      <Sparkles className={`h-3.5 w-3.5 mr-1.5 ${matchingId === cg.id ? "animate-pulse" : ""}`} />
                      {matchingId === cg.id ? "Finding…" : "Find equivalent assessments"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setManualPickerCg(cg)} disabled={cg.course_count < 1}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add manually
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(cg)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteClassGroup(cg.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Classes:</span>{" "}
                    {cg.course_names.length > 0 ? cg.course_names.join(" · ") : <em>none yet</em>}
                  </div>

                  {/* Suggestions */}
                  {groupSugs.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" /> AI suggestions ({groupSugs.length})
                        </div>
                        <Button size="sm" variant="outline" className="h-7" onClick={() => confirmAllSuggestions(cg)}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve all
                        </Button>
                      </div>
                      <ul className="space-y-2">
                        {groupSugs.map((s) => (
                          <li key={s.id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{s.suggested_name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {s.assignment_ids.length} assignments
                                  {s.confidence != null && <> · {Math.round((s.confidence ?? 0) * 100)}% confidence</>}
                                </div>
                                {s.rationale && (
                                  <div className="text-xs text-muted-foreground mt-1 italic">{s.rationale}</div>
                                )}
                              </div>
                              <div className="flex gap-1.5">
                                <Button size="sm" onClick={() => confirmSuggestion(s, cg)}>
                                  <Check className="h-3.5 w-3.5 mr-1" /> Confirm
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => dismissSuggestion(s)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Confirmed equivalent assessments */}
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Confirmed equivalent assessments
                    </div>
                    {groupAGs.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">
                        None yet. Use "Find equivalent assessments" once your classes are added.
                      </div>
                    ) : (
                      <ul className="space-y-1.5">
                        {groupAGs.map((g) => (
                          <li key={g.group_id} className="rounded-md border bg-card p-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm truncate">{g.name}</div>
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 mt-0.5">
                                <Badge variant="secondary" className="text-[10px] py-0">{g.kind}</Badge>
                                <span>{g.course_count} classes · {g.member_count} assignments</span>
                                {g.avg_percentage != null && <span>· avg {Number(g.avg_percentage).toFixed(0)}%</span>}
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteAssessmentGroup(g.group_id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Legacy ungrouped */}
      {assessmentGroups["__legacy__"]?.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ungrouped legacy assessments</CardTitle>
            <CardDescription>
              Confirmed before class groups existed. Re-confirm them inside a class group when you're ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {assessmentGroups["__legacy__"].map((g) => (
                <li key={g.group_id} className="rounded-md border bg-card p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.course_count} classes · {g.member_count} assignments</div>
                  </div>
                  <div className="flex gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7" disabled={!classGroups || classGroups.length === 0}>
                          <Link2 className="h-3.5 w-3.5 mr-1" /> Attach to…
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs">Move into class group</DropdownMenuLabel>
                        {(classGroups ?? []).map((cg) => (
                          <DropdownMenuItem key={cg.id} onClick={() => attachLegacyToClassGroup(g.group_id, cg.id)}>
                            {cg.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteAssessmentGroup(g.group_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <ClassGroupDialog
            courses={courses}
            existing={editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); loadAll(); }}
          />
        )}
      </Dialog>

      {/* Manual picker */}
      <Dialog open={!!manualPickerCg} onOpenChange={(o) => !o && setManualPickerCg(null)}>
        {manualPickerCg && (
          <ManualAssignmentPicker
            classGroup={manualPickerCg}
            onClose={() => setManualPickerCg(null)}
            onSaved={() => { setManualPickerCg(null); loadAll(); }}
          />
        )}
      </Dialog>

      <div className="text-xs text-muted-foreground">
        Tip: open the <Link to="/app/classes" className="underline">Compare classes</Link> tab on Analytics to chart a confirmed equivalent assessment across all its sections.
      </div>
    </div>
  );
}

function ClassGroupDialog({
  courses,
  existing,
  onClose,
  onSaved,
}: {
  courses: Course[];
  existing?: ClassGroup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [selected, setSelected] = useState<string[]>(existing?.course_ids ?? []);
  const [saving, setSaving] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  async function save() {
    if (!name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase.rpc("update_class_group" as any, {
          _id: existing.id,
          _name: name.trim(),
          _course_ids: selected,
        });
        if (error) throw error;
        toast.success("Class group updated");
      } else {
        const { error } = await supabase.rpc("create_class_group" as any, {
          _name: name.trim(),
          _course_ids: selected,
        });
        if (error) throw error;
        toast.success("Class group created");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{existing ? "Edit class group" : "New class group"}</DialogTitle>
        <DialogDescription>
          Name the group and pick the classes that belong to it. AI matching will only run within this group.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <Input
          placeholder="e.g. 8th Grade Science A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1.5">Classes</div>
          <ScrollArea className="max-h-64 border rounded-md p-1">
            <ul className="space-y-0.5">
              {courses.length === 0 && (
                <li className="px-2 py-2 text-xs text-muted-foreground">No classes yet.</li>
              )}
              {courses.map((c) => (
                <li key={c.id}>
                  <label className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm",
                    selectedSet.has(c.id) && "bg-muted/50",
                  )}>
                    <Checkbox checked={selectedSet.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <span className="truncate flex-1">{c.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
          <div className="text-xs text-muted-foreground mt-1">
            {selected.length} selected
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ManualAssignmentPicker({
  classGroup,
  onClose,
  onSaved,
}: {
  classGroup: { id: string; name: string; course_ids: string[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  type Item = {
    id: string;
    name: string;
    kind: "assignment" | "quiz";
    course_id: string;
    course_name?: string;
    in_other_group: boolean;
  };
  const [items, setItems] = useState<Item[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [showInOtherGroups, setShowInOtherGroups] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (classGroup.course_ids.length === 0) { setItems([]); return; }
      const { data, error } = await supabase
        .from("assignments")
        .select("id, name, kind, course_id, assignment_group_id, courses:course_id(name)")
        .in("course_id", classGroup.course_ids)
        .order("name");
      if (error) { toast.error(error.message); setItems([]); return; }
      const list: Item[] = (data ?? []).map((a: any) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        course_id: a.course_id,
        course_name: a.courses?.name,
        in_other_group: !!a.assignment_group_id,
      }));
      setItems(list);
    })();
  }, [classGroup.id]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (i.in_other_group && !showInOtherGroups) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, showInOtherGroups]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function save() {
    if (selected.size < 2) { toast.error("Pick at least 2 assignments to group as one equivalent assessment."); return; }
    if (!name.trim()) { toast.error("Name required"); return; }
    const ids = [...selected];
    const courses = new Set((items ?? []).filter((i) => selected.has(i.id)).map((i) => i.course_id));
    if (courses.size < 2) {
      if (!confirm("These assignments are all from the same class. Group anyway?")) return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("apply_assignment_group_in_class_group" as any, {
        _class_group_id: classGroup.id,
        _name: name.trim(),
        _assignment_ids: ids,
        _group_id: null,
      });
      if (error) throw error;
      toast.success("Equivalent assessment created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Add equivalent assessment manually</DialogTitle>
        <DialogDescription>
          Pick assignments across <strong>{classGroup.name}</strong>'s classes that represent the same assessment.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <Input
          placeholder="Equivalent assessment name (e.g. Pre-ECA Unit 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <Input placeholder="Search assignments…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
          <label className="text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <Checkbox checked={showInOtherGroups} onCheckedChange={(v) => setShowInOtherGroups(!!v)} />
            Show already grouped
          </label>
        </div>
        {!items ? (
          <Skeleton className="h-48" />
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No matching assignments.</div>
        ) : (
          <ScrollArea className="h-72 border rounded-md p-1">
            <ul className="space-y-0.5">
              {filtered.map((it) => (
                <li key={it.id}>
                  <label className={cn(
                    "flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm",
                    selected.has(it.id) && "bg-muted/50",
                  )}>
                    <Checkbox checked={selected.has(it.id)} onCheckedChange={() => toggle(it.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{it.name}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px] py-0 h-4">{it.kind}</Badge>
                        <span className="truncate">{it.course_name}</span>
                        {it.in_other_group && <span className="text-amber-600 dark:text-amber-400">already grouped</span>}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <div className="text-xs text-muted-foreground">{selected.size} selected</div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving || selected.size < 2}>{saving ? "Saving…" : "Create equivalent assessment"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
