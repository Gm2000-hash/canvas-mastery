import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "@/modules/curriculum/config/router";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Save, Trash2, Plus, GripVertical,
  ChevronUp, ChevronDown, Sparkles, X, BookOpen,
} from "lucide-react";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { MathText } from "@/modules/curriculum/components/MathText";
import { MediaInsert } from "@/modules/curriculum/components/activities/editors/MediaInsert";
import { moveItem } from "@/modules/curriculum/components/activities/editors/ReorderControls";
import { ReviewMaterialsEditor } from "@/modules/curriculum/components/ReviewMaterialsEditor";
import type { MediaEmbed } from "@/modules/curriculum/lib/h5p-types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EnhanceQuestionDialog, type EnhanceResult } from "@/modules/curriculum/components/EnhanceQuestionDialog";

const QUESTION_TYPES = [
  { value: "multiple_choice_question", label: "Multiple Choice" },
  { value: "multiple_answers_question", label: "Select All That Apply" },
  { value: "drag_and_drop_question", label: "Drag & Drop" },
  { value: "data_analysis_question", label: "Data Analysis" },
  { value: "multi_step_question", label: "Multi-Step" },
  { value: "scenario_question", label: "Scenario-Based" },
  { value: "constructed_response_question", label: "Constructed Response" },
  { value: "investigation_design_question", label: "Investigation Design" },
  { value: "concept_map_question", label: "Concept Mapping" },
];

interface ExamQuestion {
  question_number: number;
  question_type: string;
  question_text: string;
  standard_code: string;
  standard_description?: string;
  points_possible: number;
  dok_level: number;
  blooms_level: string;
  hint?: string;
  answers: any;
  image_url?: string;
  media?: MediaEmbed;
}

