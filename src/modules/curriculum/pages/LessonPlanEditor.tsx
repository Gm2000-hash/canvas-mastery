import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "@/modules/curriculum/config/router";
import { useAuth } from "@/modules/curriculum/config/auth";
import { supabase } from "@/modules/curriculum/config/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Save, Plus, Trash2, Clock, Target, BookOpen, CheckCircle, Users, StickyNote, GraduationCap, FileDown, Link2, Video, FileText, Gamepad2, Lock, GripVertical, BookOpenCheck, Puzzle, Download, RefreshCw, Sparkles, Loader2, Heart, Eye, Hand, MessageCircle, X, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmbedActivityPicker, type EmbeddedActivity } from "@/modules/curriculum/components/EmbedActivityPicker";
import { ActivityPlayer } from "@/modules/curriculum/components/activities/ActivityPlayer";
import { ACTIVITY_TYPES, type ActivityType, type ActivityContent } from "@/modules/curriculum/lib/h5p-types";
import { exportActivityAsH5P } from "@/modules/curriculum/lib/export-h5p";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { ActivityList } from "@/modules/curriculum/components/ActivityList";
import { BrainstormChat, type LessonField } from "@/modules/curriculum/components/BrainstormChat";
import { useToast } from "@/modules/curriculum/config/toast";
import { LessonStandardsPicker } from "@/modules/curriculum/components/LessonStandardsPicker";
import { exportLessonToDocx } from "@/modules/curriculum/lib/export-lesson-docx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useGoogleConnection } from "@/modules/curriculum/config/google-connection";

import { RegenerateLessonDialog } from "@/modules/curriculum/components/RegenerateLessonDialog";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { CurriculumReadingViewer } from "@/modules/curriculum/components/CurriculumReadingViewer";
import { UdlPrincipleSection, UdlField, UdlChips } from "@/modules/curriculum/components/UdlSupportsFields";
import { UdlTemplatePicker } from "@/modules/curriculum/components/UdlTemplatePicker";
import type { Json } from "@/modules/curriculum/config/database-types";
import AssignmentsSection from "@/modules/curriculum/components/lesson/AssignmentsSection";
import GoogleImportDialog from "@/modules/curriculum/components/GoogleImportDialog";

interface Activity {
  name: string;
  duration: number;
  description: string;
  type?: string;
  rationale?: string;
}

interface VocabularyItem {
  term: string;
  definition: string;
}

interface ResourceItem {
  title: string;
  url: string;
  type: "video" | "article" | "activity" | "other";
}

interface EmbeddedActivityRef {
  activity_id: string;
  title: string;
  activity_type: string;
}

interface VocabularyScaffold {
  term: string;
  student_friendly: string;
  visual_cue: string;
}

interface UdlSupports {
  /**
   * Unified, sequential lesson outline (rich-text HTML). Replaces the formerly
   * separate Activities/Assessment/Differentiation/UDL-principle sections.
   * Written so a substitute teacher can pick it up: each phase explains
   * What happens, How it serves UDL (Engagement / Representation / Action & Expression),
   * Why pedagogically, and the Formative Check.
   */
  lesson_flow?: string;
  /** Kept: a structured vocabulary support list (still useful as reference data). */
  vocabulary_scaffolds?: VocabularyScaffold[];
  /** Kept: closing metacognitive prompt. */
  reflection_prompt?: string;

  // ─── Legacy granular fields (read for back-compat, not edited via UI anymore) ─
  engagement?: {
    hook?: string;
    student_choice?: string[];
    collaboration?: string;
    sustain_effort?: string;
    self_regulation_prompt?: string;
  };
  representation?: {
    visual?: string;
    auditory?: string;
    text_supports?: string;
    vocabulary_scaffolds?: VocabularyScaffold[];
    big_idea_highlight?: string;
    background_activation?: string;
  };
  action_expression?: {
    response_modes?: string[];
    physical_action_options?: string;
    planning_scaffold?: string;
    progress_checkpoint?: string;
    flexible_assessment?: string;
  };
}

interface LessonPlan {
  id: string;
  unit_id: string | null;
  title: string;
  lesson_date: string | null;
  duration_minutes: number;
  objectives: string;
  activities: Activity[];
  materials: string;
  assessment: string;
  differentiation: string;
  notes: string;
  vocabulary: VocabularyItem[];
  resources: ResourceItem[];
  embedded_activities: EmbeddedActivityRef[];
  udl_supports: UdlSupports;
}

