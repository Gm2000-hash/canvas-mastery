// Progress card for the background question-tagging queue.
// Polls tag_job_active() while a job is queued/running/paused.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pause, Play, X, AlertTriangle, Sparkles } from "lucide-react";

export type TagJob = {
  id: string;
  status: "queued" | "running" | "paused" | "completed" | "cancelled";
  pause_reason: string | null;
  scope: string;
  total: number;
  done: number;
  failed: number;
  last_run_at: string | null;
};

export async function fetchActiveTagJob(): Promise<TagJob | null> {
  const { data, error } = await supabase.rpc("tag_job_active");
  if (error) return null;
  const row = (data as any[] | null)?.[0];
  return row ? (row as TagJob) : null;
}

export async function enqueueAllUntagged(): Promise<{ job_id: string; added: number } | null> {
  const { data, error } = await supabase.rpc("enqueue_untagged_questions", { _scope: "all_untagged" });
  if (error) { toast.error(error.message); return null; }
  return data as any;
}

export function TagJobProgress({ onProgress, refreshKey }: { onProgress?: () => void; refreshKey?: number }) {
  const [job, setJob] = useState<TagJob | null>(null);
  const [busy, setBusy] = useState(false);
  const lastDone = useRef<number>(-1);

  const refresh = useCallback(async () => {
    const j = await fetchActiveTagJob();
    setJob(j);
    if (j && lastDone.current >= 0 && j.done !== lastDone.current) onProgress?.();
    if (!j && lastDone.current >= 0) onProgress?.(); // finished — refresh counts once
    lastDone.current = j ? j.done : -1;
  }, [onProgress]);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  useEffect(() => {
    if (!job || job.status === "paused") return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [job, refresh]);

  if (!job) return null;

  const remaining = Math.max(0, job.total - job.done - job.failed);
  const pct = job.total > 0 ? Math.round(((job.done + job.failed) / job.total) * 100) : 0;
  const paused = job.status === "paused";
  const pausedByUser = job.pause_reason === "Paused by you";

  async function control(action: "pause" | "resume" | "cancel") {
    if (!job) return;
    setBusy(true);
    const { error } = await supabase.rpc("tag_job_control", { _job_id: job.id, _action: action });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (action === "cancel") toast.success("Tagging job cancelled");
    if (action === "resume") toast.success("Tagging resumed — the worker picks it up within a minute");
    refresh();
  }

  return (
    <Card className={paused && !pausedByUser ? "border-destructive/50" : undefined}>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {paused
              ? <Pause className="h-4 w-4 text-muted-foreground shrink-0" />
              : <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
            <div className="min-w-0">
              <div className="font-medium flex items-center gap-2 flex-wrap">
                <Sparkles className="h-3.5 w-3.5" />
                AI tagging {paused ? "paused" : job.status === "running" ? "in progress" : "queued"}
                <Badge variant="secondary" className="tabular-nums">{job.done} / {job.total}</Badge>
                {job.failed > 0 && <Badge variant="outline" className="tabular-nums">{job.failed} skipped</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {remaining.toLocaleString()} remaining · tags appear in the Question bank as they finish.
                {!paused && " Runs about 30 questions per minute in the background."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {paused
              ? <Button size="sm" variant="outline" disabled={busy} onClick={() => control("resume")}><Play className="h-3.5 w-3.5 mr-1" />Resume</Button>
              : <Button size="sm" variant="outline" disabled={busy} onClick={() => control("pause")}><Pause className="h-3.5 w-3.5 mr-1" />Pause</Button>}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => control("cancel")}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
          </div>
        </div>
        <Progress value={pct} />
        {paused && !pausedByUser && job.pause_reason && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Paused: {job.pause_reason} Fix the issue, then click Resume.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
