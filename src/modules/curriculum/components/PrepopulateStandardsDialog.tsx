import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Leaf, Globe, Atom, BookOpen } from "lucide-react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { NGSS_DIMENSIONS, formatDimensionsForPrompt } from "@/modules/curriculum/lib/ngss-dimensions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  teacherSubjects: string[];
}

// Core ideas with human-readable labels
const NGSS_CORE_IDEAS: { id: string; label: string; discipline: string; gradeLevel: string }[] = [
  { id: "MS-LS1", label: "From Molecules to Organisms", discipline: "Life Science", gradeLevel: "7th Grade" },
  { id: "MS-LS2", label: "Ecosystems: Interactions, Energy, and Dynamics", discipline: "Life Science", gradeLevel: "7th Grade" },
  { id: "MS-LS3", label: "Heredity: Inheritance and Variation of Traits", discipline: "Life Science", gradeLevel: "7th Grade" },
  { id: "MS-LS4", label: "Biological Evolution: Unity and Diversity", discipline: "Life Science", gradeLevel: "7th Grade" },
  { id: "MS-ESS1", label: "Earth's Place in the Universe", discipline: "Earth & Space Science", gradeLevel: "8th Grade" },
  { id: "MS-ESS2", label: "Earth's Systems", discipline: "Earth & Space Science", gradeLevel: "8th Grade" },
  { id: "MS-ESS3", label: "Earth and Human Activity", discipline: "Earth & Space Science", gradeLevel: "8th Grade" },
  { id: "MS-PS1", label: "Matter and Its Interactions", discipline: "Physical Science", gradeLevel: "6th Grade" },
  { id: "MS-PS2", label: "Motion and Stability: Forces and Interactions", discipline: "Physical Science", gradeLevel: "6th Grade" },
  { id: "MS-PS3", label: "Energy", discipline: "Physical Science", gradeLevel: "6th Grade" },
  { id: "MS-PS4", label: "Waves and Their Applications", discipline: "Physical Science", gradeLevel: "6th Grade" },
];

interface GenerationStep {
  coreIdea: string;
  label: string;
  status: "pending" | "creating_unit" | "generating" | "done" | "error";
  lessonsGenerated: number;
  totalSubstandards: number;
  error?: string;
}

