import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Puzzle, Sparkles, Plus, Loader2, HelpCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "@/modules/curriculum/config/auth";
import { ACTIVITY_TYPES } from "@/modules/curriculum/lib/h5p-types";
import { createQuestion, suggestDokAndBlooms } from "@/modules/curriculum/lib/question-bank";
import { QUESTION_TYPE_CATEGORIES, createDefaultAnswers } from "@/modules/curriculum/lib/question-types";
import { toast } from "sonner";
import type { CurriculumLesson } from "@/modules/curriculum/hooks/useCurriculum";

export type InsertedBlock = { html: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Partial<CurriculumLesson> & { id?: string; title?: string };
  lessonId?: string;
  unitId?: string;
  standards?: { code: string; description: string }[];
  onInsert: (block: InsertedBlock) => void;
}

interface LibActivity { id: string; title: string; activity_type: string; }

const PLAYABLE_AI_TYPES = [
  "multiple_choice", "true_false", "single_choice_set", "fill_in_blanks", "drag_the_words",
  "mark_the_words", "summary", "dialog_cards", "flashcards", "memory_game", "crossword",
  "drag_and_drop", "question_set", "accordion", "timeline", "image_hotspots",
];

function activityEmbedBlock(a: { id: string; title: string; activity_type: string }) {
  const typeLabel = ACTIVITY_TYPES.find(t => t.type === a.activity_type)?.label ?? a.activity_type;
  return `<div data-activity-id="${a.id}" style="border:1px solid hsl(217 91% 60% / 0.3);background:linear-gradient(135deg,hsl(217 91% 95%),hsl(217 91% 98%));padding:14px 16px;border-radius:12px;margin:10px 0;display:flex;align-items:center;gap:12px;">
<div style="flex:1;min-width:0;"><div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:hsl(217 91% 50%);">🧩 Activity · ${typeLabel}</div>
<div style="font-weight:600;color:hsl(222 47% 11%);margin-top:2px;">${a.title}</div></div>
<a href="/app/curriculum/activities/${a.id}" target="_blank" rel="noopener" style="background:hsl(217 91% 60%);color:white;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;">Open ↗</a>
</div>`;
}

function questionEmbedBlock(q: { id: string; question_text: string; question_type: string }) {
  return `<div data-question-id="${q.id}" style="border:1px solid hsl(142 71% 45% / 0.3);background:hsl(142 71% 97%);padding:14px 16px;border-radius:12px;margin:10px 0;">
<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:hsl(142 71% 35%);">❓ Check Your Understanding</div>
<div style="margin-top:6px;color:hsl(222 47% 11%);">${q.question_text}</div>
<div style="font-size:11px;color:hsl(215 16% 47%);margin-top:6px;">Saved to Question Bank · <a href="/app/curriculum/question-bank" style="color:hsl(142 71% 35%);text-decoration:underline;">manage</a></div>
</div>`;
}

