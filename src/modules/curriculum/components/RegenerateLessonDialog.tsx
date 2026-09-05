import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2, RefreshCw, BookOpen, Tag, Layers } from "lucide-react";
import { useToast } from "@/modules/curriculum/config/toast";
import { supabase } from "@/modules/curriculum/config/supabase";
import { readEdgeError } from "@/lib/edgeError";
import { useAuth } from "@/modules/curriculum/config/auth";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { NGSS_DIMENSIONS, getDimensionByCode, formatDimensionsForPrompt } from "@/modules/curriculum/lib/ngss-dimensions";
import { NgssDimensionPicker } from "@/modules/curriculum/components/NgssDimensionPicker";
import { syncDisciplineToLibrary } from "@/modules/curriculum/lib/content-generator";
import { useAiPreferences } from "@/modules/curriculum/hooks/useAiPreferences";
import { normalizeAiLesson } from "@/modules/curriculum/lib/normalize-ai-lesson";

interface LessonData {
  id: string;
  unit_id: string | null;
  title: string;
  objectives: string;
  activities: { name: string; duration: number; description: string }[];
  materials: string;
  assessment: string;
  differentiation: string;
  notes: string;
  vocabulary: { term: string; definition: string }[];
  resources: { title: string; url: string; type: string }[];
  udl_supports?: any;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: LessonData;
  discipline: string;
  gradeLevel: string;
  unitTitle: string;
  /** NGSS/Idaho standards already attached to this lesson — used to scope sub-component picker. */
  standards?: { ngss_code: string; ngss_description: string }[];
  onRegenerated: () => void;
}

