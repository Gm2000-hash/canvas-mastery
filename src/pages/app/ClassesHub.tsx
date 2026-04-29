import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChartHorizontal, Eye, EyeOff, GraduationCap, Loader2, Shuffle, Tag } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImportCoursesDialog } from "@/components/ImportCoursesDialog";
import { toast } from "sonner";
import { getFramework, FRAMEWORKS } from "@/lib/frameworks";
import { recentSchoolYears, currentSchoolYearLabel } from "@/lib/schoolYear";
import { CompareView } from "./Analytics";

type Discipline = { id: string; state: string; subject: string; grade: string; is_default: boolean };

type CourseRow = {
  id: string; name: string; course_code: string | null; term: string | null; last_synced_at: string | null;
  discipline_id: string | null;
  hidden: boolean;
  archived_at: string | null;
  studentCount: number; assignmentCount: number;
};

type ClassStats = {
  course_id: string;
  subject: string | null;
  framework: string | null;
  student_count: number;
  assessment_count: number;
  avg_mastery: number | null;
  pct_mastered: number | null;
};

const FRAMEWORK_COLOR: Record<string, string> = {
  STATE: "hsl(38 92% 50%)",
  NGSS: "hsl(160 84% 39%)",
  CCSS_MATH: "hsl(217 91% 60%)",
  CCSS_ELA: "hsl(262 83% 58%)",
  C3_SS: "hsl(346 84% 54%)",
  AP: "hsl(239 84% 67%)",
  IB: "hsl(173 80% 40%)",
  CUSTOM: "hsl(0 0% 60%)",
};

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