export function ReadingResourceInsertDialog({ open, onOpenChange, lesson, lessonId, standards, onInsert }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"existing" | "ai-activity" | "ai-question">("existing");

  /* Existing activity list */
  const [activities, setActivities] = useState<LibActivity[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");

  /* AI activity */
  const [aiType, setAiType] = useState<string>("multiple_choice");
  const [aiTitle, setAiTitle] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  /* AI question */
  const [qType, setQType] = useState("multiple_choice_question");
  const [qPrompt, setQPrompt] = useState("");
  const [qBusy, setQBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingList(true);
    supabase.from("h5p_activities").select("id, title, activity_type")
      .eq("user_id", user.id).order("updated_at", { ascending: false })
      .then(({ data }) => { setActivities((data as LibActivity[]) || []); setLoadingList(false); });
  }, [open, user]);

  useEffect(() => {
    if (open && lesson?.title && !aiTitle) setAiTitle(`${lesson.title} — Practice`);
  }, [open, lesson?.title]);

  const filtered = activities.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.activity_type.toLowerCase().includes(search.toLowerCase()));

  const handlePickExisting = (a: LibActivity) => {
    onInsert({ html: activityEmbedBlock(a) });
    onOpenChange(false);
    toast.success(`Embedded "${a.title}"`);
  };

  const handleAiActivity = async () => {
    if (!lessonId) { toast.error("Save the reading first"); return; }
    setAiBusy(true);
    const tId = toast.loading("AI generating activity & saving to library…");
    try {
      const { data, error } = await supabase.functions.invoke("generate-h5p-activity", {
        body: { activityType: aiType, sourceType: "curriculum_lesson", sourceId: lessonId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const content = data?.content;
      if (!content) throw new Error("AI returned no content");

      const finalTitle = aiTitle.trim() || `${lesson.title || "Lesson"} — ${ACTIVITY_TYPES.find(t => t.type === aiType)?.label || aiType}`;
      const { data: inserted, error: insErr } = await supabase.from("h5p_activities").insert({
        user_id: user!.id,
        title: finalTitle,
        activity_type: aiType,
        content: content as any,
      }).select("id, title, activity_type").single();
      if (insErr) throw insErr;

      // Tag with standards if available
      if (standards?.length && inserted) {
        await (supabase.from("h5p_activity_standards" as any) as any).insert(
          standards.map(s => ({ activity_id: inserted.id, ngss_code: s.code, ngss_description: s.description, matched_terms: [] }))
        );
      }
      onInsert({ html: activityEmbedBlock(inserted as any) });
      onOpenChange(false);
      toast.success("Activity saved to library & embedded", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate", { id: tId });
    } finally { setAiBusy(false); }
  };

  const handleAiQuestion = async () => {
    setQBusy(true);
    const tId = toast.loading("AI generating question & saving to bank…");
    try {
      // Use generate-reading-insert with a custom prompt path → reuse generate-questions if exists, fall back to inline AI
      const directive = qPrompt.trim() || `Write ONE short check-for-understanding ${qType.replace(/_/g, " ")} question for the lesson, with correct answer and 3 plausible distractors when applicable.`;
      const { data, error } = await supabase.functions.invoke("generate-reading-insert", {
        body: {
          kind: "key_term", // placeholder — we hijack with prompt for shape, then parse manually below
          lesson: {
            title: lesson.title, objectives: lesson.objectives as any, key_terms: lesson.key_terms as any,
            intro: lesson.intro as any, explanation: lesson.explanation as any,
            reading_paragraphs: lesson.reading_paragraphs as any, reading_title: lesson.reading_title,
          },
          standards,
          prompt: `IGNORE THE EARLIER SHAPE. Return JSON: {"question":"...","correct":"...","distractors":["...","...","..."]}. ${directive}`,
        },
      });
      if (error) throw error;
      const raw = data?.data || {};
      const qText: string = raw.question || raw.term || "";
      if (!qText) throw new Error("AI returned no question");
      const correct = raw.correct || raw.definition || "";
      const distractors: string[] = Array.isArray(raw.distractors) ? raw.distractors : [];

      const answers = qType === "multiple_choice_question"
        ? [
            { id: crypto.randomUUID(), text: correct, weight: 100 },
            ...distractors.slice(0, 3).map(d => ({ id: crypto.randomUUID(), text: d, weight: 0 })),
          ]
        : qType === "true_false_question"
        ? [
            { id: crypto.randomUUID(), text: "True", weight: /true/i.test(correct) ? 100 : 0 },
            { id: crypto.randomUUID(), text: "False", weight: /false/i.test(correct) ? 100 : 0 },
          ]
        : createDefaultAnswers(qType);

      const sugg = suggestDokAndBlooms(qType, qText);
      const inserted = await createQuestion({
        question_text: qText, question_type: qType, points_possible: 1, answers,
        dok_level: sugg.dok, blooms_level: sugg.blooms, source_course: "Reading Editor",
        source_quiz: lesson.title || null,
        standards: standards?.map(s => ({ ngss_code: s.code, ngss_description: s.description })),
      });
      onInsert({ html: questionEmbedBlock({ id: (inserted as any)?.id || "", question_text: qText, question_type: qType }) });
      onOpenChange(false);
      toast.success("Question saved to bank & embedded", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Failed", { id: tId });
    } finally { setQBusy(false); }
  };

  const flatTypes = [...QUESTION_TYPE_CATEGORIES.traditional];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Puzzle className="h-5 w-5 text-primary" /> Insert a Resource</DialogTitle>
          <DialogDescription>
            Pull from your activity library, generate a new activity with AI (saved to the library), or generate a check-for-understanding question (saved to the question bank).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="existing"><Puzzle className="h-3.5 w-3.5 mr-1.5" /> From Library</TabsTrigger>
            <TabsTrigger value="ai-activity"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Activity</TabsTrigger>
            <TabsTrigger value="ai-question"><HelpCircle className="h-3.5 w-3.5 mr-1.5" /> AI Question</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="flex-1 flex flex-col min-h-0 gap-2 mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search your activity library…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
              {loadingList ? <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
                : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {activities.length === 0 ? "No activities yet. Use the AI Activity tab to create one." : "No matching activities."}
                  </p>
                ) : filtered.map(a => {
                  const typeInfo = ACTIVITY_TYPES.find(t => t.type === a.activity_type);
                  return (
                    <button key={a.id} onClick={() => handlePickExisting(a)}
                      className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 border border-transparent hover:border-border">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Puzzle className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <Badge variant="secondary" className="text-[10px] mt-0.5">{typeInfo?.label ?? a.activity_type}</Badge>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Selecting embeds a styled link in the reading; the activity stays editable in the Activity Builder. <a href="/app/curriculum/activities" target="_blank" className="underline">Open library ↗</a>
            </p>
          </TabsContent>

          <TabsContent value="ai-activity" className="flex-1 overflow-y-auto mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label>Activity type</Label>
              <Select value={aiType} onValueChange={setAiType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {ACTIVITY_TYPES.filter(t => PLAYABLE_AI_TYPES.includes(t.type)).map(t => (
                    <SelectItem key={t.type} value={t.type}>{t.label} — <span className="text-muted-foreground text-xs">{t.description}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={aiTitle} onChange={e => setAiTitle(e.target.value)} placeholder="Activity title" />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              AI uses this lesson's title, objectives, key terms, intro, explanation, and reading text as the source. The finished activity is saved to your <a href="/app/curriculum/activities" className="underline" target="_blank">Activity Library</a> and embedded in the reading.
            </div>
            <Button onClick={handleAiActivity} disabled={aiBusy || !lessonId} className="w-full gap-2">
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate & Save to Library
            </Button>
            {!lessonId && <p className="text-xs text-destructive">Save the reading once before generating.</p>}
          </TabsContent>

          <TabsContent value="ai-question" className="flex-1 overflow-y-auto mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label>Question type</Label>
              <Select value={qType} onValueChange={setQType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {flatTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Focus (optional)</Label>
              <Textarea rows={2} value={qPrompt} onChange={e => setQPrompt(e.target.value)} placeholder="e.g. focus on photosynthesis vocabulary; target DOK 2." />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              The question is saved to your <a href="/app/curriculum/question-bank" className="underline" target="_blank">Question Bank</a> (auto-tagged with the reading's standards) and a compact prompt is embedded in the reading.
            </div>
            <Button onClick={handleAiQuestion} disabled={qBusy} className="w-full gap-2">
              {qBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate & Save to Question Bank
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