export default function PrepopulateStandardsDialog({ open, onOpenChange, onComplete, teacherSubjects }: Props) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [steps, setSteps] = useState<GenerationStep[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [emphasizeSubcomponents, setEmphasizeSubcomponents] = useState(true);
  const abortRef = useRef(false);

  const showScience = teacherSubjects.length === 0 || teacherSubjects.includes("Science");

  // Build the list of core ideas to prepopulate
  const coreIdeas = showScience ? NGSS_CORE_IDEAS : [];
  const totalSubstandards = coreIdeas.reduce((sum, ci) => sum + (ALL_SUBSTANDARDS[ci.id]?.length || 0), 0);

  const handleGenerate = async () => {
    setGenerating(true);
    setDone(false);
    abortRef.current = false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setGenerating(false);
      return;
    }

    // Initialize steps
    const initialSteps: GenerationStep[] = coreIdeas.map((ci) => ({
      coreIdea: ci.id,
      label: `${ci.id}: ${ci.label}`,
      status: "pending",
      lessonsGenerated: 0,
      totalSubstandards: ALL_SUBSTANDARDS[ci.id]?.length || 0,
    }));
    setSteps(initialSteps);

    for (let i = 0; i < coreIdeas.length; i++) {
      if (abortRef.current) break;
      const ci = coreIdeas[i];
      const subs = ALL_SUBSTANDARDS[ci.id] || [];
      setCurrentIdx(i);

      // Update step status: creating unit
      setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "creating_unit" } : s));

      try {
        // 1. Create the unit
        const { data: unitData, error: unitError } = await supabase
          .from("units")
          .insert({
            user_id: user.id,
            title: `${ci.id}: ${ci.label}`,
            description: `NGSS ${ci.discipline} — ${subs.length} performance expectations covering ${ci.label.toLowerCase()}.`,
            grade_level: ci.gradeLevel,
            discipline: ci.discipline,
            sort_order: i,
          })
          .select("id")
          .single();

        if (unitError) throw new Error(`Failed to create unit: ${unitError.message}`);
        const unitId = unitData.id;

        // 2. Generate lesson plans via edge function
        setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "generating" } : s));

        const standardsList = subs.map((s) => {
          const dims = NGSS_DIMENSIONS[s.code];
          if (!emphasizeSubcomponents || !dims?.length) return `${s.code}: ${s.description}`;
          return `${s.code}: ${s.description}\n${formatDimensionsForPrompt(dims)}`;
        }).join("\n\n");

        const subcomponentNote = emphasizeSubcomponents
          ? ` For each lesson, explicitly weave in the listed Science & Engineering Practice (SEP), Disciplinary Core Idea (DCI), and Crosscutting Concept (CCC) — name them in the objectives and design at least one activity that targets each dimension.`
          : "";

        const { data, error } = await supabase.functions.invoke("generate-lesson-plans", {
          body: {
            unitTitle: `${ci.id}: ${ci.label}`,
            discipline: ci.discipline,
            gradeLevel: ci.gradeLevel,
            topic: `All ${ci.id} performance expectations:\n${standardsList}`,
            numLessons: subs.length,
            additionalContext: `Create exactly ${subs.length} lessons, one for each performance expectation listed. Each lesson should directly address its specific standard. Title each lesson with the standard code and a descriptive name (e.g., "${subs[0]?.code}: ${subs[0]?.description.split(" ").slice(0, 6).join(" ")}..."). Make sure every lesson has the correct NGSS standard tagged.${subcomponentNote}`,
          },
        });

        if (error) throw new Error(error.message || "Generation failed");
        if (data?.error) throw new Error(data.error);

        const lessons = data?.lessons || [];
        let saved = 0;

        // 3. Save lessons to the unit
        for (let li = 0; li < lessons.length; li++) {
          const lesson = lessons[li];
          try {
            const { data: inserted, error: insertError } = await supabase
              .from("lesson_plans")
              .insert({
                user_id: user.id,
                unit_id: unitId,
                title: lesson.title,
                duration_minutes: lesson.duration_minutes || 50,
                objectives: lesson.objectives || "",
                activities: lesson.activities || [],
                materials: lesson.materials || "",
                assessment: lesson.assessment || "",
                differentiation: lesson.differentiation || "",
                notes: lesson.notes || "",
                vocabulary: lesson.vocabulary || [],
                resources: lesson.resources || [],
                sort_order: li,
              } as any)
              .select("id")
              .single();

            if (insertError) {
              console.error("Failed to save lesson:", insertError);
              continue;
            }

            // Tag with standards
            if (inserted) {
              const standards = lesson.standards || [];
              for (const std of standards) {
                await supabase.from("lesson_plan_standards").insert({
                  lesson_plan_id: inserted.id,
                  ngss_code: std.code,
                  ngss_description: std.description,
                });
              }
              saved++;
            }
          } catch (e) {
            console.error("Error saving lesson:", e);
          }
        }

        setSteps((prev) =>
          prev.map((s, idx) => idx === i ? { ...s, status: "done", lessonsGenerated: saved } : s)
        );
      } catch (e: any) {
        console.error(`Error processing ${ci.id}:`, e);
        setSteps((prev) =>
          prev.map((s, idx) => idx === i ? { ...s, status: "error", error: e.message } : s)
        );
      }

      // Delay between calls to avoid rate limiting
      if (i < coreIdeas.length - 1 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    setDone(true);
    setGenerating(false);
    onComplete();
  };

  const completedSteps = steps.filter((s) => s.status === "done" || s.status === "error").length;
  const totalLessonsGenerated = steps.reduce((sum, s) => sum + s.lessonsGenerated, 0);
  const errorCount = steps.filter((s) => s.status === "error").length;
  const progressPct = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  const reset = () => {
    setDone(false);
    setSteps([]);
    setCurrentIdx(0);
  };

  const DISC_ICONS: Record<string, React.ElementType> = {
    "Life Science": Leaf,
    "Earth & Space Science": Globe,
    "Physical Science": Atom,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!generating) { onOpenChange(v); reset(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Prepopulate from Standards
          </DialogTitle>
          <DialogDescription>
            Automatically create units and AI-generated lesson plans for every NGSS standard.
          </DialogDescription>
        </DialogHeader>

        {!generating && !done ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
              <p className="text-sm font-medium">What will be created:</p>
              <div className="space-y-1.5">
                {coreIdeas.map((ci) => {
                  const Icon = DISC_ICONS[ci.discipline] || BookOpen;
                  const subCount = ALL_SUBSTANDARDS[ci.id]?.length || 0;
                  return (
                    <div key={ci.id} className="flex items-center gap-2 text-sm">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{ci.id}</span>
                      <span className="text-muted-foreground">— {ci.label}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">{subCount} lessons</Badge>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-border mt-2">
                <p className="text-xs text-muted-foreground">
                  <strong>{coreIdeas.length} units</strong> with <strong>{totalSubstandards} AI-generated lessons</strong> total.
                  Each lesson includes objectives, activities, vocabulary, resources, and NGSS tags.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-card-foreground/10 bg-card flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="emphasize-subs" className="text-sm font-medium cursor-pointer">
                  Emphasize NGSS sub-components
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inject the SEP, DCI, and CCC for each performance expectation into the AI prompt so
                  every generated lesson explicitly addresses all three dimensions.
                </p>
              </div>
              <Switch
                id="emphasize-subs"
                checked={emphasizeSubcomponents}
                onCheckedChange={setEmphasizeSubcomponents}
                className="mt-1"
              />
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <p className="text-xs">
                ⚠️ This will make {coreIdeas.length} AI calls and may take 5–15 minutes.
                Existing units will not be affected.
              </p>
            </div>

            <Button onClick={handleGenerate} className="w-full gap-2" size="lg">
              <Sparkles className="h-4 w-4" />
              Generate {totalSubstandards} Lessons Across {coreIdeas.length} Units
            </Button>
          </div>
        ) : generating || done ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {done ? "Complete!" : `Generating ${steps[currentIdx]?.coreIdea || "..."}...`}
                </span>
                <span className="font-medium">{completedSteps}/{steps.length} units</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              )}
              <div className="text-sm">
                <span className="font-medium">{totalLessonsGenerated}</span> lessons generated
                {errorCount > 0 && (
                  <span className="text-destructive ml-2">· {errorCount} errors</span>
                )}
              </div>
            </div>

            <ScrollArea className="h-[250px]">
              <div className="space-y-1.5 pr-2">
                {steps.map((step, i) => {
                  const Icon =
                    step.status === "done" ? CheckCircle2 :
                    step.status === "error" ? AlertCircle :
                    step.status === "generating" || step.status === "creating_unit" ? Loader2 :
                    null;
                  return (
                    <div key={step.coreIdea} className="flex items-center gap-2 text-sm p-1.5 rounded">
                      {Icon ? (
                        <Icon className={`h-4 w-4 shrink-0 ${
                          step.status === "done" ? "text-primary" :
                          step.status === "error" ? "text-destructive" :
                          "text-primary animate-spin"
                        }`} />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                      )}
                      <span className={`flex-1 ${step.status === "done" ? "text-foreground" : step.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                      {step.status === "done" && (
                        <Badge variant="secondary" className="text-[10px]">{step.lessonsGenerated} lessons</Badge>
                      )}
                      {step.status === "generating" && (
                        <span className="text-[10px] text-muted-foreground">Generating...</span>
                      )}
                      {step.status === "creating_unit" && (
                        <span className="text-[10px] text-muted-foreground">Creating unit...</span>
                      )}
                      {step.status === "error" && (
                        <span className="text-[10px] text-destructive truncate max-w-[120px]" title={step.error}>
                          {step.error}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {done && (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
                  Close
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