export default function ClassesHub() {
  const [rows, setRows] = useState<CourseRow[] | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [stats, setStats] = useState<Record<string, ClassStats>>({});
  const [showHidden, setShowHidden] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reshufflingId, setReshufflingId] = useState<string | null>(null);
  const [schoolYear, setSchoolYear] = useState<string>(currentSchoolYearLabel());

  async function repseudonymize(courseId: string) {
    setReshufflingId(courseId);
    const { data, error } = await supabase.rpc("repseudonymize_course", { _course_id: courseId });
    setReshufflingId(null);
    if (error) { toast.error(error.message); return; }
    const n = (data as any[])?.length ?? 0;
    toast.success(`Reassigned ${n} pseudonym${n === 1 ? "" : "s"} for this class`);
  }

  async function loadStats() {
    const { data } = await supabase.rpc("analytics_class_breakdown", {
      _school_year: schoolYear === "ALL" ? null : schoolYear,
      _include_archived: true,
    });
    const map: Record<string, ClassStats> = {};
    ((data as any[]) ?? []).forEach((r: any) => {
      map[r.course_id] = {
        course_id: r.course_id,
        subject: r.subject,
        framework: r.framework,
        student_count: r.student_count,
        assessment_count: r.assessment_count,
        avg_mastery: r.avg_mastery,
        pct_mastered: r.pct_mastered,
      };
    });
    setStats(map);
  }

  async function load() {
    const [{ data: courses }, { data: ds }] = await Promise.all([
      supabase.from("courses").select("id, name, course_code, term, last_synced_at, discipline_id, hidden, archived_at").order("name"),
      supabase.from("teacher_disciplines").select("id, state, subject, grade, is_default").order("created_at"),
    ]);
    setDisciplines((ds ?? []) as Discipline[]);
    const out: CourseRow[] = [];
    for (const c of courses ?? []) {
      const [{ count: sc }, { count: ac }] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("course_id", c.id),
        supabase.from("assignments").select("id", { count: "exact", head: true }).eq("course_id", c.id),
      ]);
      out.push({ ...c, studentCount: sc ?? 0, assignmentCount: ac ?? 0 });
    }
    setRows(out);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadStats(); }, [schoolYear]);

  async function setCourseDiscipline(courseId: string, disciplineId: string | null) {
    setRows((prev) => prev?.map((r) => (r.id === courseId ? { ...r, discipline_id: disciplineId } : r)) ?? prev);
    const { error } = await supabase.from("courses").update({ discipline_id: disciplineId }).eq("id", courseId);
    if (error) { toast.error(error.message); load(); }
    else { toast.success("Discipline updated"); }
  }

  async function toggleHidden(courseId: string, hidden: boolean) {
    setRows((prev) => prev?.map((r) => (r.id === courseId ? { ...r, hidden } : r)) ?? prev);
    const { error } = await supabase.from("courses").update({ hidden }).eq("id", courseId);
    if (error) { toast.error(error.message); load(); }
    else { toast.success(hidden ? "Class hidden" : "Class restored"); }
  }

  const defaultDisc = disciplines.find((d) => d.is_default) ?? null;
  const hiddenCount = useMemo(() => (rows ?? []).filter((r) => r.hidden).length, [rows]);
  const archivedCount = useMemo(() => (rows ?? []).filter((r) => r.archived_at && !r.hidden).length, [rows]);
  const displayRows = useMemo(() => {
    if (!rows) return rows;
    return rows.filter((r) => {
      if (!showHidden && r.hidden) return false;
      if (!showArchived && r.archived_at && !r.hidden) return false;
      return true;
    });
  }, [rows, showHidden, showArchived]);

  const years = useMemo(() => recentSchoolYears(6), []);
  const compareCourses = useMemo(
    () => (rows ?? []).filter((r) => !r.hidden && !r.archived_at).map((r) => ({ id: r.id, name: r.name })),
    [rows],
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Classes</h1>
          <p className="text-muted-foreground">Manage your classes and open per-class analytics. Tag each class with a discipline so standards line up.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">School year</Label>
            <Select value={schoolYear} onValueChange={setSchoolYear}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All time</SelectItem>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {archivedCount > 0 && (
            <div className="flex items-center gap-2 pb-1">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
                Show archived ({archivedCount})
              </Label>
            </div>
          )}
          {hiddenCount > 0 && (
            <div className="flex items-center gap-2 pb-1">
              <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
              <Label htmlFor="show-hidden" className="text-sm text-muted-foreground cursor-pointer">
                Show hidden ({hiddenCount})
              </Label>
            </div>
          )}
          <div className="pb-1 flex items-center gap-2">
            <ImportCoursesDialog onImported={load} mode="backfill" />
            <ImportCoursesDialog onImported={load} />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <BarChartHorizontal className="h-4 w-4 mr-1.5" /> Compare classes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Compare classes</DialogTitle>
                </DialogHeader>
                <CompareView courses={compareCourses} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {rows === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <CardTitle className="font-display text-xl mb-2">No classes yet</CardTitle>
            <CardDescription className="mb-4">
              Connect Canvas and use <span className="font-medium">Import courses</span> above to pull in your classes.
            </CardDescription>
            <Link to="/app/settings#canvas"><Button variant="outline">Set up Canvas</Button></Link>
          </CardContent>
        </Card>
      ) : displayRows!.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <EyeOff className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <CardTitle className="font-display text-xl mb-2">All classes are hidden</CardTitle>
            <CardDescription className="mb-4">Toggle <span className="font-medium">Show hidden</span> above to bring them back.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {displayRows!.map((c) => {
            const disc = disciplines.find((d) => d.id === c.discipline_id) ?? null;
            const effective = disc ?? defaultDisc;
            const s = stats[c.id];
            const fw = s?.framework ? getFramework(s.framework) : null;
            return (
              <Card key={c.id} className={(c.hidden || c.archived_at) ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="font-display text-xl flex items-center gap-2 flex-wrap">
                        <span className="truncate">{c.name}</span>
                        {c.hidden && <Badge variant="outline" className="text-[11px]">hidden</Badge>}
                        {c.archived_at && (
                          <Badge variant="outline" className="text-[11px]" title={`Archived ${new Date(c.archived_at).toLocaleDateString()}`}>
                            archived
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{c.course_code ?? "—"} {c.term ? `· ${c.term}` : ""}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={reshufflingId === c.id}
                            title="Re-pseudonymize this class"
                            aria-label="Re-pseudonymize this class"
                          >
                            {reshufflingId === c.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Shuffle className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Re-pseudonymize {c.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Every student in this class will get a new "Student NNN" label. Mastery scores,
                              submissions, and tags are unaffected — only the displayed pseudonym changes.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => repseudonymize(c.id)}>
                              Reassign pseudonyms
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => toggleHidden(c.id, !c.hidden)}
                        title={c.hidden ? "Restore class" : "Hide class"}
                        aria-label={c.hidden ? "Restore class" : "Hide class"}
                      >
                        {c.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    {s?.subject && <Badge variant="outline" className="text-[11px]">{s.subject}</Badge>}
                    {fw && <Badge variant="outline" className="text-[11px]" style={{ borderColor: FRAMEWORK_COLOR[s!.framework ?? "STATE"], color: FRAMEWORK_COLOR[s!.framework ?? "STATE"] }}>{fw.shortLabel}</Badge>}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                          aria-label="Edit discipline"
                        >
                          <Tag className="h-3 w-3" />
                          {disc ? (
                            <span>{disc.subject} · {disc.grade} · {disc.state}</span>
                          ) : effective ? (
                            <span className="text-muted-foreground">
                              Default: {effective.subject} · {effective.grade} · {effective.state}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Set discipline</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2" align="start">
                        {disciplines.length === 0 ? (
                          <div className="p-2 text-xs text-muted-foreground">
                            No disciplines yet. Add one in <Link to="/app/settings#disciplines" className="underline">Settings</Link>.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 pt-1">Assign discipline</div>
                            {disciplines.map((d) => (
                              <button
                                key={d.id}
                                onClick={() => setCourseDiscipline(c.id, d.id)}
                                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center justify-between ${
                                  c.discipline_id === d.id ? "bg-muted" : ""
                                }`}
                              >
                                <span>{d.subject} · {d.grade} · {d.state}</span>
                                {d.is_default && <Badge variant="outline" className="text-[11px]">default</Badge>}
                              </button>
                            ))}
                            <div className="border-t my-1" />
                            <button
                              onClick={() => setCourseDiscipline(c.id, null)}
                              className="w-full text-left px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted"
                            >
                              Clear (use teacher default)
                            </button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <Stat label="Students" value={s?.student_count ?? c.studentCount} />
                    <Stat label="Assessments" value={s?.assessment_count ?? c.assignmentCount} />
                    <Stat label="Avg" value={pct(s?.avg_mastery)} />
                    <Stat label="Mastered" value={pct(s?.pct_mastered)} />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link to={`/app/classes/${c.id}/assignments`}>
                      <Button variant="ghost" size="sm">Assignments <ArrowRight className="h-3 w-3 ml-1" /></Button>
                    </Link>
                    <Link to={`/app/classes/${c.id}`}>
                      <Button size="sm">
                        Open analytics <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xl font-display font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
