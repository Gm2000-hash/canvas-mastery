// "Send to Google Classroom" — creates a Google Doc or Form per resource and
// (optionally) attaches it to a Classroom assignment or material.
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
import { KIND_LABEL, resourceMetaLine, type ExportResource } from "@/lib/export/resource";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";

type GCourse = { id: string; name: string; section: string | null; state: string | null; link: string | null };
type Target = "assignment" | "material" | "doc_only";
type Format = "doc" | "form";
const TARGET_LABEL: Record<Target, string> = { assignment: "Assignment", material: "Material", doc_only: "Google Doc only (no Classroom)" };

export function linkOwner(r: ExportResource) {
  return r.kind === "question_set" ? { library_item_id: null, question_set_key: `qset:${r.title}`.slice(0, 200) } : { library_item_id: r.id, question_set_key: null };
}

function defaultTarget(r: ExportResource): Target {
  return r.kind === "reading" ? "material" : "assignment";
}

export function PushToGoogleClassroomDialog({ open, resources, onClose }: { open: boolean; resources: ExportResource[]; onClose: () => void }) {
  const google = useGoogleConnection();
  const [courses, setCourses] = useState<GCourse[] | null>(null);
  const [courseErr, setCourseErr] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [formats, setFormats] = useState<Record<string, Format>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [publish, setPublish] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [defaultFormat, setDefaultFormat] = useState<Format>("form");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ title: string; url: string | null; fileUrl: string | null; error?: string }[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setTargets(Object.fromEntries(resources.map((r) => [r.id, defaultTarget(r)])));
    setTitles(Object.fromEntries(resources.map((r) => [r.id, r.title])));
    supabase.from("teacher_settings").select("google_quiz_target").maybeSingle().then(({ data }) => {
      const f = ((data as any)?.google_quiz_target as Format) ?? "form";
      setDefaultFormat(f);
      setFormats(Object.fromEntries(resources.map((r) => [r.id, r.questions?.length ? f : "doc"])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resources]);

  useEffect(() => {
    if (!open || !google.status?.connected || courses) return;
    supabase.functions.invoke("google-classroom-list-courses", { body: {} }).then(({ data, error }) => {
      const msg = (error as any)?.message ?? (data as any)?.error;
      if (msg) { setCourseErr(String(msg)); setCourses([]); return; }
      const list = ((data as any)?.courses ?? []) as GCourse[];
      setCourses(list);
      if (list.length && !courseId) setCourseId(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, google.status?.connected]);

  const withQuestions = useMemo(() => new Set(resources.filter((r) => r.questions?.length).map((r) => r.id)), [resources]);
  const needsCourse = resources.some((r) => (targets[r.id] ?? defaultTarget(r)) !== "doc_only");

  async function run() {
    if (needsCourse && !courseId) { toast.error("Pick a Classroom course"); return; }
    setBusy(true);
    // Remember the teacher's quiz preference for next time.
    const chosen = resources.filter((r) => withQuestions.has(r.id)).map((r) => formats[r.id]).filter(Boolean);
    if (chosen.length && chosen[chosen.length - 1] !== defaultFormat) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) await supabase.from("teacher_settings").upsert({ teacher_id: u.user.id, google_quiz_target: chosen[chosen.length - 1] }, { onConflict: "teacher_id" });
    }
    const results: NonNullable<typeof done> = [];
    for (const r of resources) {
      const target = targets[r.id] ?? defaultTarget(r);
      const format: Format = withQuestions.has(r.id) ? (formats[r.id] ?? defaultFormat) : "doc";
      const { data, error } = await supabase.functions.invoke("google-classroom-push", {
        body: {
          google_course_id: target === "doc_only" ? null : courseId,
          target, format,
          title: (titles[r.id] ?? r.title).trim() || r.title,
          meta: resourceMetaLine(r) || undefined,
          description: resourceMetaLine(r) || undefined,
          blocks: format === "form" ? [] : r.blocks,
          questions: (r.questions ?? []).map((q) => ({ text: q.text, points: q.points, itemType: q.itemType, answers: q.answers })),
          published: publish,
          due_date: target === "assignment" && dueDate ? dueDate : null,
          ...linkOwner(r),
        },
      });
      const msg = (error as any)?.message ?? (data as any)?.error;
      results.push({ title: r.title, url: (data as any)?.classroom_url ?? null, fileUrl: (data as any)?.file_url ?? null, error: msg ? String(msg) : undefined });
    }
    setBusy(false);
    setDone(results);
    const ok = results.filter((x) => !x.error).length;
    if (ok) toast.success(`Sent ${ok} item${ok === 1 ? "" : "s"} to Google`);
    if (ok < results.length) toast.error(`${results.length - ok} failed`);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Send to Google Classroom</DialogTitle>
          <DialogDescription>Creates a Google Doc (or Form for quizzes) in your Drive and attaches it to your Classroom course as a draft unless you choose to post it.</DialogDescription>
        </DialogHeader>

        {google.status && !google.status.connected ? (
          <div className="rounded-md border p-4 text-sm space-y-2">
            <p>Google isn't connected yet. Connect your Google account once and every send after that is one click.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={google.connect} disabled={google.busy}>{google.busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Connect Google</Button>
              <Button size="sm" variant="ghost" asChild><Link to="/app/settings#google">Open Settings</Link></Button>
            </div>
          </div>
        ) : done ? (
          <div className="space-y-2">
            {done.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-md border p-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  {d.error && <div className="text-destructive text-xs mt-0.5">{d.error}</div>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {d.fileUrl && <Button asChild variant="ghost" size="sm"><a href={d.fileUrl} target="_blank" rel="noopener noreferrer">File <ExternalLink className="h-3.5 w-3.5 ml-1" /></a></Button>}
                  {d.url && <Button asChild variant="outline" size="sm"><a href={d.url} target="_blank" rel="noopener noreferrer">Classroom <ExternalLink className="h-3.5 w-3.5 ml-1" /></a></Button>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {needsCourse && (
              <div className="space-y-1.5">
                <Label>Classroom course</Label>
                {courses === null ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your Classroom courses…</div>
                ) : courseErr ? (
                  <p className="text-sm text-destructive">{courseErr} <Link to="/app/settings#google" className="underline">Open Settings</Link></p>
                ) : courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No Classroom courses found where you're a teacher.</p>
                ) : (
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ""}{c.state && c.state !== "ACTIVE" ? ` (${c.state.toLowerCase()})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {resources.map((r) => {
                const target = targets[r.id] ?? defaultTarget(r);
                return (
                  <div key={r.id} className="rounded-md border p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] font-normal shrink-0">{KIND_LABEL[r.kind]}</Badge>
                      <Input value={titles[r.id] ?? r.title} onChange={(e) => setTitles((t) => ({ ...t, [r.id]: e.target.value }))} className="h-8 text-sm" aria-label="Title in Google" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground w-20">Post as</span>
                      <Select value={target} onValueChange={(v) => setTargets((t) => ({ ...t, [r.id]: v as Target }))}>
                        <SelectTrigger className="h-8 w-56 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["assignment", "material", "doc_only"] as Target[]).map((t) => <SelectItem key={t} value={t}>{TARGET_LABEL[t]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {withQuestions.has(r.id) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground w-20">Quiz as</span>
                        <Select value={formats[r.id] ?? defaultFormat} onValueChange={(v) => setFormats((f) => ({ ...f, [r.id]: v as Format }))}>
                          <SelectTrigger className="h-8 w-56 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="form">Google Form (auto-graded quiz)</SelectItem>
                            <SelectItem value="doc">Google Doc (printable)</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">{r.questions!.length} question{r.questions!.length === 1 ? "" : "s"}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {needsCourse && (
              <>
                <div className="flex items-center gap-3">
                  <Label htmlFor="g-due" className="text-sm w-24">Due date</Label>
                  <Input id="g-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 w-44 text-sm" />
                  <span className="text-xs text-muted-foreground">optional · assignments only</span>
                </div>
                <div className="flex items-center justify-between rounded-md border p-2.5">
                  <div>
                    <Label htmlFor="g-publish" className="text-sm">Post to students now</Label>
                    <p className="text-xs text-muted-foreground">Off = saved as a draft in Classroom until you post it.</p>
                  </div>
                  <Switch id="g-publish" checked={publish} onCheckedChange={setPublish} />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {done || (google.status && !google.status.connected) ? <Button onClick={onClose}>Done</Button> : (<>
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={run} disabled={busy || (needsCourse && !courseId)}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}{busy ? "Sending…" : `Send ${resources.length > 1 ? `${resources.length} items` : ""}`}</Button>
          </>)}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
