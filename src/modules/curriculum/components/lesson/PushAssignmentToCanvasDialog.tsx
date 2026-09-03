import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, CheckCircle } from "lucide-react";
import { getCourses, createCanvasAssignment, type CanvasConfig, type Course } from "@/modules/curriculum/config/canvas-api";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import type { LessonAssignment } from "@/modules/curriculum/hooks/useLessonAssignments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: LessonAssignment;
  config: CanvasConfig;
}

export default function PushAssignmentToCanvasDialog({ open, onOpenChange, assignment, config }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState(assignment.title);
  const [points, setPoints] = useState<number>(Number(assignment.points_possible) || 100);
  const [publish, setPublish] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setName(assignment.title);
    setPoints(Number(assignment.points_possible) || 100);
    if (courses.length === 0) {
      setLoadingCourses(true);
      getCourses(config).then(setCourses).catch(() => toast.error("Failed to load Canvas courses")).finally(() => setLoadingCourses(false));
    }
  }, [open, assignment, config]);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const push = async () => {
    if (selected.size === 0) { toast.error("Pick at least one course"); return; }
    setPushing(true);
    try {
      const ids = Array.from(selected);
      let description = assignment.instructions || "";
      const docLink = assignment.google_doc_url;
      const sheetLink = assignment.google_sheet_url;
      if (docLink) description += `<p><a href="${docLink}" target="_blank">Open assignment in Google Docs</a></p>`;
      if (sheetLink) description += `<p><a href="${sheetLink}" target="_blank">Open rubric in Google Sheets</a></p>`;

      let lastCanvasId: number | null = null;
      let lastCourseId: number | null = null;
      for (const courseId of ids) {
        const created = await createCanvasAssignment(config, Number(courseId), {
          name: name.trim(),
          description,
          submission_types: ["online_text_entry", ...(docLink ? ["online_url"] : [])],
          points_possible: points,
          published: publish,
        });
        if (created?.id) { lastCanvasId = created.id; lastCourseId = Number(courseId); }
      }

      if (lastCanvasId) {
        await (supabase.from("lesson_assignments") as any)
          .update({ canvas_assignment_id: lastCanvasId, canvas_course_id: lastCourseId })
          .eq("id", assignment.id);
      }

      setDone(true);
      toast.success(`Pushed to ${ids.length} course${ids.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e?.message || "Push failed");
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Push assignment to Canvas</DialogTitle>
          <DialogDescription>Create a Canvas assignment from this lesson assignment.</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="h-10 w-10 text-primary" />
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Courses ({selected.size})</Label>
                {loadingCourses ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No Canvas courses. Configure Canvas in Settings.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                    {courses.map(c => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={selected.has(String(c.id))} onCheckedChange={() => toggle(String(c.id))} />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Assignment name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Points</Label>
                <Input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Publish immediately</Label>
                <Switch checked={publish} onCheckedChange={setPublish} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pushing}>Cancel</Button>
              <Button onClick={push} disabled={pushing || selected.size === 0} className="gap-2">
                {pushing ? <><Loader2 className="h-4 w-4 animate-spin" /> Pushing…</> : <><Upload className="h-4 w-4" /> Push</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
