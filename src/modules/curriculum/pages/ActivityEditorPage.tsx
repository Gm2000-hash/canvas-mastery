import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@/modules/curriculum/config/router";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityPlayer } from "@/modules/curriculum/components/activities/ActivityPlayer";
import { FillInBlanksEditor } from "@/modules/curriculum/components/activities/editors/FillInBlanksEditor";
import { DragTheWordsEditor } from "@/modules/curriculum/components/activities/editors/DragTheWordsEditor";
import { AccordionEditor } from "@/modules/curriculum/components/activities/editors/AccordionEditor";
import { TimelineEditor } from "@/modules/curriculum/components/activities/editors/TimelineEditor";
import { MultipleChoiceEditor } from "@/modules/curriculum/components/activities/editors/MultipleChoiceEditor";
import { TrueFalseEditor } from "@/modules/curriculum/components/activities/editors/TrueFalseEditor";
import { SingleChoiceSetEditor } from "@/modules/curriculum/components/activities/editors/SingleChoiceSetEditor";
import { MarkTheWordsEditor } from "@/modules/curriculum/components/activities/editors/MarkTheWordsEditor";
import { EssayEditor } from "@/modules/curriculum/components/activities/editors/EssayEditor";
import { SummaryEditor } from "@/modules/curriculum/components/activities/editors/SummaryEditor";
import { DialogCardsEditor } from "@/modules/curriculum/components/activities/editors/DialogCardsEditor";
import { FlashcardsEditor } from "@/modules/curriculum/components/activities/editors/FlashcardsEditor";
import { MemoryGameEditor } from "@/modules/curriculum/components/activities/editors/MemoryGameEditor";
import { ArithmeticQuizEditor } from "@/modules/curriculum/components/activities/editors/ArithmeticQuizEditor";
import { DragAndDropEditor } from "@/modules/curriculum/components/activities/editors/DragAndDropEditor";
import { QuestionSetEditor } from "@/modules/curriculum/components/activities/editors/QuestionSetEditor";
import { PersonalityQuizEditor } from "@/modules/curriculum/components/activities/editors/PersonalityQuizEditor";
import { GameMapEditor } from "@/modules/curriculum/components/activities/editors/GameMapEditor";
import { ColumnEditor } from "@/modules/curriculum/components/activities/editors/ColumnEditor";
import { CoursePresentationEditor } from "@/modules/curriculum/components/activities/editors/CoursePresentationEditor";
import { DocumentationToolEditor } from "@/modules/curriculum/components/activities/editors/DocumentationToolEditor";
import { ImageHotspotsEditor } from "@/modules/curriculum/components/activities/editors/ImageHotspotsEditor";
import { InteractiveBookEditor } from "@/modules/curriculum/components/activities/editors/InteractiveBookEditor";
import { InteractiveVideoEditor } from "@/modules/curriculum/components/activities/editors/InteractiveVideoEditor";
import { VirtualTourEditor } from "@/modules/curriculum/components/activities/editors/VirtualTourEditor";
import { CrosswordEditor } from "@/modules/curriculum/components/activities/editors/CrosswordEditor";
import { AgamottoEditor } from "@/modules/curriculum/components/activities/editors/AgamottoEditor";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "@/modules/curriculum/config/auth";
import { useToast } from "@/modules/curriculum/config/toast";
import { ACTIVITY_TYPES } from "@/modules/curriculum/lib/h5p-types";
import type {
  ActivityType, ActivityContent, FillInBlanksContent, DragTheWordsContent, AccordionContent, TimelineContent,
  MultipleChoiceContent, TrueFalseContent, SingleChoiceSetContent, MarkTheWordsContent,
  EssayContent, SummaryContent, DialogCardsContent, FlashcardsContent, MemoryGameContent,
  ArithmeticQuizContent, DragAndDropContent, QuestionSetContent, PersonalityQuizContent, GameMapContent,
  ColumnContent, CoursePresentationContent, DocumentationToolContent, ImageHotspotsContent,
  InteractiveBookContent, InteractiveVideoContent, VirtualTourContent, CrosswordContent, AgamottoContent,
} from "@/modules/curriculum/lib/h5p-types";
import { ArrowLeft, Save, Puzzle, Download, Sparkles, Loader2 } from "lucide-react";
import { exportActivityAsH5P } from "@/modules/curriculum/lib/export-h5p";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActivityStandards, type ActivityStandard } from "@/modules/curriculum/hooks/useActivityStandards";
import { Badge } from "@/components/ui/badge";
import { ActivityStandardsPicker } from "@/modules/curriculum/components/ActivityStandardsPicker";

