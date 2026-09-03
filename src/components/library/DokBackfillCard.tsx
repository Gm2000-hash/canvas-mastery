// Retroactive Depth-of-Knowledge tagging for the whole library.
//  - Quiz questions missing a DOK go through the background tagging queue
//    (same worker as standards tagging; it now returns DOK alongside standards).
//  - Readings / activities / lesson plans are tagged directly in batches until
//    none remain.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Loader2, Sparkles } from "lucide-react";
import { TagJobProgress } from "@/pages/app/standards/TagJobProgress";

export function DokBackfillCard({ onChanged }: { onChanged?: () => void }) {
  const [qMissing, setQMissing] = useState<number | null>(null);
  const [iMissing, setIMissing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [itemProgress, setItemProgress] = useState<string | null>(null);
  const [jobKey, setJobKey] = useState(0);

  const refresh = useCallback(async () => {
    const [q, i] = await Promise.all([
      supabase.from("quiz_questions").select("id", { count: "exact", head: true }).is("dok_level", null),
      supabase.from("library_items").select("id", { count: "exact", head: true }).eq("dok_levels", "{}"),
    ]);
    setQMissing(q.count ?? 0);
    setIMissing(i.count ?? 0);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function run() {
    setBusy(true);
    try {
      // 1) Questions → background queue.
      if ((qMissing ?? 0) > 0) {
        const { data, error } = await supabase.rpc("enqueue_untagged_questions", { _scope: "dok_backfill" });
        if (error) toast.error(error.message);
        else {
          const added = (data as any)?.added ?? 0;
          if (added > 0) toast.success(`Queued ${added.toLocaleString()} question${added === 1 ? "" : "s"} for DOK tagging — runs in the background.`);
          setJobKey((k) => k + 1);
        }
      }
      // 2) Library items → tag now, looping until done.
      let remaining = iMissing ?? 0;
      let tagged = 0;
      let guard = 0;
      while (remaining > 0 && guard < 50) {
        guard++;
        setItemProgress(`${remaining.toLocaleString()} item${remaining === 1 ? "" : "s"} left…`);
        const { data, error } = await supabase.functions.invoke("tag-library-dok", { body: { all: true } });
        if (error) { toast.error((error as any).message ?? "Tagging failed"); break; }
        if ((data as any)?.error) { toast.error(String((data as any).error)); break; }
        tagged += (data as any).tagged ?? 0;
        const next = (data as any).remaining ?? 0;
        if ((data as any).processed === 0 || next >= remaining && (data as any).tagged === 0) break; // nothing tagged this round — avoid spinning
        remaining = next;
        onChanged?.();
      }
      if (tagged) toast.success(`Tagged ${tagged} library item${tagged === 1 ? "" : "s"} with DOK levels.`);
    } finally {
      setItemProgress(null);
      setBusy(false);
      refresh();
      onChanged?.();
    }
  }

  const total = (qMissing ?? 0) + (iMissing ?? 0);
  if (qMissing === null || iMissing === null) return null;

  return (
    <div className="space-y-3">
      <TagJobProgress refreshKey={jobKey} onProgress={() => { refresh(); onChanged?.(); }} />
      {total > 0 && (
        <Card className="border-primary/20 bg-card/60">
          <CardContent className="py-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <Layers className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  Depth of Knowledge not yet tagged
                  {qMissing > 0 && <Badge variant="secondary" className="tabular-nums">{qMissing.toLocaleString()} question{qMissing === 1 ? "" : "s"}</Badge>}
                  {iMissing > 0 && <Badge variant="secondary" className="tabular-nums">{iMissing.toLocaleString()} item{iMissing === 1 ? "" : "s"}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  New content is tagged automatically. Run this once to add DOK levels to everything already in your library — questions tag in the background; readings, activities and lesson plans tag right away.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={run} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              {busy ? (itemProgress ?? "Queuing…") : "Tag everything with DOK"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
