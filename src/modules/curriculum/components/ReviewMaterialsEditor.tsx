import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import {
  Loader2, Save, Plus, Trash2, BookOpen, Layers, GraduationCap,
  ChevronUp, ChevronDown,
} from "lucide-react";

interface StudySection {
  title: string;
  content: string;
  key_points: string[];
}

interface Flashcard {
  term: string;
  definition: string;
  example?: string;
}

interface ReviewLesson {
  title: string;
  objectives: string[];
  introduction: string;
  sections: { title: string; content: string }[];
  summary: string;
  practice_questions: { question: string; answer: string }[];
}

interface Props {
  examId: string;
  examTitle: string;
}

export function ReviewMaterialsEditor({ examId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [studyGuide, setStudyGuide] = useState<StudySection[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [reviewLesson, setReviewLesson] = useState<ReviewLesson>({
    title: "",
    objectives: [],
    introduction: "",
    sections: [],
    summary: "",
    practice_questions: [],
  });
  const [tab, setTab] = useState("study-guide");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("exam_review_materials")
        .select("*")
        .eq("exam_id", examId)
        .maybeSingle() as any;
      if (data) {
        setReviewId(data.id);
        setStudyGuide(data.study_guide || []);
        setFlashcards(data.flashcards || []);
        setReviewLesson(data.review_lesson || { title: "", objectives: [], introduction: "", sections: [], summary: "", practice_questions: [] });
      }
      setLoading(false);
    })();
  }, [examId]);

  const markDirty = useCallback(() => setDirty(true), []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        exam_id: examId,
        user_id: user.id,
        study_guide: studyGuide as any,
        flashcards: flashcards as any,
        review_lesson: reviewLesson as any,
        updated_at: new Date().toISOString(),
      };

      if (reviewId) {
        const { error } = await supabase
          .from("exam_review_materials")
          .update(payload)
          .eq("id", reviewId) as any;
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("exam_review_materials")
          .insert(payload)
          .select("id")
          .single() as any;
        if (error) throw error;
        setReviewId(data.id);
      }
      setDirty(false);
      toast.success("Review materials saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Study guide helpers
  const updateSection = (i: number, updates: Partial<StudySection>) => {
    setStudyGuide(prev => prev.map((s, idx) => idx === i ? { ...s, ...updates } : s));
    markDirty();
  };
  const addSection = () => {
    setStudyGuide(prev => [...prev, { title: "", content: "", key_points: [] }]);
    markDirty();
  };
  const removeSection = (i: number) => {
    setStudyGuide(prev => prev.filter((_, idx) => idx !== i));
    markDirty();
  };
  const moveSection = (i: number, offset: -1 | 1) => {
    setStudyGuide(prev => {
      const arr = [...prev];
      const j = i + offset;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
    markDirty();
  };

  // Flashcard helpers
  const updateFlashcard = (i: number, updates: Partial<Flashcard>) => {
    setFlashcards(prev => prev.map((f, idx) => idx === i ? { ...f, ...updates } : f));
    markDirty();
  };
  const addFlashcard = () => {
    setFlashcards(prev => [...prev, { term: "", definition: "" }]);
    markDirty();
  };
  const removeFlashcard = (i: number) => {
    setFlashcards(prev => prev.filter((_, idx) => idx !== i));
    markDirty();
  };

  // Lesson helpers
  const updateLesson = (updates: Partial<ReviewLesson>) => {
    setReviewLesson(prev => ({ ...prev, ...updates }));
    markDirty();
  };
  const addLessonSection = () => {
    updateLesson({ sections: [...reviewLesson.sections, { title: "", content: "" }] });
  };
  const updateLessonSection = (i: number, updates: Partial<{ title: string; content: string }>) => {
    const sections = reviewLesson.sections.map((s, idx) => idx === i ? { ...s, ...updates } : s);
    updateLesson({ sections });
  };
  const removeLessonSection = (i: number) => {
    updateLesson({ sections: reviewLesson.sections.filter((_, idx) => idx !== i) });
  };
  const addObjective = () => {
    updateLesson({ objectives: [...reviewLesson.objectives, ""] });
  };
  const updateObjective = (i: number, val: string) => {
    const objectives = [...reviewLesson.objectives];
    objectives[i] = val;
    updateLesson({ objectives });
  };
  const removeObjective = (i: number) => {
    updateLesson({ objectives: reviewLesson.objectives.filter((_, idx) => idx !== i) });
  };
  const addPracticeQ = () => {
    updateLesson({ practice_questions: [...reviewLesson.practice_questions, { question: "", answer: "" }] });
  };
  const updatePracticeQ = (i: number, updates: Partial<{ question: string; answer: string }>) => {
    const pqs = reviewLesson.practice_questions.map((p, idx) => idx === i ? { ...p, ...updates } : p);
    updateLesson({ practice_questions: pqs });
  };
  const removePracticeQ = (i: number) => {
    updateLesson({ practice_questions: reviewLesson.practice_questions.filter((_, idx) => idx !== i) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Review Materials</h2>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved</span>}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Review
          </Button>
        </div>
      </div>

      {!reviewId && studyGuide.length === 0 && flashcards.length === 0 && !reviewLesson.title && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            <p>No review materials yet. Use "Generate Review" to auto-create them, or add sections manually below.</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="study-guide" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" /> Study Guide ({studyGuide.length})
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" /> Flashcards ({flashcards.length})
          </TabsTrigger>
          <TabsTrigger value="lesson" className="gap-1.5 text-xs">
            <GraduationCap className="h-3.5 w-3.5" /> Lesson
          </TabsTrigger>
        </TabsList>

        {/* Study Guide Editor */}
        <TabsContent value="study-guide" className="mt-4 space-y-3">
          {studyGuide.map((section, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Section {i + 1}</span>
                <div className="flex-1" />
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moveSection(i, -1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === studyGuide.length - 1} onClick={() => moveSection(i, 1)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeSection(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={section.title}
                onChange={e => updateSection(i, { title: e.target.value })}
                placeholder="Section title"
                className="text-sm"
              />
              <RichTextEditor
                content={section.content}
                onChange={html => updateSection(i, { content: html })}
                placeholder="Section content..."
                compact
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Key Points</Label>
                {section.key_points.map((pt, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Input
                      value={pt}
                      onChange={e => {
                        const kps = [...section.key_points];
                        kps[j] = e.target.value;
                        updateSection(i, { key_points: kps });
                      }}
                      placeholder={`Key point ${j + 1}`}
                      className="h-8 text-sm flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      updateSection(i, { key_points: section.key_points.filter((_, idx) => idx !== j) });
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => {
                  updateSection(i, { key_points: [...section.key_points, ""] });
                }}>
                  <Plus className="h-3 w-3" /> Add Key Point
                </Button>
              </div>
            </Card>
          ))}
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addSection}>
            <Plus className="h-4 w-4" /> Add Study Guide Section
          </Button>
        </TabsContent>

        {/* Flashcards Editor */}
        <TabsContent value="flashcards" className="mt-4 space-y-3">
          {flashcards.map((fc, i) => (
            <Card key={i} className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Card {i + 1}</span>
                <div className="flex-1" />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFlashcard(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={fc.term}
                onChange={e => updateFlashcard(i, { term: e.target.value })}
                placeholder="Term"
                className="text-sm"
              />
              <Textarea
                value={fc.definition}
                onChange={e => updateFlashcard(i, { definition: e.target.value })}
                placeholder="Definition"
                rows={2}
                className="text-sm"
              />
              <Input
                value={fc.example || ""}
                onChange={e => updateFlashcard(i, { example: e.target.value })}
                placeholder="Example (optional)"
                className="text-sm h-8"
              />
            </Card>
          ))}
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addFlashcard}>
            <Plus className="h-4 w-4" /> Add Flashcard
          </Button>
        </TabsContent>

        {/* Lesson Editor */}
        <TabsContent value="lesson" className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Lesson Title</Label>
            <Input
              value={reviewLesson.title}
              onChange={e => updateLesson({ title: e.target.value })}
              placeholder="Review lesson title"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Learning Objectives</Label>
            {reviewLesson.objectives.map((obj, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={obj}
                  onChange={e => updateObjective(i, e.target.value)}
                  placeholder={`Objective ${i + 1}`}
                  className="h-8 text-sm flex-1"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeObjective(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={addObjective}>
              <Plus className="h-3 w-3" /> Add Objective
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Introduction</Label>
            <RichTextEditor
              content={reviewLesson.introduction}
              onChange={html => updateLesson({ introduction: html })}
              placeholder="Lesson introduction..."
              compact
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Lesson Sections</Label>
            {reviewLesson.sections.map((sec, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={sec.title}
                    onChange={e => updateLessonSection(i, { title: e.target.value })}
                    placeholder="Section title"
                    className="h-8 text-sm flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLessonSection(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <RichTextEditor
                  content={sec.content}
                  onChange={html => updateLessonSection(i, { content: html })}
                  placeholder="Section content..."
                  compact
                />
              </Card>
            ))}
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={addLessonSection}>
              <Plus className="h-3 w-3" /> Add Section
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Summary</Label>
            <RichTextEditor
              content={reviewLesson.summary}
              onChange={html => updateLesson({ summary: html })}
              placeholder="Lesson summary..."
              compact
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Practice Questions</Label>
            {reviewLesson.practice_questions.map((pq, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Q{i + 1}</span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePracticeQ(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={pq.question}
                  onChange={e => updatePracticeQ(i, { question: e.target.value })}
                  placeholder="Question"
                  className="text-sm"
                />
                <Textarea
                  value={pq.answer}
                  onChange={e => updatePracticeQ(i, { answer: e.target.value })}
                  placeholder="Answer"
                  rows={2}
                  className="text-sm"
                />
              </Card>
            ))}
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={addPracticeQ}>
              <Plus className="h-3 w-3" /> Add Practice Question
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
