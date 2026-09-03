import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { StandardsPicker } from "./StandardsPicker";
import { SECTIONS, type LibraryKind } from "./libraryTypes";
import type { EditorDraft } from "./LibraryItemEditor";
import { GRADES } from "@/lib/frameworks";

const READING_LEVELS = ["Below grade level", "On grade level", "Above grade level"];

export function GenerateContentDialog({ open, kind, onClose, onDraft, subjectHint, gradeHint }: {
  open: boolean;
  kind: LibraryKind;
  onClose: () => void;
  onDraft: (d: EditorDraft) => void;
  subjectHint?: string | null;
  gradeHint?: string | null;
}) {
  const [standardIds, setStandardIds] = useState<string[]>([]);
  const [grade, setGrade] = useState<string>(gradeHint ?? "none");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [level, setLevel] = useState(READING_LEVELS[1]);
  const [format, setFormat] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = SECTIONS.find((s) => s.key === kind)!;

  async function run() {
    if (!standardIds.length) { toast.error("Pick at least one standard"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-library-content", {
        body: {
          kind, standard_ids: standardIds,
          grade: grade === "none" ? null : grade, subject: subjectHint ?? null,
          options: { length, reading_level: level, format: format || undefined, topic: topic || undefined },
        },
      });
      if (error) throw new Error((error as any).message ?? "Generation failed");
      if ((data as any)?.error) throw new Error(typeof data.error === "string" ? data.error : "Generation failed");
      onDraft({
        kind, title: data.title, body: data.body, source: "ai",
        grade: data.grade ?? (grade === "none" ? null : grade), subject: data.subject ?? subjectHint ?? null,
        standardIds: data.suggested_standard_ids ?? standardIds,
      });
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Generate a {meta.singular}</DialogTitle>
          <DialogDescription>The AI drafts it from your chosen standards. You review and edit before it's saved.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Standards</Label>
            <StandardsPicker value={standardIds} onChange={setStandardIds} subjectHint={subjectHint} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Use standard's grade</SelectItem>
                  {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Length</Label>
              <Select value={length} onValueChange={(v) => setLength(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reading level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{READING_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Format (optional)</Label>
              <Input value={format} onChange={(e) => setFormat(e.target.value)} placeholder={kind === "activity" ? "e.g. stations, lab, card sort" : kind === "lesson_plan" ? "e.g. 5E, direct instruction" : "e.g. article, dialogue, case study"} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Topic focus (optional)</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Yellowstone supervolcano, local watershed…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {busy ? "Drafting…" : "Generate draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
