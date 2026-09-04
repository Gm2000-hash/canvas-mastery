// Bulk tagging controls for a selection of quiz questions:
//  - "AI tag selected" re-runs the AI tagger on just those questions
//  - "Apply standard" lets the teacher attach a confirmed standard by hand
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Tag, X } from "lucide-react";
import { StandardsPicker } from "@/components/library/StandardsPicker";
import { ExportButton } from "@/components/library/ExportMenu";
import { resourceFromQuestions } from "@/lib/export/resource";
import type { QuestionRow } from "./QuestionsTab";

export type SelectableQuestion = { id: string; assignment_id: string };

export function BulkTagActions({ selected, allIds, onSelectAll, onClear, onDone, subjectHint, exportRows, exportTitle }: {
  selected: SelectableQuestion[];
  /** Full rows for the current list; the export uses the selected ones (or all when nothing is selected). */
  exportRows?: QuestionRow[];
  exportTitle?: string;
  allIds: string[];
  onSelectAll: () => void;
  onClear: () => void;
  onDone: () => void;
  subjectHint?: string | null;
}) {
  const [tagging, setTagging] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [stdId, setStdId] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const n = selected.length;
  const allSelected = allIds.length > 0 && n === allIds.length;

  async function aiTag() {
    if (!n) return;
    setTagging(true);
    const byAssignment = new Map<string, string[]>();
    selected.forEach((q) => byAssignment.set(q.assignment_id, [...(byAssignment.get(q.assignment_id) ?? []), q.id]));
    let ok = 0, failed = 0;
    const toastId = toast.loading(`AI tagging ${n} question${n === 1 ? "" : "s"}…`);
    for (const [assignment_id, question_ids] of byAssignment) {
      const { data, error } = await supabase.functions.invoke("tag-question-standards", { body: { assignment_id, question_ids } });
      const msg = (error as any)?.message ?? (data as any)?.error;
      if (msg) { failed += question_ids.length; toast.error(String(msg)); }
      else ok += question_ids.length;
    }
    toast.dismiss(toastId);
    setTagging(false);
    if (ok) toast.success(`AI suggested standards for ${ok} question${ok === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}.`);
    onDone();
  }

  async function applyStandard() {
    const standard_id = stdId[0];
    if (!standard_id || !n) return;
    setApplying(true);
    const { data: u } = await supabase.auth.getUser();
    const teacher_id = u.user?.id;
    if (!teacher_id) { setApplying(false); return; }
    const rows = selected.map((q) => ({ teacher_id, question_id: q.id, standard_id, ai_suggested: false, confirmed: true }));
    const { error } = await supabase.from("question_standards").upsert(rows, { onConflict: "question_id,standard_id" });
    setApplying(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Tagged ${n} question${n === 1 ? "" : "s"}`);
    setApplyOpen(false);
    setStdId([]);
    onDone();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox checked={allSelected ? true : n > 0 ? "indeterminate" : false} onCheckedChange={(v) => (v ? onSelectAll() : onClear())} aria-label="Select all" />
        <span className="text-muted-foreground">{n ? `${n} selected` : "Select questions to tag or export them"}</span>
      </label>
      <div className="ml-auto flex items-center gap-2">
        {exportRows && exportRows.length > 0 && (
          <ExportButton
            label={n ? `Export ${n}` : "Export all"}
            source={() => {
              const sel = new Set(selected.map((q) => q.id));
              const rows = n ? exportRows.filter((q) => sel.has(q.id)) : exportRows;
              return [resourceFromQuestions(rows, exportTitle ?? "Question set")];
            }}
          />
        )}
        <Button size="sm" variant="outline" disabled={!n || tagging} onClick={aiTag}>
          {tagging ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />} AI tag selected
        </Button>
        <Popover open={applyOpen} onOpenChange={setApplyOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" disabled={!n}><Tag className="h-3.5 w-3.5 mr-1.5" /> Apply standard</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[440px] space-y-3">
            <div className="text-sm font-medium">Tag {n} question{n === 1 ? "" : "s"} with a standard</div>
            <StandardsPicker value={stdId} onChange={(ids) => setStdId(ids.slice(-1))} multiple={false} placeholder="Choose a standard…" subjectHint={subjectHint} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setApplyOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={applyStandard} disabled={!stdId[0] || applying}>
                {applying && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Apply as confirmed
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {n > 0 && <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection"><X className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
}