export default function ISATExamEditor() {
  usePageTitle("Edit ISAT Exam");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [selectedQ, setSelectedQ] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [generatingReview, setGeneratingReview] = useState(false);
  const [editorMode, setEditorMode] = useState<"questions" | "review">("questions");
  const [enhanceTarget, setEnhanceTarget] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("isat_exams")
        .select("*")
        .eq("id", id)
        .single() as any;
      if (error || !data) {
        toast.error("Exam not found");
        navigate("/app/curriculum/question-bank");
        return;
      }
      setTitle(data.title);
      setGradeLevel(data.grade_level);
      setQuestions(data.questions || []);
      setLoading(false);
    })();
  }, [id]);

  const markDirty = useCallback(() => setDirty(true), []);

  const updateQuestion = (index: number, updates: Partial<ExamQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...updates } : q));
    markDirty();
  };

  const moveQuestion = (index: number, offset: -1 | 1) => {
    setQuestions(prev => {
      const moved = moveItem(prev, index, offset);
      // Re-number questions
      return moved.map((q, i) => ({ ...q, question_number: i + 1 }));
    });
    setSelectedQ(prev => {
      const next = prev + offset;
      return Math.max(0, Math.min(questions.length - 1, next));
    });
    markDirty();
  };

  const deleteQuestion = (index: number) => {
    setQuestions(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((q, i) => ({ ...q, question_number: i + 1 }));
    });
    setSelectedQ(prev => Math.min(prev, questions.length - 2));
    setDeleteTarget(null);
    markDirty();
  };

  const addQuestion = () => {
    const newQ: ExamQuestion = {
      question_number: questions.length + 1,
      question_type: "multiple_choice_question",
      question_text: "",
      standard_code: "",
      points_possible: 1,
      dok_level: 1,
      blooms_level: "Remember",
      hint: "",
      answers: [
        { text: "", weight: 100 },
        { text: "", weight: 0 },
        { text: "", weight: 0 },
        { text: "", weight: 0 },
      ],
    };
    setQuestions(prev => [...prev, newQ]);
    setSelectedQ(questions.length);
    markDirty();
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const totalPoints = questions.reduce((sum, q) => sum + (q.points_possible || 1), 0);
      const { error } = await supabase
        .from("isat_exams")
        .update({
          title,
          grade_level: gradeLevel,
          questions: questions as any,
          question_count: questions.length,
          total_points: totalPoints,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id) as any;
      if (error) throw error;
      setDirty(false);
      toast.success("Exam saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const q = questions[selectedQ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-background glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[
          { label: "Question Bank", path: "/app/curriculum/question-bank" },
          { label: title, path: `/app/curriculum/isat-exams/${id}` },
          { label: "Edit" },
        ]} />
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              onClick={() => setEditorMode("questions")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${editorMode === "questions" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Questions
            </button>
            <button
              onClick={() => setEditorMode("review")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${editorMode === "review" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Review Materials
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={generatingReview}
            onClick={async () => {
              if (!id) return;
              setGeneratingReview(true);
              try {
                const { data, error } = await supabase.functions.invoke("generate-exam-review", {
                  body: { exam_id: id },
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                toast.success("Review materials generated!");
                setEditorMode("review");
              } catch (e: any) {
                toast.error(e.message || "Failed to generate review");
              } finally {
                setGeneratingReview(false);
              }
            }}
            className="gap-1.5"
          >
            {generatingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            {generatingReview ? "Generating..." : "Generate Review"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/app/curriculum/isat-exams/${id}`)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </header>

      {editorMode === "questions" ? (
        <div className="flex h-[calc(100vh-3.5rem)]">
          {/* Left sidebar: question list */}
          <div className="w-72 border-r border-border bg-muted/30 flex flex-col">
            <div className="p-3 border-b border-border space-y-2">
              <Input
                value={title}
                onChange={e => { setTitle(e.target.value); markDirty(); }}
                placeholder="Exam title"
                className="text-sm font-medium"
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {questions.map((question, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedQ(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors
                      ${i === selectedQ ? "bg-primary/10 border border-primary/30 font-medium" : "hover:bg-accent"}
                    `}
                  >
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                    <span className="truncate flex-1">
                      <MathText text={(question.question_text?.replace(/<[^>]*>/g, '') || "New question").slice(0, 50)} className="truncate" inline />
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
            <div className="p-2 border-t border-border">
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addQuestion}>
                <Plus className="h-4 w-4" /> Add Question
              </Button>
            </div>
          </div>

          {/* Right: question editor */}
          <div className="flex-1 overflow-y-auto">
            {q ? (
              <div className="max-w-3xl mx-auto py-6 px-6 space-y-6">
                {/* Reorder & delete controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Question {selectedQ + 1} of {questions.length}</span>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      disabled={selectedQ === 0}
                      onClick={() => moveQuestion(selectedQ, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      disabled={selectedQ === questions.length - 1}
                      onClick={() => moveQuestion(selectedQ, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive gap-1.5"
                    onClick={() => setDeleteTarget(selectedQ)}
                    disabled={questions.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>

                {/* Question type & metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Question Type</Label>
                    <Select
                      value={q.question_type}
                      onValueChange={v => updateQuestion(selectedQ, { question_type: v })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Points</Label>
                    <Input
                      type="number" min={1}
                      value={q.points_possible}
                      onChange={e => updateQuestion(selectedQ, { points_possible: Number(e.target.value) || 1 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">DOK Level</Label>
                    <Select
                      value={String(q.dok_level)}
                      onValueChange={v => updateQuestion(selectedQ, { dok_level: Number(v) })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map(n => (
                          <SelectItem key={n} value={String(n)}>DOK {n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Standard Code</Label>
                    <Input
                      value={q.standard_code || ""}
                      onChange={e => updateQuestion(selectedQ, { standard_code: e.target.value })}
                      placeholder="e.g. MS-PS1-2"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bloom's Level</Label>
                    <Select
                      value={q.blooms_level || "Remember"}
                      onValueChange={v => updateQuestion(selectedQ, { blooms_level: v })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"].map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Question text */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Question Text</Label>
                  <RichTextEditor
                    content={q.question_text}
                    onChange={html => updateQuestion(selectedQ, { question_text: html })}
                    placeholder="Enter question text..."
                    compact
                  />
                </div>

                {/* Media / Image / Manipulative */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Visual / Manipulative</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                      onClick={() => setEnhanceTarget(selectedQ)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Enhance with image / manipulative
                    </Button>
                  </div>
                  {q.image_url && !q.media && (
                    <div className="relative inline-block">
                      <img src={q.image_url} alt="Question" className="max-h-48 rounded-lg border" />
                      <Button
                        variant="destructive" size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => updateQuestion(selectedQ, { image_url: undefined })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {q.media && (
                    <div className="relative inline-block">
                      {q.media.type === "h5p" ? (
                        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2 max-w-md">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium">
                              Interactive: {q.media.activity_type === "drag_and_drop" ? "Drag-and-Drop labeling" : "Click-the-part hotspots"}
                            </span>
                          </div>
                          {q.media.url && <img src={q.media.url} alt="Manipulative" className="max-h-40 rounded border bg-white" />}
                        </div>
                      ) : q.media.type === "image" ? (
                        <img src={q.media.url} alt="Question" className="max-h-48 rounded-lg border" />
                      ) : (
                        <div className="text-xs text-muted-foreground p-2 border rounded">{q.media.type}: {q.media.url}</div>
                      )}
                      <Button
                        variant="destructive" size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => updateQuestion(selectedQ, { media: undefined })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {!q.image_url && !q.media && (
                    <p className="text-xs text-muted-foreground italic">No visual attached. Click "Enhance" to add one.</p>
                  )}
                </div>

                {/* Hint */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Hint (shown to students on request)</Label>
                  <Textarea
                    value={q.hint || ""}
                    onChange={e => updateQuestion(selectedQ, { hint: e.target.value })}
                    placeholder="Optional hint..."
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Answer editor based on type */}
                <AnswerEditor
                  question={q}
                  onChange={(answers) => updateQuestion(selectedQ, { answers })}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select a question from the sidebar or add a new one.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="max-w-4xl mx-auto py-6 px-6">
            <ReviewMaterialsEditor examId={id!} examTitle={title} />
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove Question {deleteTarget !== null ? deleteTarget + 1 : ""}? This cannot be undone until you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget !== null && deleteQuestion(deleteTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EnhanceQuestionDialog
        open={enhanceTarget !== null}
        onOpenChange={(v) => !v && setEnhanceTarget(null)}
        question={enhanceTarget !== null ? questions[enhanceTarget] : null}
        onApply={(result: EnhanceResult) => {
          if (enhanceTarget === null) return;
          updateQuestion(enhanceTarget, {
            ...(result.image_url !== undefined ? { image_url: result.image_url } : {}),
            ...(result.media !== undefined ? { media: result.media } : {}),
            ...(result.question_text ? { question_text: result.question_text } : {}),
            ...(result.answers ? { answers: result.answers } : {}),
            ...(result.dok_level ? { dok_level: result.dok_level } : {}),
          });
          setEnhanceTarget(null);
          toast.success("Question enhanced!");
        }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  Answer Editor (renders different UI per type)     */
/* ────────────────────────────────────────────────── */

function AnswerEditor({ question, onChange }: { question: ExamQuestion; onChange: (answers: any) => void }) {
  const { question_type, answers } = question;

  // MC / data analysis / scenario / investigation design → array of { text, weight }
  if (
    question_type === "multiple_choice_question" ||
    question_type === "data_analysis_question" ||
    question_type === "scenario_question" ||
    question_type === "investigation_design_question"
  ) {
    const options: { text: string; weight: number }[] = Array.isArray(answers) ? answers : [];
    const update = (i: number, field: string, value: any) => {
      const copy = options.map((o, idx) => idx === i ? { ...o, [field]: value } : o);
      onChange(copy);
    };
    const setCorrect = (i: number) => {
      onChange(options.map((o, idx) => ({ ...o, weight: idx === i ? 100 : 0 })));
    };
    const addOption = () => onChange([...options, { text: "", weight: 0 }]);
    const removeOption = (i: number) => {
      if (options.length <= 2) return;
      onChange(options.filter((_, idx) => idx !== i));
    };

    return (
      <div className="space-y-2">
        <Label className="text-xs">Answer Choices (select correct)</Label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question.question_number}`}
              checked={opt.weight === 100}
              onChange={() => setCorrect(i)}
              className="accent-primary"
            />
            <Input
              value={opt.text}
              onChange={e => update(i, "text", e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="flex-1 h-9 text-sm"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeOption(i)} disabled={options.length <= 2}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addOption} className="gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Option
        </Button>
      </div>
    );
  }

  // Multiple answers → checkboxes
  if (question_type === "multiple_answers_question") {
    const options: { text: string; weight: number }[] = Array.isArray(answers) ? answers : [];
    const update = (i: number, field: string, value: any) => {
      const copy = options.map((o, idx) => idx === i ? { ...o, [field]: value } : o);
      onChange(copy);
    };
    const toggleCorrect = (i: number) => {
      const copy = options.map((o, idx) => idx === i ? { ...o, weight: o.weight === 100 ? 0 : 100 } : o);
      onChange(copy);
    };
    const addOption = () => onChange([...options, { text: "", weight: 0 }]);
    const removeOption = (i: number) => {
      if (options.length <= 2) return;
      onChange(options.filter((_, idx) => idx !== i));
    };

    return (
      <div className="space-y-2">
        <Label className="text-xs">Answer Choices (check all correct)</Label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={opt.weight === 100}
              onChange={() => toggleCorrect(i)}
              className="accent-primary"
            />
            <Input
              value={opt.text}
              onChange={e => update(i, "text", e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="flex-1 h-9 text-sm"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeOption(i)} disabled={options.length <= 2}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addOption} className="gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Option
        </Button>
      </div>
    );
  }

  // Constructed response → prompt, rubric, sample response
  if (question_type === "constructed_response_question") {
    const data = typeof answers === "object" && answers !== null && !Array.isArray(answers) ? answers : {};
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Prompt / Instructions</Label>
          <Textarea
            value={data.prompt || ""}
            onChange={e => onChange({ ...data, prompt: e.target.value })}
            placeholder="Enter prompt for student..."
            rows={2} className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Scoring Rubric</Label>
          <Textarea
            value={data.scoring_rubric || ""}
            onChange={e => onChange({ ...data, scoring_rubric: e.target.value })}
            placeholder="Describe scoring criteria..."
            rows={2} className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sample Response</Label>
          <Textarea
            value={data.sample_response || ""}
            onChange={e => onChange({ ...data, sample_response: e.target.value })}
            placeholder="Example correct response..."
            rows={2} className="text-sm"
          />
        </div>
      </div>
    );
  }

  // Multi-step → parts array
  if (question_type === "multi_step_question") {
    const data = typeof answers === "object" && answers !== null && !Array.isArray(answers) ? answers : {};
    const parts: any[] = data.parts || [];
    const updatePart = (i: number, updates: any) => {
      const newParts = parts.map((p, idx) => idx === i ? { ...p, ...updates } : p);
      onChange({ ...data, parts: newParts });
    };
    const addPart = () => {
      onChange({ ...data, parts: [...parts, { label: `Part ${String.fromCharCode(65 + parts.length)}`, prompt: "", type: "short_answer" }] });
    };
    const removePart = (i: number) => {
      if (parts.length <= 1) return;
      onChange({ ...data, parts: parts.filter((_, idx) => idx !== i) });
    };

    return (
      <div className="space-y-3">
        <Label className="text-xs">Question Parts</Label>
        {parts.map((part, i) => (
          <Card key={i} className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={part.label || ""}
                onChange={e => updatePart(i, { label: e.target.value })}
                placeholder="Part label"
                className="h-8 text-sm w-32"
              />
              <Select value={part.type || "short_answer"} onValueChange={v => updatePart(i, { type: v })}>
                <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="select_all">Select All</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePart(i)} disabled={parts.length <= 1}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Textarea
              value={part.prompt || ""}
              onChange={e => updatePart(i, { prompt: e.target.value })}
              placeholder="Part prompt..."
              rows={2} className="text-sm"
            />
            {part.type === "multiple_choice" && (
              <MultiStepMCOptions part={part} onUpdate={(updates) => updatePart(i, updates)} />
            )}
            {part.type === "short_answer" && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Expected answer</Label>
                <Input
                  value={part.correctText || ""}
                  onChange={e => updatePart(i, { correctText: e.target.value })}
                  placeholder="Expected answer..."
                  className="h-8 text-sm"
                />
              </div>
            )}
          </Card>
        ))}
        <Button variant="outline" size="sm" onClick={addPart} className="gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Part
        </Button>
      </div>
    );
  }

  // Drag & drop / concept map → categories
  if (question_type === "drag_and_drop_question" || question_type === "concept_map_question") {
    const data = typeof answers === "object" && answers !== null && !Array.isArray(answers) ? answers : {};
    const categories: { label: string; items: string[] }[] = data.categories || [];
    const updateCat = (i: number, updates: any) => {
      const newCats = categories.map((c, idx) => idx === i ? { ...c, ...updates } : c);
      onChange({ ...data, categories: newCats });
    };
    const addCat = () => {
      onChange({ ...data, categories: [...categories, { label: "", items: [""] }] });
    };
    const removeCat = (i: number) => {
      if (categories.length <= 1) return;
      onChange({ ...data, categories: categories.filter((_, idx) => idx !== i) });
    };

    return (
      <div className="space-y-3">
        <Label className="text-xs">Categories & Items</Label>
        {categories.map((cat, i) => (
          <Card key={i} className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={cat.label}
                onChange={e => updateCat(i, { label: e.target.value })}
                placeholder="Category name"
                className="h-8 text-sm flex-1"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCat(i)} disabled={categories.length <= 1}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {cat.items.map((item, j) => (
              <div key={j} className="flex items-center gap-2 ml-4">
                <span className="text-xs text-muted-foreground">•</span>
                <Input
                  value={item}
                  onChange={e => {
                    const newItems = [...cat.items];
                    newItems[j] = e.target.value;
                    updateCat(i, { items: newItems });
                  }}
                  placeholder={`Item ${j + 1}`}
                  className="h-8 text-sm flex-1"
                />
                <Button
                  variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => {
                    if (cat.items.length <= 1) return;
                    updateCat(i, { items: cat.items.filter((_, idx) => idx !== j) });
                  }}
                  disabled={cat.items.length <= 1}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost" size="sm" className="text-xs ml-4 gap-1"
              onClick={() => updateCat(i, { items: [...cat.items, ""] })}
            >
              <Plus className="h-3 w-3" /> Add item
            </Button>
          </Card>
        ))}
        <Button variant="outline" size="sm" onClick={addCat} className="gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Category
        </Button>
      </div>
    );
  }

  // Fallback: raw JSON editing
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Answers (JSON)</Label>
      <Textarea
        value={typeof answers === "string" ? answers : JSON.stringify(answers, null, 2)}
        onChange={e => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            // Allow free typing, only parse on valid JSON
          }
        }}
        rows={8}
        className="text-xs font-mono"
      />
    </div>
  );
}

function MultiStepMCOptions({ part, onUpdate }: { part: any; onUpdate: (u: any) => void }) {
  const options: { text: string; correct?: boolean }[] = part.options || [];
  const update = (i: number, updates: any) => {
    const newOpts = options.map((o, idx) => idx === i ? { ...o, ...updates } : o);
    onUpdate({ options: newOpts });
  };
  const setCorrect = (i: number) => {
    onUpdate({ options: options.map((o, idx) => ({ ...o, correct: idx === i })) });
  };
  const addOpt = () => onUpdate({ options: [...options, { text: "", correct: false }] });
  const removeOpt = (i: number) => {
    if (options.length <= 2) return;
    onUpdate({ options: options.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-1.5 ml-2">
      <Label className="text-[10px] text-muted-foreground">Options (select correct)</Label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" checked={!!opt.correct} onChange={() => setCorrect(i)} className="accent-primary" />
          <Input
            value={opt.text}
            onChange={e => update(i, { text: e.target.value })}
            placeholder={`Option ${i + 1}`}
            className="h-7 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOpt(i)} disabled={options.length <= 2}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={addOpt}>
        <Plus className="h-3 w-3" /> Add
      </Button>
    </div>
  );
}

