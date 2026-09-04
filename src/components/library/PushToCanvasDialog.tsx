// "Send to Canvas" — pick a Canvas course and what each resource should become.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { KIND_LABEL, resourceToHtml, type ExportResource } from "@/lib/export/resource";

type CanvasCourse = { canvas_course_id: number; name: string; course_code: string | null; term: string | null; workflow_state: string | null };
type Target = "page" | "assignment" | "quiz";
const TARGET_LABEL: Record<Target, string> = { page: "Page", assignment: "Assignment", quiz: "Quiz" };

function defaultTarget(r: ExportResource): Target {
  if (r.kind === "question_set") return "quiz";
  if (r.kind === "reading") return "page";
  return "assignment";
}

export function PushToCanvasDialog({ open, resources, onClose }: { open: boolean; resources: ExportResource[]; onClose: () => void }) {
  const [courses, setCourses] = useState<CanvasCourse[] | null>(null);
  const [courseErr, setCourseErr] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string>("");
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ title: string; url: string | null; error?: string }[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setTargets(Object.fromEntries(resources.map((r) => [r.id, defaultTarget(r)])));
    setTitles(Object.fromEntries(resources.map((r) => [r.id, r.title])));
    if (courses) return;
    supabase.functions.invoke("canvas-list-courses", { body: {} }).then(({ data, error }) => {
      const msg = (error as any)?.message ?? (data as any)?.error;
      if (msg) { setCourseErr(String(msg)); setCourses([]); return; }
      const list = ((data as any)?.courses ?? []) as CanvasCourse[];
      list.sort((a, b) => (a.workflow_state === "available" ? -1 : 1) - (b.workflow_state === "available" ? -1 : 1) || a.name.localeCompare(b.name));
      setCourses(list);
      if (list.length && !courseId) setCourseId(String(list[0].canvas_course_id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resources]);

  const canQuiz = useMemo(() => new Set(resources.filter((r) => r.questions?.length).map((r) => r.id)), [resources]);

  async function run() {
    if (!courseId) { toast.error("Pick a Canvas course"); return; }
    setBusy(true);
    const results: NonNullable<typeof done> = [];
    for (const r of resources) {
      const target = targets[r.id] ?? defaultTarget(r);
      const { data, error } = await supabase.functions.invoke("canvas-push-resource", {
        body: {
          canvas_course_id: Number(courseId),
          target,
          title: (titles[r.id] ?? r.title).trim() || r.title,
          html: target === "quiz" ? "" : resourceToHtml(r),
          published: publish,
          questions: target === "quiz" ? (r.questions ?? []).map((q) => ({ text: q.text, points: q.points, itemType: q.itemType, answers: q.answers })) : [],
        },
      });
      const msg = (error as any)?.message ?? (data as any)?.error;
      results.push({ title: r.title, url: (data as any)?.html_url ?? null, error: msg ? String(msg) : undefined });
    }
    setBusy(false);
    setDone(results);
    const ok = results.filter((x) => !x.error).length;
    if (ok) toast.success(`Sent ${ok} item${ok === 1 ? "" : "s"} to Canvas`);
    if (ok < results.length) toast.error(`${results.length - ok} failed`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Send to Canvas</DialogTitle>
          <DialogDescription>Creates unpublished items in your Canvas course unless you choose to publish. Question sets become classic quizzes.</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-2">
            {done.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-md border p-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  {d.error && <div className="text-destructive text-xs mt-0.5">{d.error}</div>}
                </div>
                {d.url && <Button asChild variant="outline" size="sm"><a href={d.url} target="_blank" rel="noopener noreferrer">Open <ExternalLink className="h-3.5 w-3.5 ml-1" /></a></Button>}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Canvas course</Label>
              {courses === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your Canvas courses…</div>
              ) : courseErr ? (
                <p className="text-sm text-destructive">{courseErr} <Link to="/app/settings" className="underline">Open Settings</Link></p>
              ) : courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Canvas courses found for your account.</p>
              ) : (
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.canvas_course_id} value={String(c.canvas_course_id)}>
                        {c.name}{c.term ? ` · ${c.term}` : ""}{c.workflow_state && c.workflow_state !== "available" ? ` (${c.workflow_state})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {resources.map((r) => (
                <div key={r.id} className="rounded-md border p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px] font-normal shrink-0">{KIND_LABEL[r.kind]}</Badge>
                    <Input value={titles[r.id] ?? r.title} onChange={(e) => setTitles((t) => ({ ...t, [r.id]: e.target.value }))} className="h-8 text-sm" aria-label="Title in Canvas" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20">Create as</span>
                    <Select value={targets[r.id] ?? defaultTarget(r)} onValueChange={(v) => setTargets((t) => ({ ...t, [r.id]: v as Target }))}>
                      <SelectTrigger className="h-8 w-40 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["page", "assignment", "quiz"] as Target[]).filter((t) => t !== "quiz" || canQuiz.has(r.id)).map((t) => (
                          <SelectItem key={t} value={t}>{TARGET_LABEL[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {r.questions?.length ? <span className="text-xs text-muted-foreground">{r.questions.length} question{r.questions.length === 1 ? "" : "s"}</span> : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-md border p-2.5">
              <div>
                <Label htmlFor="publish-now" className="text-sm">Publish immediately</Label>
                <p className="text-xs text-muted-foreground">Off = students can't see it until you publish in Canvas.</p>
              </div>
              <Switch id="publish-now" checked={publish} onCheckedChange={setPublish} />
            </div>
          </div>
        )}

        <DialogFooter>
          {done ? <Button onClick={onClose}>Done</Button> : (<>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={run} disabled={busy || !courseId}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}{busy ? "Sending…" : `Send ${resources.length > 1 ? `${resources.length} items` : ""}`}</Button>
          </>)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
