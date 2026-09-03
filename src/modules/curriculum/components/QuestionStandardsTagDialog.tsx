import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Tag, X, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/modules/curriculum/config/supabase";
import { StandardsPickerDialog } from "@/modules/curriculum/components/StandardsPickerDialog";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { updateQuestion, type QuestionBankItem } from "@/modules/curriculum/lib/question-bank";
import { MathText } from "@/modules/curriculum/components/MathText";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuestionBankItem | null;
  /** Called after a successful save with the new standards array */
  onSaved: (questionId: string, standards: { ngss_code: string; ngss_description: string }[]) => void;
}

/** Look up the human description for a single NGSS code. */
function descriptionFor(code: string): string {
  for (const subs of Object.values(ALL_SUBSTANDARDS)) {
    const hit = subs.find(s => s.code === code);
    if (hit) return hit.description;
  }
  return code;
}

export function QuestionStandardsTagDialog({ open, onOpenChange, question, onSaved }: Props) {
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && question) {
      setSelectedCodes(new Set(question.standards.map(s => s.ngss_code)));
    }
  }, [open, question]);

  if (!question) return null;

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("standards-tagger", {
        body: {
          questions: [{ id: 1, question_text: question.question_text }],
          framework: "ngss",
        },
      });
      if (error) throw error;
      const tags = data?.tags?.[0]?.standards || [];
      if (tags.length === 0) {
        toast.info("AI couldn't find a confident NGSS match for this question.");
        return;
      }
      // Merge with currently selected
      const merged = new Set(selectedCodes);
      tags.forEach((t: { code: string }) => merged.add(t.code));
      setSelectedCodes(merged);
      toast.success(`AI suggested ${tags.length} standard${tags.length === 1 ? "" : "s"}`);
    } catch (err: any) {
      toast.error(err?.message || "AI tagging failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const standards = [...selectedCodes].map(code => ({
        ngss_code: code,
        ngss_description: descriptionFor(code),
      }));
      await updateQuestion(question.id, {}, standards);
      onSaved(question.id, standards);
      toast.success(standards.length === 0 ? "Standards cleared" : `Tagged with ${standards.length} standard${standards.length === 1 ? "" : "s"}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save standards");
    } finally {
      setSaving(false);
    }
  };

  const removeOne = (code: string) => {
    const next = new Set(selectedCodes);
    next.delete(code);
    setSelectedCodes(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Tag NGSS Standards
            </DialogTitle>
            <DialogDescription>
              Aligning this question to standards keeps quizzes, readings, and exports automatically in sync.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Question preview */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Question</p>
              <MathText text={question.question_text} className="text-sm text-foreground line-clamp-3" inline />
            </div>

            {/* Selected chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">
                  Tagged standards {selectedCodes.size > 0 && <span className="text-muted-foreground font-normal">({selectedCodes.size})</span>}
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
                    onClick={handleAiSuggest}
                    disabled={aiLoading}
                  >
                    {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    AI Suggest
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Browse
                  </Button>
                </div>
              </div>

              {selectedCodes.size === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    No standards yet. Use <span className="font-medium">AI Suggest</span> for a fast match or <span className="font-medium">Browse</span> to pick manually.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-48 rounded-lg border border-border">
                  <div className="p-2 space-y-1">
                    {[...selectedCodes].sort().map(code => (
                      <div key={code} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 group">
                        <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{code}</Badge>
                        <p className="text-xs text-muted-foreground flex-1 leading-snug">{descriptionFor(code)}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeOne(code)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
              Save tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reuse the existing browse-standards picker */}
      <StandardsPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedStandards={selectedCodes}
        onSelectionChange={(next) => setSelectedCodes(new Set(next))}
      />
    </>
  );
}