interface SourceOption { id: string; title: string; type: "lesson_plan" | "curriculum_lesson" | "reading_library"; }

export default function ActivityEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { tagActivity, fetchStandards, addStandard, removeStandard, tagging } = useActivityStandards();

  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("fill_in_blanks");
  const [content, setContent] = useState<ActivityContent>({ text: "", acceptAlternatives: true });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [generating, setGenerating] = useState(false);
  const [standards, setStandards] = useState<ActivityStandard[]>([]);

  useEffect(() => {
    if (!id || !user) return;
    supabase.from("h5p_activities").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error || !data) { navigate("/app/curriculum/activities"); return; }
      setTitle((data as any).title);
      setActivityType((data as any).activity_type as ActivityType);
      setContent((data as any).content as ActivityContent);
      setLoading(false);
    });
    // Fetch standards
    fetchStandards([id]).then(map => setStandards(map[id] || []));
  }, [id, user]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.from("h5p_activities").update({
      title, content: content as any, updated_at: new Date().toISOString()
    }).eq("id", id);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Activity saved" });
  };

  const typeInfo = ACTIVITY_TYPES.find(t => t.type === activityType);
  const supportsAI = true; // All activity types now support AI generation

  const openAIDialog = async () => {
    if (sources.length === 0 && user) {
      const [lp, cl, lb] = await Promise.all([
        supabase.from("lesson_plans").select("id, title").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("curriculum_lessons").select("id, title").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("library_books").select("id, title, source_discipline").eq("user_id", user.id).not("source_discipline", "is", null).order("updated_at", { ascending: false }),
      ]);
      const opts: SourceOption[] = [
        ...((lb.data || []) as any[]).map(d => ({ id: d.id, title: d.title, type: "reading_library" as const })),
        ...((lp.data || []) as any[]).map(d => ({ id: d.id, title: d.title, type: "lesson_plan" as const })),
        ...((cl.data || []) as any[]).map(d => ({ id: d.id, title: d.title, type: "curriculum_lesson" as const })),
      ];
      setSources(opts);
      if (opts.length > 0) setSelectedSource(opts[0].id);
    }
    setShowAIDialog(true);
  };

  const handleGenerate = async () => {
    const source = sources.find(s => s.id === selectedSource);
    if (!source) return;
    setGenerating(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-h5p-activity", {
        body: { activityType, sourceType: source.type, sourceId: source.id },
      });
      if (fnData?.error) throw new Error(fnData.error);
      if (fnError) throw fnError;
      if (!fnData?.content) throw new Error("No content generated");
      setContent(fnData.content as ActivityContent);
      setShowAIDialog(false);
      toast({ title: "Content generated with AI!", description: "Review and save when ready." });
      // Auto-tag with NGSS standards
      if (id) {
        tagActivity(id, activityType, fnData.content, title).then(() => {
          fetchStandards([id]).then(map => setStandards(map[id] || []));
        });
      }
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const renderEditor = () => {
    switch (activityType) {
      case "fill_in_blanks": return <FillInBlanksEditor content={content as FillInBlanksContent} onChange={setContent} />;
      case "drag_the_words": return <DragTheWordsEditor content={content as DragTheWordsContent} onChange={setContent} />;
      case "accordion": return <AccordionEditor content={content as AccordionContent} onChange={setContent} />;
      case "timeline": return <TimelineEditor content={content as TimelineContent} onChange={setContent} />;
      case "multiple_choice": return <MultipleChoiceEditor content={content as MultipleChoiceContent} onChange={setContent} />;
      case "true_false": return <TrueFalseEditor content={content as TrueFalseContent} onChange={setContent} />;
      case "single_choice_set": return <SingleChoiceSetEditor content={content as SingleChoiceSetContent} onChange={setContent} />;
      case "mark_the_words": return <MarkTheWordsEditor content={content as MarkTheWordsContent} onChange={setContent} />;
      case "essay": return <EssayEditor content={content as EssayContent} onChange={setContent} />;
      case "summary": return <SummaryEditor content={content as SummaryContent} onChange={setContent} />;
      case "dialog_cards": return <DialogCardsEditor content={content as DialogCardsContent} onChange={setContent} />;
      case "flashcards": return <FlashcardsEditor content={content as FlashcardsContent} onChange={setContent} />;
      case "memory_game": return <MemoryGameEditor content={content as MemoryGameContent} onChange={setContent} />;
      case "arithmetic_quiz": return <ArithmeticQuizEditor content={content as ArithmeticQuizContent} onChange={setContent} />;
      case "drag_and_drop": return <DragAndDropEditor content={content as DragAndDropContent} onChange={setContent} />;
      case "question_set": return <QuestionSetEditor content={content as QuestionSetContent} onChange={setContent} />;
      case "personality_quiz": return <PersonalityQuizEditor content={content as PersonalityQuizContent} onChange={setContent} />;
      case "game_map": return <GameMapEditor content={content as GameMapContent} onChange={setContent} />;
      case "column": return <ColumnEditor content={content as ColumnContent} onChange={setContent} />;
      case "course_presentation": return <CoursePresentationEditor content={content as CoursePresentationContent} onChange={setContent} />;
      case "documentation_tool": return <DocumentationToolEditor content={content as DocumentationToolContent} onChange={setContent} />;
      case "image_hotspots": return <ImageHotspotsEditor content={content as ImageHotspotsContent} onChange={setContent} />;
      case "interactive_book": return <InteractiveBookEditor content={content as InteractiveBookContent} onChange={setContent} />;
      case "interactive_video": return <InteractiveVideoEditor content={content as InteractiveVideoContent} onChange={setContent} />;
      case "virtual_tour": return <VirtualTourEditor content={content as VirtualTourContent} onChange={setContent} />;
      case "crossword": return <CrosswordEditor content={content as CrosswordContent} onChange={setContent} />;
      case "agamotto": return <AgamottoEditor content={content as AgamottoContent} onChange={setContent} />;
      default: return <p className="text-sm text-muted-foreground">Unknown type</p>;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-card/80 glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[
          { label: "Activity Builder", path: "/app/curriculum/activities" },
          { label: title || (typeInfo?.label ?? "Activity") },
        ]} />
        <div className="flex-1" />
        {supportsAI && (
          <Button variant="outline" size="sm" onClick={openAIDialog} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {generating ? "Generating…" : "Generate with AI"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await exportActivityAsH5P(title, activityType, content);
              toast({ title: "H5P file downloaded" });
            } catch (err: any) {
              toast({ title: "Export failed", description: err.message, variant: "destructive" });
            }
          }}
        >
          <Download className="h-4 w-4 mr-1.5" /> Export H5P
        </Button>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1.5" /> {saving ? "Saving..." : "Save"}
        </Button>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-6 bg-page-green">
        <div>
          <Label className="text-sm font-medium">Activity Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1.5 text-lg font-semibold" />
        </div>

        <ActivityStandardsPicker
          standards={standards}
          tagging={tagging}
          onAdd={async (code, description) => {
            if (!id) return;
            await addStandard(id, code, description);
            const map = await fetchStandards([id]);
            setStandards(map[id] || []);
          }}
          onRemove={async (standardId) => {
            if (!id) return;
            await removeStandard(standardId);
            setStandards(prev => prev.filter(s => s.id !== standardId));
          }}
          onAutoTag={() => {
            if (!id) return;
            tagActivity(id, activityType, content, title).then(() => {
              fetchStandards([id]).then(map => setStandards(map[id] || []));
            });
          }}
        />

        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <Card className="p-6">
              {renderEditor()}
            </Card>
          </TabsContent>
          <TabsContent value="preview">
            <Card className="p-6">
              <ActivityPlayer type={activityType} content={content} />
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* AI Generation Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Generate Content with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Select a lesson or reading to use as the source material. AI will generate {typeInfo?.label} content based on it.
            </p>
            <div>
              <Label className="text-sm">Source lesson or reading</Label>
              {sources.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2">No lessons found. Create a lesson plan or curriculum lesson first.</p>
              ) : (
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select a lesson..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="mr-1.5 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                          {s.type === "lesson_plan" ? "Plan" : s.type === "reading_library" ? "Reading" : "Curriculum"}
                        </span>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={handleGenerate} disabled={!selectedSource || generating} className="w-full gap-2">
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Content</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">This will replace the current activity content.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
