import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, ExternalLink, Tag, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ImportCoursesDialog } from "@/components/ImportCoursesDialog";
import { toast } from "sonner";

type Discipline = { id: string; state: string; subject: string; grade: string; is_default: boolean };

type CourseRow = {
  id: string; name: string; course_code: string | null; term: string | null; last_synced_at: string | null;
  discipline_id: string | null;
  hidden: boolean;
  studentCount: number; assignmentCount: number;
};

export default function Courses() {
  const [rows, setRows] = useState<CourseRow[] | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  async function load() {
    const [{ data: courses }, { data: ds }] = await Promise.all([
      supabase.from("courses").select("id, name, course_code, term, last_synced_at, discipline_id, hidden").order("name"),
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

  async function setCourseDiscipline(courseId: string, disciplineId: string | null) {
    // Optimistic
    setRows((prev) => prev?.map((r) => (r.id === courseId ? { ...r, discipline_id: disciplineId } : r)) ?? prev);
    const { error } = await supabase.from("courses").update({ discipline_id: disciplineId }).eq("id", courseId);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success("Discipline updated");
    }
  }

  async function toggleHidden(courseId: string, hidden: boolean) {
    // Optimistic flip; teachers can hide a class to remove it from the
    // Courses grid and the Analytics scope without losing data.
    setRows((prev) => prev?.map((r) => (r.id === courseId ? { ...r, hidden } : r)) ?? prev);
    const { error } = await supabase.from("courses").update({ hidden }).eq("id", courseId);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success(hidden ? "Class hidden" : "Class restored");
    }
  }

  const defaultDisc = disciplines.find((d) => d.is_default) ?? null;
  const hiddenCount = useMemo(() => (rows ?? []).filter((r) => r.hidden).length, [rows]);
  const displayRows = useMemo(() => {
    if (!rows) return rows;
    return showHidden ? rows : rows.filter((r) => !r.hidden);
  }, [rows, showHidden]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-semibold mb-2">Courses</h1>
          <p className="text-muted-foreground">Pick which Canvas courses to track and tag each with a discipline.</p>
        </div>
        <div className="flex items-center gap-4">
          {hiddenCount > 0 && (
            <div className="flex items-center gap-2">
              <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
              <Label htmlFor="show-hidden" className="text-sm text-muted-foreground cursor-pointer">
                Show hidden ({hiddenCount})
              </Label>
            </div>
          )}
          <ImportCoursesDialog onImported={load} />
        </div>
      </div>

      {rows === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <CardTitle className="font-display text-xl mb-2">No courses yet</CardTitle>
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
            return (
              <Card key={c.id} className={c.hidden ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="font-display text-xl flex items-center gap-2">
                        <span className="truncate">{c.name}</span>
                        {c.hidden && <Badge variant="outline" className="text-[9px]">hidden</Badge>}
                      </CardTitle>
                      <CardDescription>{c.course_code ?? "—"} {c.term ? `· ${c.term}` : ""}</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => toggleHidden(c.id, !c.hidden)}
                      title={c.hidden ? "Restore class" : "Hide class"}
                      aria-label={c.hidden ? "Restore class" : "Hide class"}
                    >
                      {c.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="pt-2">
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
                              Using default: {effective.subject} · {effective.grade} · {effective.state}
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
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1">Assign discipline</div>
                            {disciplines.map((d) => (
                              <button
                                key={d.id}
                                onClick={() => setCourseDiscipline(c.id, d.id)}
                                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center justify-between ${
                                  c.discipline_id === d.id ? "bg-muted" : ""
                                }`}
                              >
                                <span>{d.subject} · {d.grade} · {d.state}</span>
                                {d.is_default && <Badge variant="outline" className="text-[9px]">default</Badge>}
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
                <CardContent className="flex items-center justify-between text-sm">
                  <div className="flex gap-6">
                    <div><div className="text-2xl font-display font-semibold tabular-nums">{c.studentCount}</div><div className="text-xs text-muted-foreground">students</div></div>
                    <div><div className="text-2xl font-display font-semibold tabular-nums">{c.assignmentCount}</div><div className="text-xs text-muted-foreground">assignments</div></div>
                  </div>
                  <Link to={`/app/assignments?course=${c.id}`}>
                    <Button variant="ghost" size="sm">Assignments <ExternalLink className="h-3 w-3 ml-1" /></Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
