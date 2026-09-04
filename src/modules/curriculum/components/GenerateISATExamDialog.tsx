import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, CheckCircle2, FileText, BookOpen, Lightbulb } from "lucide-react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { StandardsPickerDialog } from "@/modules/curriculum/components/StandardsPickerDialog";
import { useAiPreferences } from "@/modules/curriculum/hooks/useAiPreferences";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const DISCIPLINES = [
  { id: "physical", label: "Physical Science", groups: ["MS-PS1", "MS-PS2", "MS-PS3", "MS-PS4"] },
  { id: "life", label: "Life Science", groups: ["MS-LS1", "MS-LS2", "MS-LS3", "MS-LS4"] },
  { id: "earth", label: "Earth & Space Science", groups: ["MS-ESS1", "MS-ESS2", "MS-ESS3"] },
];

export default function GenerateISATExamDialog({ open, onOpenChange, onComplete }: Props) {
  const [questionCount, setQuestionCount] = useState(35);
  const [title, setTitle] = useState("");
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [examId, setExamId] = useState<string | null>(null);
  const [selectedStandards, setSelectedStandards] = useState<Set<string>>(new Set());
  const [standardsPickerOpen, setStandardsPickerOpen] = useState(false);
  const modelOverride = "";
  const { preferences } = useAiPreferences();

  const selectedStandardsList = useMemo(() => {
    const result: { code: string; description: string }[] = [];
    for (const [, subs] of Object.entries(ALL_SUBSTANDARDS)) {
      for (const s of subs) {
        if (selectedStandards.has(s.code)) {
          result.push({ code: s.code, description: s.description });
        }
      }
    }
    return result;
  }, [selectedStandards]);

  const selectedDisciplineLabels = useMemo(() => {
    return DISCIPLINES.filter(d => d.groups.some(g =>
      (ALL_SUBSTANDARDS[g] || []).some(s => selectedStandards.has(s.code))
    )).map(d => d.label);
  }, [selectedStandards]);

  const handleGenerate = async () => {
    if (selectedStandards.size === 0) {
      toast.error("Please select at least one standard");
      return;
    }

    setGenerating(true);
    setDone(false);

    try {
      const { data, error } = await supabase.functions.invoke("generate-isat-exam", {
        body: {
          question_count: questionCount,
          title: title || undefined,
          selected_standards: selectedStandardsList,
          ...(modelOverride ? { model_override: modelOverride } : {}),
          ai_preferences: preferences,
        },
      });

      if (error) throw new Error(error.message || "Generation failed");
      if (data?.error) throw new Error(data.error);

      const questions = data?.questions || [];
      if (questions.length === 0) throw new Error("No questions generated");

      const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points_possible || 1), 0);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const examTitle = title || `ISAT Practice Exam — ${selectedDisciplineLabels.join(", ")}`;
      const gradeLevel = selectedDisciplineLabels.length === 1
        ? (DISCIPLINES.find(d => d.label === selectedDisciplineLabels[0])?.id === "physical" ? "6th"
          : DISCIPLINES.find(d => d.label === selectedDisciplineLabels[0])?.id === "life" ? "7th" : "8th")
        : "mixed";

      const { data: inserted, error: insertError } = await supabase
        .from("isat_exams")
        .insert({
          user_id: user.id,
          title: examTitle,
          grade_level: gradeLevel,
          question_count: questions.length,
          questions: questions as any,
          total_points: totalPoints,
          hints_enabled: hintsEnabled,
        } as any)
        .select("id")
        .single();

      if (insertError) throw insertError;

      setExamId((inserted as any)?.id || null);
      setDone(true);
      toast.success(`ISAT exam created with ${questions.length} questions!`);
      onComplete();
    } catch (e: any) {
      console.error("ISAT exam generation error:", e);
      toast.error(e.message || "Failed to generate exam");
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setDone(false);
    setExamId(null);
    setTitle("");
    setHintsEnabled(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!generating) { onOpenChange(v); reset(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generate ISAT Practice Exam
            </DialogTitle>
            <DialogDescription>
              Configure your practice exam and select which standards to cover.
            </DialogDescription>
          </DialogHeader>

          {!generating && !done ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Exam Title (optional)</Label>
                <Input
                  placeholder="ISAT Practice Exam"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Number of Questions (1–50)</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-32"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <div>
                    <Label className="text-sm font-medium">Enable Hints</Label>
                    <p className="text-xs text-muted-foreground">
                      {hintsEnabled ? "Students can reveal hints during the exam" : "No hints — formal assessment mode"}
                    </p>
                  </div>
                </div>
                <Switch checked={hintsEnabled} onCheckedChange={setHintsEnabled} />
              </div>

              {/* Standards selection */}
              <div className="space-y-2">
                <Label>Standards to Cover</Label>
                <Button
                  variant="outline"
                  className="w-full justify-between h-auto py-3"
                  onClick={() => setStandardsPickerOpen(true)}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedStandards.size === 0
                        ? "Browse & select standards..."
                        : `${selectedStandards.size} standard${selectedStandards.size !== 1 ? "s" : ""} selected`}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {selectedStandards.size}
                  </Badge>
                </Button>
                {selectedStandards.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedDisciplineLabels.map(label => (
                      <Badge key={label} variant="outline" className="text-base">{label}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                <p className="text-sm font-medium">Question Types Included:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Multiple Choice", "Select All That Apply", "Drag & Drop",
                    "Data Analysis", "Modeling & Diagrams", "Scenario-Based",
                    "Constructed Response", "Investigation Design", "Concept Mapping",
                  ].map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">UDL-aligned</span><span>Engagement · Representation · Action & Expression baked into every question.</span></div>
              </div>

              <Button
                onClick={handleGenerate}
                className="w-full gap-2"
                size="lg"
                disabled={selectedStandards.size === 0}
              >
                <Sparkles className="h-4 w-4" />
                Generate {questionCount}-Question Exam ({selectedStandards.size} standards)
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                This may take 30-60 seconds as AI generates a comprehensive exam.
              </p>
            </div>
          ) : generating ? (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Generating your {questionCount}-question ISAT practice exam...
                </p>
                <p className="text-xs text-muted-foreground">
                  Covering {selectedStandards.size} standards across {selectedDisciplineLabels.join(", ")}
                </p>
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          ) : done ? (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <p className="text-sm font-medium">ISAT Practice Exam Created!</p>
                <p className="text-xs text-muted-foreground">
                  Your exam is ready. You can take it from the ISAT Exams tab.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
                  Close
                </Button>
                <Button onClick={reset}>Generate Another</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <StandardsPickerDialog
        open={standardsPickerOpen}
        onOpenChange={setStandardsPickerOpen}
        selectedStandards={selectedStandards}
        onSelectionChange={setSelectedStandards}
      />
    </>
  );
}