interface Standard {
  id: string;
  ngss_code: string;
  ngss_description: string;
}

const RESOURCE_TYPE_ICONS = {
  video: Video,
  article: FileText,
  activity: Gamepad2,
  other: Link2,
};

const LessonPlanEditor = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lesson, setLesson] = useState<LessonPlan | null>(null);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [standardsOpen, setStandardsOpen] = useState(false);
  const [aiTagging, setAiTagging] = useState(false);
  
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [embedPickerOpen, setEmbedPickerOpen] = useState(false);
  const [previewingActivity, setPreviewingActivity] = useState<{ type: ActivityType; content: ActivityContent } | null>(null);
  const [udlTemplateOpen, setUdlTemplateOpen] = useState(false);
  const [googleImportOpen, setGoogleImportOpen] = useState(false);
  const [unitDiscipline, setUnitDiscipline] = useState<string | null>(null);
  const [unitGradeLevel, setUnitGradeLevel] = useState<string>("");
  const [unitTitle, setUnitTitle] = useState('');
  const { status: googleStatus } = useGoogleConnection();

  const handleExportDocx = () => {
    if (!lesson) return;
    exportLessonToDocx({
      ...lesson,
      standards: standards.map(s => ({ ngss_code: s.ngss_code, ngss_description: s.ngss_description })),
      udl_supports: lesson.udl_supports,
    });
  };

  const handleExportGoogleDoc = async () => {
    if (!lesson) return;
    if (!googleStatus?.connected) {
      toast({ title: "Connect Google first", description: "Go to Settings → Google to link your account." });
      navigate("/app/settings");
      return;
    }
    const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const standardsHtml = standards.length
      ? `<h2>Standards</h2><ul>${standards.map(s => `<li><strong>${esc(s.ngss_code)}</strong> — ${esc(s.ngss_description)}</li>`).join("")}</ul>`
      : "";
    const vocabHtml = lesson.vocabulary?.length
      ? `<h2>Vocabulary</h2><ul>${lesson.vocabulary.map(v => `<li><strong>${esc(v.term)}</strong> — ${esc(v.definition)}</li>`).join("")}</ul>`
      : "";
    const html = `
      <h1>${esc(lesson.title || "Lesson")}</h1>
      <p><strong>Duration:</strong> ${lesson.duration_minutes} min</p>
      ${standardsHtml}
      <h2>Objectives</h2><p>${esc(lesson.objectives)}</p>
      <h2>Materials</h2><p>${esc(lesson.materials)}</p>
      <h2>Lesson Outline</h2>${lesson.udl_supports?.lesson_flow || ""}
      ${vocabHtml}
      <h2>Assessment</h2><p>${esc(lesson.assessment)}</p>
      <h2>Differentiation</h2><p>${esc(lesson.differentiation)}</p>
      <h2>Notes</h2><p>${esc(lesson.notes)}</p>
    `;
    try {
      toast({ title: "Creating Google Doc…" });
      const { data, error } = await supabase.functions.invoke("google-export-doc", {
        body: { title: lesson.title || "Lesson", html },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Google Doc created" });
      window.open((data as any).url, "_blank");
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Unknown error", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!user || !id) return;
    const fetchData = async () => {
      const [lessonRes, stdsRes] = await Promise.all([
        supabase.from("lesson_plans").select("*").eq("id", id).eq("user_id", user.id).single(),
        supabase.from("lesson_plan_standards").select("*").eq("lesson_plan_id", id),
      ]);
      if (lessonRes.error || !lessonRes.data) {
        toast({ title: "Lesson not found", variant: "destructive" });
        navigate(-1);
        return;
      }
      const d = lessonRes.data as any;
      setLesson({
        ...lessonRes.data,
        activities: (Array.isArray(d.activities) ? d.activities : []) as Activity[],
        vocabulary: (Array.isArray(d.vocabulary) ? d.vocabulary : []) as VocabularyItem[],
        resources: (Array.isArray(d.resources) ? d.resources : []) as ResourceItem[],
        embedded_activities: (Array.isArray(d.embedded_activities) ? d.embedded_activities : []) as EmbeddedActivityRef[],
        udl_supports: (d.udl_supports && typeof d.udl_supports === "object" && !Array.isArray(d.udl_supports) ? d.udl_supports : {}) as UdlSupports,
      } as LessonPlan);
      setStandards(stdsRes.data || []);
      setLoading(false);

      // Fetch unit discipline for "Open Reading" link
      if (d.unit_id) {
        const { data: unitData } = await supabase
          .from("units")
          .select("discipline, title, grade_level")
          .eq("id", d.unit_id)
          .single();
        if (unitData) {
          setUnitDiscipline(unitData.discipline || null);
          setUnitTitle(unitData.title || '');
          setUnitGradeLevel(unitData.grade_level || '');
        }
      }
    };
    fetchData();
  }, [user, id]);

  const handleSave = async () => {
    if (!lesson || !user) return;
    setSaving(true);
    const updateData: Record<string, any> = {
      title: lesson.title,
      lesson_date: lesson.lesson_date || null,
      duration_minutes: lesson.duration_minutes,
      objectives: lesson.objectives,
      activities: lesson.activities,
      materials: lesson.materials,
      assessment: lesson.assessment,
      differentiation: lesson.differentiation,
      notes: lesson.notes,
      vocabulary: lesson.vocabulary,
      resources: lesson.resources,
      embedded_activities: lesson.embedded_activities,
      udl_supports: lesson.udl_supports || {},
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase.from("lesson_plans") as any).update(updateData).eq("id", lesson.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lesson saved" });
  };

  const addActivity = () => {
    if (!lesson) return;
    setLesson({ ...lesson, activities: [...lesson.activities, { name: "", duration: 10, description: "" }] });
  };

  const updateActivity = (idx: number, field: keyof Activity, value: string | number) => {
    if (!lesson) return;
    const acts = [...lesson.activities];
    acts[idx] = { ...acts[idx], [field]: value };
    setLesson({ ...lesson, activities: acts });
  };

  const removeActivity = (idx: number) => {
    if (!lesson) return;
    setLesson({ ...lesson, activities: lesson.activities.filter((_, i) => i !== idx) });
  };

  const addVocabulary = () => {
    if (!lesson) return;
    setLesson({ ...lesson, vocabulary: [...lesson.vocabulary, { term: "", definition: "" }] });
  };

  const updateVocabulary = (idx: number, field: keyof VocabularyItem, value: string) => {
    if (!lesson) return;
    const vocab = [...lesson.vocabulary];
    vocab[idx] = { ...vocab[idx], [field]: value };
    setLesson({ ...lesson, vocabulary: vocab });
  };

  const removeVocabulary = (idx: number) => {
    if (!lesson) return;
    setLesson({ ...lesson, vocabulary: lesson.vocabulary.filter((_, i) => i !== idx) });
  };

  const addResource = () => {
    if (!lesson) return;
    setLesson({ ...lesson, resources: [...lesson.resources, { title: "", url: "", type: "other" }] });
  };

  const updateResource = (idx: number, field: keyof ResourceItem, value: string) => {
    if (!lesson) return;
    const res = [...lesson.resources];
    res[idx] = { ...res[idx], [field]: value };
    setLesson({ ...lesson, resources: res });
  };

  const removeResource = (idx: number) => {
    if (!lesson) return;
    setLesson({ ...lesson, resources: lesson.resources.filter((_, i) => i !== idx) });
  };

  // ─── UDL helpers ───────────────────────────────────────────────────────
  const updateUdlField = <P extends "engagement" | "representation" | "action_expression">(
    principle: P,
    field: string,
    value: any,
  ) => {
    if (!lesson) return;
    const current = (lesson.udl_supports?.[principle] as any) || {};
    setLesson({
      ...lesson,
      udl_supports: {
        ...lesson.udl_supports,
        [principle]: { ...current, [field]: value },
      },
    });
  };

  const updateReflectionPrompt = (value: string) => {
    if (!lesson) return;
    setLesson({ ...lesson, udl_supports: { ...lesson.udl_supports, reflection_prompt: value } });
  };

  const addChip = (principle: "engagement" | "action_expression", field: "student_choice" | "response_modes", value: string) => {
    if (!value.trim()) return;
    const current = ((lesson?.udl_supports?.[principle] as any)?.[field] as string[]) || [];
    updateUdlField(principle, field, [...current, value.trim()]);
  };

  const removeChip = (principle: "engagement" | "action_expression", field: "student_choice" | "response_modes", idx: number) => {
    const current = ((lesson?.udl_supports?.[principle] as any)?.[field] as string[]) || [];
    updateUdlField(principle, field, current.filter((_, i) => i !== idx));
  };

  const getVocabScaffolds = (): VocabularyScaffold[] =>
    lesson?.udl_supports?.vocabulary_scaffolds
    || lesson?.udl_supports?.representation?.vocabulary_scaffolds
    || [];

  const setVocabScaffolds = (next: VocabularyScaffold[]) => {
    if (!lesson) return;
    setLesson({
      ...lesson,
      udl_supports: { ...lesson.udl_supports, vocabulary_scaffolds: next },
    });
  };

  const addVocabScaffold = () => setVocabScaffolds([...getVocabScaffolds(), { term: "", student_friendly: "", visual_cue: "" }]);
  const updateVocabScaffold = (idx: number, field: keyof VocabularyScaffold, value: string) =>
    setVocabScaffolds(getVocabScaffolds().map((v, i) => i === idx ? { ...v, [field]: value } : v));
  const removeVocabScaffold = (idx: number) =>
    setVocabScaffolds(getVocabScaffolds().filter((_, i) => i !== idx));


  const handleStandardsChange = async (selected: { code: string; description: string }[]) => {
    if (!id) return;
    await supabase.from("lesson_plan_standards").delete().eq("lesson_plan_id", id);
    if (selected.length > 0) {
      await supabase.from("lesson_plan_standards").insert(
        selected.map(s => ({ lesson_plan_id: id, ngss_code: s.code, ngss_description: s.description }))
      );
    }
    const { data } = await supabase.from("lesson_plan_standards").select("*").eq("lesson_plan_id", id);
    setStandards(data || []);
  };

  const handleAiTag = async () => {
    if (!lesson || !id) return;
    setAiTagging(true);
    try {
      const questionText = `${lesson.title}\n\nObjectives: ${lesson.objectives}\n\nVocabulary: ${lesson.vocabulary.map(v => v.term).join(', ')}\n\nActivities: ${lesson.activities.map(a => a.description).join('\n')}`;
      const { data, error } = await supabase.functions.invoke('standards-tagger', {
        body: {
          questions: [{ id: 1, question_text: questionText }],
          framework: 'ngss',
        },
      });
      if (error) throw error;
      const tags = data?.tags?.[0]?.standards || [];
      if (tags.length === 0) {
        toast({ title: 'No matching standards found', description: 'Try adding more detail to objectives or activities.' });
        setAiTagging(false);
        return;
      }
      const selected = tags.map((t: any) => ({ code: t.code, description: t.description }));
      await handleStandardsChange(selected);
      toast({ title: `AI tagged ${tags.length} standard${tags.length !== 1 ? 's' : ''}` });
    } catch (err: any) {
      toast({ title: 'AI tagging failed', description: err?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setAiTagging(false);
    }
  };

  const totalActivityTime = lesson?.activities.reduce((s, a) => s + (a.duration || 0), 0) || 0;

  const handleCopyToField = (field: LessonField, content: string) => {
    if (!lesson) return;
    if (field === "activities") {
      // Add as a new activity with the AI content as description
      setLesson({
        ...lesson,
        activities: [...lesson.activities, { name: "AI Suggestion", duration: 10, description: content }],
      });
    } else {
      // Append to existing text fields
      const current = lesson[field] || "";
      const separator = current.trim() ? "\n\n" : "";
      setLesson({ ...lesson, [field]: current + separator + content });
    }
  };

  if (loading || !lesson) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white glass-header">
        <div className="h-14 flex items-center px-4 gap-4">
          <AppNavSheet />
          <Breadcrumbs items={[
            { label: "Lesson Planner", path: "/app/curriculum/lesson-planner" },
            ...(lesson.unit_id ? [{ label: unitTitle || "Unit", path: `/app/curriculum/units/${lesson.unit_id}` }] : []),
            { label: lesson.title || "Untitled Lesson" },
          ]} />
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <BrainstormChat
              lessonContext={{
                title: lesson.title,
                objectives: lesson.objectives,
                standards: standards.map(s => s.ngss_code).join(", ") || "None",
                duration: lesson.duration_minutes,
              }}
              onCopyToField={handleCopyToField}
            />
            {unitDiscipline && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-xl"
                onClick={() => setReadingOpen(true)}
              >
                <BookOpenCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Open Reading</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-xl"
              onClick={() => setRegenerateOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Regenerate</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 rounded-xl">
                  <FileDown className="h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDocx}>Export as Word (.docx)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportGoogleDoc}>
                  Export to Google Doc{googleStatus?.connected ? "" : " (connect Google)"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGoogleImportOpen(true)}>
                  Import from Google Doc…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <div className="sm:hidden mobile-action-scroll overflow-x-auto scrollbar-hide px-4 pb-2">
          <div className="flex w-max items-center gap-2 [&>*]:shrink-0">
            <BrainstormChat
              lessonContext={{
                title: lesson.title,
                objectives: lesson.objectives,
                standards: standards.map(s => s.ngss_code).join(", ") || "None",
                duration: lesson.duration_minutes,
              }}
              onCopyToField={handleCopyToField}
            />
            {unitDiscipline && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-xl"
                onClick={() => setReadingOpen(true)}
              >
                <BookOpenCheck className="h-4 w-4" />
                Open Reading
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-xl"
              onClick={() => setRegenerateOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 rounded-xl">
                  <FileDown className="h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDocx}>Export as Word (.docx)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportGoogleDoc}>
                  Export to Google Doc{googleStatus?.connected ? "" : " (connect Google)"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGoogleImportOpen(true)}>
                  Import from Google Doc…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full space-y-4 bg-page-green">
        {/* Title */}
        <Input
          value={lesson.title}
          onChange={e => setLesson({ ...lesson, title: e.target.value })}
          className="text-lg font-semibold h-10 border-none bg-transparent px-0 focus-visible:ring-0"
          placeholder="Lesson title..."
        />
        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input type="date" value={lesson.lesson_date || ""} onChange={e => setLesson({ ...lesson, lesson_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Duration (minutes)</Label>
            <Input type="number" value={lesson.duration_minutes} onChange={e => setLesson({ ...lesson, duration_minutes: parseInt(e.target.value) || 50 })} />
          </div>
        </div>

        {/* Standards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> NGSS Standards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {standards.length === 0 ? (
                <p className="text-xs text-muted-foreground">No standards tagged yet</p>
              ) : standards.map(s => (
                <Badge key={s.id} variant="secondary" className="text-xs">{s.ngss_code}</Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setStandardsOpen(true)}>
                Edit Standards
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" onClick={handleAiTag} disabled={aiTagging}>
                {aiTagging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiTagging ? 'Tagging…' : 'AI Tag'}
              </Button>
            </div>
            <LessonStandardsPicker
              open={standardsOpen}
              onOpenChange={setStandardsOpen}
              selected={standards.map(s => ({ code: s.ngss_code, description: s.ngss_description }))}
              onSave={handleStandardsChange}
            />
          </CardContent>
        </Card>

        {/* Objectives */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Learning Objectives</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              content={lesson.objectives}
              onChange={v => setLesson({ ...lesson, objectives: v })}
              placeholder="Students will be able to..."
              compact
            />
          </CardContent>
        </Card>

        {/* Key Vocabulary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Key Vocabulary</CardTitle>
              <span className="text-xs text-muted-foreground">{lesson.vocabulary.length} terms</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {lesson.vocabulary.map((v, idx) => (
              <div key={idx} className="flex gap-2 items-start p-2.5 rounded-xl bg-[#f8bf5d]">
                <div className="flex-1 space-y-1.5">
                  <Input placeholder="Term" value={v.term} onChange={e => updateVocabulary(idx, "term", e.target.value)} className="text-sm h-8 font-medium" />
                  <RichTextEditor content={v.definition} onChange={val => updateVocabulary(idx, "definition", val)} placeholder="Definition..." minimal />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeVocabulary(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5" onClick={addVocabulary}>
              <Plus className="h-3.5 w-3.5" /> Add Term
            </Button>
          </CardContent>
        </Card>

        {/* Lesson Flow (UDL-Aligned) — single coherent sub-friendly outline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Lesson Flow (UDL-Aligned)
                  <Badge variant="secondary" className="text-[10px] ml-1">CAST v2.2</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  One sequential outline a substitute could pick up and teach. For each phase, capture <strong>What</strong> (activity + minutes), <strong>How</strong> (UDL Engagement / Representation / Action & Expression moves), <strong>Why</strong> (the reason it matters), and a <strong>Formative Check</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setUdlTemplateOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Templates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setRegenerateOpen(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              content={lesson.udl_supports?.lesson_flow || ""}
              onChange={(v) => setLesson({ ...lesson, udl_supports: { ...lesson.udl_supports, lesson_flow: v } })}
              placeholder={`Example structure:

Opening / Hook (5 min)
• What: ...
• How (UDL): Engagement — ... · Representation — ... · Action & Expression — ...
• Why: ...
• Formative Check: ...

Core Learning (15 min)
• What: ...
• How (UDL): ...
• Why: ...
• Formative Check: ...

Practice & Application (15 min)
• ...

Closing & Reflection (10 min)
• ...`}
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Tip: target <span className="font-medium text-foreground">{lesson.duration_minutes} min</span> total. Use bold phase headers and bullet sub-lines so a sub can scan it during class.
            </p>
          </CardContent>
        </Card>

        {/* Resources & Links */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Resources & Links</CardTitle>
              <span className="text-xs text-muted-foreground">{lesson.resources.length} links</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {lesson.resources.map((res, idx) => {
              const Icon = RESOURCE_TYPE_ICONS[res.type] || Link2;
              return (
                <div key={idx} className="flex gap-2 items-start p-2.5 rounded-xl bg-accent/50">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex gap-2">
                      <Input placeholder="Resource title" value={res.title} onChange={e => updateResource(idx, "title", e.target.value)} className="text-sm h-8" />
                      <Select value={res.type} onValueChange={v => updateResource(idx, "type", v)}>
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video"><span className="flex items-center gap-1.5"><Video className="h-3 w-3" /> Video</span></SelectItem>
                          <SelectItem value="article"><span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> Article</span></SelectItem>
                          <SelectItem value="activity"><span className="flex items-center gap-1.5"><Gamepad2 className="h-3 w-3" /> Activity</span></SelectItem>
                          <SelectItem value="other"><span className="flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Other</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input placeholder="https://..." value={res.url} onChange={e => updateResource(idx, "url", e.target.value)} className="text-sm h-8" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeResource(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5" onClick={addResource}>
              <Plus className="h-3.5 w-3.5" /> Add Resource
            </Button>
          </CardContent>
        </Card>

        {/* Embedded H5P Activities */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Puzzle className="h-4 w-4 text-primary" /> Interactive Activities</CardTitle>
              <span className="text-xs text-muted-foreground">{lesson.embedded_activities.length} embedded</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {lesson.embedded_activities.map((ea, idx) => {
              const typeInfo = ACTIVITY_TYPES.find(t => t.type === ea.activity_type);
              return (
                <div key={ea.activity_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-accent/50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Puzzle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ea.title}</p>
                    <Badge variant="secondary" className="text-[10px]">{typeInfo?.label ?? ea.activity_type}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Preview"
                    onClick={async () => {
                      const { data } = await supabase.from("h5p_activities").select("content, activity_type").eq("id", ea.activity_id).single();
                      if (data) setPreviewingActivity({ type: (data as any).activity_type as ActivityType, content: (data as any).content as ActivityContent });
                    }}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Export as H5P"
                    onClick={async () => {
                      const { data } = await supabase.from("h5p_activities").select("content, activity_type, title").eq("id", ea.activity_id).single();
                      if (data) {
                        await exportActivityAsH5P((data as any).title, (data as any).activity_type as ActivityType, (data as any).content as ActivityContent);
                        toast({ title: "H5P file downloaded" });
                      }
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => {
                    setLesson({ ...lesson, embedded_activities: lesson.embedded_activities.filter((_, i) => i !== idx) });
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5" onClick={() => setEmbedPickerOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Embed Activity
            </Button>
          </CardContent>
        </Card>
        <EmbedActivityPicker
          open={embedPickerOpen}
          onOpenChange={setEmbedPickerOpen}
          excludeIds={lesson.embedded_activities.map(e => e.activity_id)}
          onSelect={(a) => {
            setLesson({
              ...lesson,
              embedded_activities: [...lesson.embedded_activities, { activity_id: a.id, title: a.title, activity_type: a.activity_type }],
            });
          }}
        />
        {previewingActivity && (
          <Dialog open={!!previewingActivity} onOpenChange={() => setPreviewingActivity(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Activity Preview</DialogTitle>
              </DialogHeader>
              <ActivityPlayer type={previewingActivity.type} content={previewingActivity.content} />
            </DialogContent>
          </Dialog>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Materials & Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextEditor content={lesson.materials} onChange={v => setLesson({ ...lesson, materials: v })} placeholder="List materials, links, handouts..." compact />
          </CardContent>
        </Card>

        {/* Vocabulary Scaffolds + Closing Reflection (UDL reference details) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> UDL Reference Details
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Optional supports the lesson flow can reference: kid-friendly term scaffolds and a closing metacognitive prompt.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vocabulary Scaffolds */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground/80">Vocabulary Scaffolds</Label>
              {(lesson.udl_supports?.vocabulary_scaffolds || lesson.udl_supports?.representation?.vocabulary_scaffolds || []).map((vs, idx) => (
                <div key={idx} className="flex gap-2 items-start p-2.5 rounded-xl bg-accent/40">
                  <div className="flex-1 space-y-1.5">
                    <Input placeholder="Term" value={vs.term}
                      onChange={e => updateVocabScaffold(idx, "term", e.target.value)}
                      className="text-sm h-8 font-medium" />
                    <Input placeholder="Kid-friendly rephrase..." value={vs.student_friendly}
                      onChange={e => updateVocabScaffold(idx, "student_friendly", e.target.value)}
                      className="text-sm h-8" />
                    <Input placeholder="Visual cue / gesture / analogy..." value={vs.visual_cue}
                      onChange={e => updateVocabScaffold(idx, "visual_cue", e.target.value)}
                      className="text-sm h-8" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeVocabScaffold(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5" onClick={addVocabScaffold}>
                <Plus className="h-3.5 w-3.5" /> Add Scaffold
              </Button>
            </div>

            {/* Closing Reflection */}
            <div className="rounded-xl border border-border bg-accent/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Closing Reflection Prompt</span>
              </div>
              <Textarea
                value={lesson.udl_supports?.reflection_prompt || ""}
                onChange={e => updateReflectionPrompt(e.target.value)}
                placeholder="A single classroom-ready metacognitive question students answer at lesson close..."
                rows={2}
                className="text-sm bg-background"
              />
            </div>
          </CardContent>
        </Card>

        <AssignmentsSection
          lessonPlanId={lesson.id}
          escapeRoomContext={{
            title: lesson.title,
            topic: lesson.title,
            objectives: lesson.objectives as any,
            vocabulary: lesson.vocabulary.map(v => v.term).join(", "),
          }}
        />


        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><StickyNote className="h-4 w-4 text-primary" /> Teacher Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextEditor content={lesson.notes} onChange={v => setLesson({ ...lesson, notes: v })} placeholder="Additional notes, reminders..." compact />
          </CardContent>
        </Card>

        <div className="h-8" />
      </main>




      {lesson && (
        <RegenerateLessonDialog
          open={regenerateOpen}
          onOpenChange={setRegenerateOpen}
          lesson={lesson}
          discipline={unitDiscipline || "Science"}
          gradeLevel={unitGradeLevel || "Middle School"}
          unitTitle={unitTitle || lesson.title}
          standards={standards}
          onRegenerated={() => {
            // Re-fetch lesson data
            window.location.reload();
          }}
        />
      )}

      {readingOpen && unitDiscipline && (
        <CurriculumReadingViewer
          discipline={unitDiscipline}
          title={`${unitTitle} Readings`}
          onClose={() => setReadingOpen(false)}
        />
      )}

      <UdlTemplatePicker
        open={udlTemplateOpen}
        onOpenChange={setUdlTemplateOpen}
        current={lesson.udl_supports}
        topic={lesson.title}
        onApply={(next) => {
          setLesson({ ...lesson, udl_supports: next });
          toast({ title: "UDL template applied", description: "Edit the placeholders to fit your lesson." });
        }}
      />

      <GoogleImportDialog
        open={googleImportOpen}
        onOpenChange={setGoogleImportOpen}
        title="Import a Google Doc into this lesson"
        description="Paste a Google Doc link. Its content will be inserted into the Lesson Outline using your connected Google account."
        onImported={({ title: importedTitle, html }) => {
          if (!lesson) return;
          const existing = lesson.udl_supports?.lesson_flow || "";
          const heading = `<h2>Imported from "${importedTitle}"</h2>`;
          const merged = existing ? `${existing}\n${heading}\n${html}` : `${heading}\n${html}`;
          setLesson({ ...lesson, udl_supports: { ...lesson.udl_supports, lesson_flow: merged } });
          toast({ title: "Imported into Lesson Outline", description: "Save the lesson to keep your changes." });
        }}
      />
    </div>
  );
};

export default LessonPlanEditor;