export function RegenerateLessonDialog({ open, onOpenChange, lesson, discipline, gradeLevel, unitTitle, standards = [], onRegenerated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [additionalContext, setAdditionalContext] = useState("");
  const [focusConcepts, setFocusConcepts] = useState("");
  const [deemphasizeConcepts, setDeemphasizeConcepts] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [regenerateReading, setRegenerateReading] = useState(false);
  const modelOverride = "";
  const [dimensionPickerOpen, setDimensionPickerOpen] = useState(false);
  const unitDimsKey = lesson.unit_id ? `ngss-dims:unit:${lesson.unit_id}` : null;
  const [selectedDimensionCodes, setSelectedDimensionCodesState] = useState<string[]>(() => {
    if (typeof window === "undefined" || !unitDimsKey) return [];
    try {
      const raw = localStorage.getItem(unitDimsKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const setSelectedDimensionCodes = (codes: string[]) => {
    setSelectedDimensionCodesState(codes);
    if (unitDimsKey) {
      try {
        if (codes.length === 0) localStorage.removeItem(unitDimsKey);
        else localStorage.setItem(unitDimsKey, JSON.stringify(codes));
      } catch {}
    }
  };
  // Reload remembered selection when switching to a different unit/lesson
  useEffect(() => {
    if (!unitDimsKey) {
      setSelectedDimensionCodesState([]);
      return;
    }
    try {
      const raw = localStorage.getItem(unitDimsKey);
      setSelectedDimensionCodesState(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setSelectedDimensionCodesState([]);
    }
  }, [unitDimsKey]);
  const { preferences } = useAiPreferences();

  // NGSS PE codes attached to this lesson — eligible for sub-component drill-down
  const ngssParentCodes = useMemo(
    () => standards.map(s => s.ngss_code).filter(c => !!NGSS_DIMENSIONS[c]),
    [standards]
  );
  const selectedDimensions = useMemo(
    () => selectedDimensionCodes.map(c => getDimensionByCode(c)).filter(Boolean) as NonNullable<ReturnType<typeof getDimensionByCode>>[],
    [selectedDimensionCodes]
  );

  const handleRegenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setProgress(10);
    setStatusText("Regenerating lesson plan...");

    try {
      // Call the existing generate-lesson-plans function for 1 lesson
      const { data, error } = await supabase.functions.invoke("generate-lesson-plans", {
        body: {
          unitTitle,
          discipline,
          gradeLevel,
          topic: lesson.title,
          numLessons: 1,
          additionalContext: `Regenerate this specific lesson: "${lesson.title}". 
Current objectives: ${lesson.objectives}
${additionalContext ? `Teacher instructions: ${additionalContext}` : ""}
${selectedDimensions.length > 0 ? `\nFOCUS ON THESE NGSS SUB-COMPONENTS — design activities, vocabulary, and assessment so students explicitly engage with each one:\n${formatDimensionsForPrompt(selectedDimensions)}\n` : ""}
Improve and fill in any missing information. Keep the same general topic but make it better.`,
          focusConcepts: focusConcepts.trim() || undefined,
          deemphasizeConcepts: deemphasizeConcepts.trim() || undefined,
          ...(modelOverride ? { model_override: modelOverride } : {}),
          ai_preferences: preferences,
        },
      });

      setProgress(40);

      if (error) throw new Error(await readEdgeError(error, "AI generation failed"));
      if (!data?.lessons?.[0]) throw new Error("Invalid response from AI");

      const newLesson = normalizeAiLesson(data.lessons[0]);

      // Update the lesson in the database
      setStatusText("Saving updated lesson...");
      const updateData: Record<string, any> = {
        title: newLesson.title || lesson.title,
        objectives: newLesson.objectives || lesson.objectives,
        activities: newLesson.activities || lesson.activities,
        materials: newLesson.materials || lesson.materials,
        assessment: newLesson.assessment || lesson.assessment,
        differentiation: newLesson.differentiation || lesson.differentiation,
        notes: newLesson.notes || lesson.notes,
        vocabulary: newLesson.vocabulary || lesson.vocabulary,
        resources: newLesson.resources || lesson.resources,
        udl_supports: newLesson.udl_supports || lesson.udl_supports || {},
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await (supabase.from("lesson_plans") as any)
        .update(updateData)
        .eq("id", lesson.id);

      if (updateError) throw updateError;

      setProgress(60);

      // Update standards
      setStatusText("Updating NGSS standards...");
      if (newLesson.standards?.length > 0) {
        // Delete existing standards and insert new ones
        await supabase.from("lesson_plan_standards").delete().eq("lesson_plan_id", lesson.id);
        const stds = newLesson.standards.map((s: any) => ({
          lesson_plan_id: lesson.id,
          ngss_code: s.code || s.ngss_code,
          ngss_description: s.description || s.ngss_description,
        }));
        await supabase.from("lesson_plan_standards").insert(stds);
      }

      setProgress(70);

      // Also run the standards tagger for extra accuracy
      setStatusText("Verifying standards alignment...");
      let detectedStandardCode = "";
      try {
        const allStandards = Object.values(ALL_SUBSTANDARDS).flat().map(s => ({
          code: s.code,
          description: s.description,
        }));

        const { data: tagData } = await supabase.functions.invoke("standards-tagger", {
          body: {
            questions: [{ id: lesson.id, question_text: `${newLesson.title}\n\nObjectives: ${newLesson.objectives}` }],
            framework: "NGSS",
            standardsList: allStandards,
          },
        });

        if (tagData?.results?.[0]?.standards?.length > 0) {
          detectedStandardCode = tagData.results[0].standards[0].code || "";
          const { data: existing } = await supabase
            .from("lesson_plan_standards")
            .select("ngss_code")
            .eq("lesson_plan_id", lesson.id);

          const existingCodes = new Set((existing || []).map((e: any) => e.ngss_code));
          const newStds = tagData.results[0].standards
            .filter((s: any) => !existingCodes.has(s.code))
            .map((s: any) => ({
              lesson_plan_id: lesson.id,
              ngss_code: s.code,
              ngss_description: s.description,
            }));

          if (newStds.length > 0) {
            await supabase.from("lesson_plan_standards").insert(newStds);
          }
        }
      } catch (tagErr) {
        console.warn("Standards verification failed (non-fatal):", tagErr);
      }

      setProgress(85);

      // Regenerate reading if requested
      if (regenerateReading && lesson.unit_id) {
        setStatusText("Regenerating curriculum reading...");
        try {
          const { data: readingData } = await supabase.functions.invoke("generate-curriculum-reading", {
            body: {
              subject_area: newLesson.title || lesson.title,
              objectives: newLesson.objectives || lesson.objectives,
              format: "textbook",
              ngss_standard: detectedStandardCode || undefined,
            },
          });

          if (readingData?.lesson) {
            const reading = readingData.lesson;
            // Find existing curriculum lesson for this unit+title or create new
            const { data: existingReading } = await supabase
              .from("curriculum_lessons")
              .select("id")
              .eq("unit_id", lesson.unit_id)
              .ilike("title", `%${lesson.title}%`)
              .limit(1);

            if (existingReading?.[0]) {
              await (supabase.from("curriculum_lessons") as any).update({
                title: reading.title || newLesson.title,
                objectives: reading.objectives || [],
                intro: reading.intro || [],
                explanation: reading.explanation || [],
                key_terms: reading.key_terms || [],
                reading_title: reading.reading?.reading_title || null,
                reading_paragraphs: reading.reading?.reading_paragraphs || [],
                chapter: readingData.chapter ?? null,
                updated_at: new Date().toISOString(),
              }).eq("id", existingReading[0].id);
            } else {
              const { count } = await supabase
                .from("curriculum_lessons")
                .select("id", { count: "exact", head: true })
                .eq("unit_id", lesson.unit_id);

              await supabase.from("curriculum_lessons").insert({
                unit_id: lesson.unit_id,
                user_id: user.id,
                title: reading.title || newLesson.title,
                sort_order: count || 0,
                objectives: reading.objectives || [],
                intro: reading.intro || [],
                explanation: reading.explanation || [],
                key_terms: reading.key_terms || [],
                reading_title: reading.reading?.reading_title || null,
                reading_paragraphs: reading.reading?.reading_paragraphs || [],
                chapter: readingData.chapter ?? null,
              } as any);
            }
          }
        } catch (readErr) {
          console.warn("Reading regeneration failed (non-fatal):", readErr);
        }
      }

      // Sync to reading library after generating/regenerating readings
      if (regenerateReading && discipline) {
        await syncDisciplineToLibrary(user.id, discipline);
      }

      setProgress(100);
      setStatusText("Done!");
      toast({ title: "Lesson regenerated successfully!" });
      onRegenerated();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Regeneration error:", err);
      toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
      setProgress(0);
      setStatusText("");
    }
  };

  // Identify what's missing
  const missingItems: string[] = [];
  if (!lesson.vocabulary?.length) missingItems.push("vocabulary");
  if (!lesson.resources?.length) missingItems.push("resources");
  if (!lesson.assessment?.trim()) missingItems.push("assessment");
  if (!lesson.differentiation?.trim()) missingItems.push("differentiation");
  if (!lesson.notes?.trim()) missingItems.push("teacher notes");
  if (!lesson.materials?.trim()) missingItems.push("materials");
  if ((lesson.activities?.length || 0) < 4) missingItems.push("activities (< 4)");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" /> Regenerate Lesson
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-xl text-sm bg-info text-primary-foreground">
            <p className="text-destructive-foreground">
              AI will regenerate <span className="font-medium text-primary-foreground">"{lesson.title}"</span> with updated content, NGSS standards, and vocabulary.
            </p>
          </div>

          {missingItems.length > 0 && (
            <div className="p-3 rounded-xl bg-destructive/10 text-sm">
              <p className="text-destructive font-medium text-xs mb-1">Missing or incomplete:</p>
              <p className="text-destructive/80 text-xs">{missingItems.join(", ")}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Additional Instructions (optional)</Label>
            <Textarea
              placeholder="e.g. Add more hands-on activities, focus on vocabulary, include a lab..."
              value={additionalContext}
              onChange={e => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <Label className="text-sm flex items-center gap-1.5">
              🎯 Key Concepts to Emphasize <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              placeholder="e.g. multicellular vs. unicellular organisms, levels of organization, specialized cells"
              value={focusConcepts}
              onChange={e => setFocusConcepts(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              These will become the centerpiece of objectives, vocabulary, and the Core Learning phase.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-muted-foreground/20 bg-muted/40 p-3">
            <Label className="text-sm flex items-center gap-1.5">
              ⬇️ Topics to De-emphasize <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              placeholder="e.g. microscopes, lab equipment history"
              value={deemphasizeConcepts}
              onChange={e => setDeemphasizeConcepts(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              The AI will mention these only briefly, not as activities or assessment items.
            </p>
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <Label className="text-sm">Update NGSS standards</Label>
              </div>
              <span className="text-xs text-muted-foreground bg-primary/10 rounded-full px-2 py-0.5">Always on</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <Label htmlFor="regenReading" className="text-sm">Regenerate curriculum reading</Label>
              </div>
              <Switch id="regenReading" checked={regenerateReading} onCheckedChange={setRegenerateReading} />
            </div>
          </div>

          {ngssParentCodes.length > 0 && (
            <div className="rounded-xl border border-card-foreground/10 bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight">Focus on NGSS sub-components</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {selectedDimensionCodes.length === 0
                        ? "Optionally narrow the AI to specific Practices, Core Ideas, or Crosscutting Concepts. Saved per unit."
                        : `${selectedDimensionCodes.length} selected — remembered for this unit.`}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-lg shrink-0"
                  onClick={() => setDimensionPickerOpen(true)}
                >
                  {selectedDimensionCodes.length > 0 ? "Edit" : "Choose"}
                </Button>
              </div>
              {selectedDimensions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDimensions.map(d => (
                    <span key={d.code} className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5">
                      {d.type} · {d.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">UDL-aligned</span><span>Engagement · Representation · Action & Expression baked into the lesson.</span></div>
          </div>

          {generating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{statusText}</p>
            </div>
          )}

          <Button onClick={handleRegenerate} className="w-full rounded-xl gap-2 bg-info hover:bg-info/90" disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Regenerating..." : "Regenerate Lesson"}
          </Button>
        </div>
      </DialogContent>

      <NgssDimensionPicker
        open={dimensionPickerOpen}
        onOpenChange={setDimensionPickerOpen}
        parentCodes={ngssParentCodes}
        selected={selectedDimensionCodes}
        onSave={setSelectedDimensionCodes}
        title="Focus this regeneration on…"
        description="Pick the Practices, Core Ideas, or Crosscutting Concepts the AI should emphasize."
      />
    </Dialog>
  );
}
