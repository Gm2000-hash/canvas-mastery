import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { bookPushPayload, type BookPart, type Textbook } from "@/modules/curriculum/lib/textbook-book";

type Course = { id: string; name: string; state?: string };

export function PushTextbookDialog({ open, onClose, book, parts }: { open: boolean; onClose: () => void; book: Textbook; parts: BookPart[] }) {
  const [platform, setPlatform] = useState<"canvas" | "google">("canvas");
  const [courses, setCourses] = useState<Record<string, Course[] | null>>({ canvas: null, google: null });
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  const [courseId, setCourseId] = useState("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ chapters: number; created: { chapter: string; url: string | null }[] } | null>(null);
  const chapterCount = parts.reduce((n, p) => n + p.chapters.length, 0);

  useEffect(() => {
    if (!open || courses[platform]) return;
    const fn = platform === "canvas" ? "canvas-list-courses" : "google-classroom-list-courses";
    supabase.functions.invoke(fn, { body: {} }).then(({ data, error }) => {
      const msg = (error as any)?.message ?? (data as any)?.error;
      if (msg) { setErrs((e) => ({ ...e, [platform]: String(msg) })); setCourses((c) => ({ ...c, [platform]: [] })); return; }
      const list: Course[] = ((data as any)?.courses ?? []).map((c: any) => ({ id: String(c.canvas_course_id ?? c.id), name: c.name, state: c.workflow_state ?? c.courseState }));
      setCourses((c) => ({ ...c, [platform]: list }));
      if (list.length) setCourseId(list[0].id);
    });
  }, [open, platform, courses]);

  useEffect(() => { if (open) { setResult(null); } }, [open]);
  useEffect(() => { setCourseId(courses[platform]?.[0]?.id ?? ""); }, [platform, courses]);

  async function run() {
    if (!courseId) { toast.error("Pick a course"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-textbook", { body: bookPushPayload(book, parts, platform, courseId, publish) });
      const msg = (error as any)?.message ?? (data as any)?.error;
      if (msg) throw new Error(String(msg));
      setResult(data);
      toast.success(`Sent ${data.chapters} chapter${data.chapters === 1 ? "" : "s"} to ${platform === "canvas" ? "Canvas" : "Google Classroom"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Push failed");
    } finally {
      setBusy(false);
    }
  }

  const list = courses[platform];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Send "{book.title}"</DialogTitle>
          <DialogDescription>
            {platform === "canvas" ? "Creates one Module per part with a Page per chapter, plus a start-here page." : "Creates one Topic per part with a Google Doc material per chapter, plus a how-to-use-this-book material."}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-2 text-sm">
            <p>{result.chapters} chapter{result.chapters === 1 ? "" : "s"} created.</p>
            <ul className="max-h-60 overflow-y-auto space-y-1">
              {result.created.map((c) => { const ch = parts.flatMap((p) => p.chapters).find((x) => x.id === c.chapter); return (
                <li key={c.chapter} className="flex items-center justify-between gap-2"><span className="truncate">{ch ? `Chapter ${ch.chapter.number}: ${ch.chapter.title}` : c.chapter}</span>{c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 text-xs">Open <ExternalLink className="h-3 w-3" /></a>}</li>
              ); })}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={platform} onValueChange={(v) => setPlatform(v as any)}>
              <TabsList className="grid grid-cols-2"><TabsTrigger value="canvas">Canvas</TabsTrigger><TabsTrigger value="google">Google Classroom</TabsTrigger></TabsList>
            </Tabs>
            <div className="space-y-1.5">
              <Label>Course</Label>
              {list === null ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading courses…</div>
                : errs[platform] ? <p className="text-sm text-destructive">{errs[platform]}</p>
                : list.length === 0 ? <p className="text-sm text-muted-foreground">No courses found.</p>
                : (
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue placeholder="Pick a course" /></SelectTrigger>
                    <SelectContent>{list.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={publish} onCheckedChange={(v) => setPublish(v === true)} /> Publish to students right away (otherwise saved as drafts)</label>
            <p className="text-xs text-muted-foreground">{chapterCount} chapter{chapterCount === 1 ? "" : "s"} in {parts.length} part{parts.length === 1 ? "" : "s"}.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{result ? "Close" : "Cancel"}</Button>
          {!result && <Button onClick={run} disabled={busy || !courseId}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Send {chapterCount} chapters</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
