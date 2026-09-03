import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { QUESTION_TYPE_CATEGORIES, createDefaultAnswers, isISATType } from "@/modules/curriculum/lib/question-types";
import { createQuestion, suggestDokAndBlooms } from "@/modules/curriculum/lib/question-bank";
import { StandardsPicker, CognitiveLevelPicker } from "@/modules/curriculum/components/QuestionTagPickers";
import { toast } from "sonner";
import { useNavigate } from "@/modules/curriculum/config/router";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateQuestionDialog({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const [questionType, setQuestionType] = useState("multiple_choice_question");
  const [questionText, setQuestionText] = useState("");
  const [points, setPoints] = useState(1);
  const [answers, setAnswers] = useState<any[]>(createDefaultAnswers("multiple_choice_question"));
  const [dokLevel, setDokLevel] = useState<number | null>(null);
  const [bloomsLevel, setBloomsLevel] = useState<string | null>(null);
  const [standards, setStandards] = useState<{ ngss_code: string; ngss_description: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const handleTypeChange = (type: string) => {
    if (isISATType(type)) {
      onOpenChange(false);
      navigate(`/app/curriculum/create-question?type=${type}`);
      return;
    }
    setQuestionType(type);
    setAnswers(createDefaultAnswers(type));
  };

  const handleSave = async () => {
    if (!questionText.trim()) {
      toast.error("Question text is required");
      return;
    }
    setSaving(true);
    try {
      const suggested = suggestDokAndBlooms(questionType, questionText);
      await createQuestion({
        question_text: questionText,
        question_type: questionType,
        points_possible: points,
        answers,
        dok_level: dokLevel ?? suggested.dok,
        blooms_level: bloomsLevel ?? suggested.blooms,
        source_course: "Manual",
        source_quiz: null,
        standards,
      });
      toast.success("Question created!");
      onCreated();
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to create question");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setQuestionType("multiple_choice_question");
    setQuestionText("");
    setPoints(1);
    setAnswers(createDefaultAnswers("multiple_choice_question"));
    setDokLevel(null);
    setBloomsLevel(null);
    setStandards([]);
  };

  const updateAnswer = (index: number, field: string, value: any) => {
    setAnswers(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const addAnswer = () => {
    setAnswers(prev => [...prev, { id: Date.now(), text: "", weight: 0, left: "", right: "" }]);
  };

  const removeAnswer = (index: number) => {
    if (answers.length <= 2) return;
    setAnswers(prev => prev.filter((_, i) => i !== index));
  };

  const setCorrectAnswer = (index: number) => {
    setAnswers(prev => prev.map((a, i) => ({ ...a, weight: i === index ? 100 : 0 })));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Question</DialogTitle>
          <DialogDescription>Add a question to your bank. For ISAT-style questions, you'll be redirected to the full editor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Question Type */}
          <div className="space-y-2">
            <Label>Question Type</Label>
            <Select value={questionType} onValueChange={handleTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">Traditional</div>
                {QUESTION_TYPE_CATEGORIES.traditional.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase mt-1">ISAT-Style</div>
                {QUESTION_TYPE_CATEGORIES.isat.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <Label>Question Text</Label>
            <Textarea
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="Enter your question..."
              rows={3}
            />
          </div>

          {/* Points */}
          <div className="space-y-2">
            <Label>Points</Label>
            <Input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))} className="w-24" />
          </div>

          {/* Answer Editor based on type */}
          {questionType === "multiple_choice_question" && (
            <div className="space-y-2">
              <Label>Answer Choices</Label>
              <p className="text-xs text-muted-foreground">Select the correct answer</p>
              <RadioGroup value={String(answers.findIndex(a => a.weight === 100))} onValueChange={v => setCorrectAnswer(Number(v))}>
                {answers.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <RadioGroupItem value={String(i)} id={`mc-${i}`} />
                    <Input value={a.text} onChange={e => updateAnswer(i, "text", e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAnswer(i)} disabled={answers.length <= 2}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </RadioGroup>
              <Button variant="outline" size="sm" onClick={addAnswer} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Option
              </Button>
            </div>
          )}

          {questionType === "true_false_question" && (
            <div className="space-y-2">
              <Label>Correct Answer</Label>
              <RadioGroup value={String(answers.findIndex(a => a.weight === 100))} onValueChange={v => setCorrectAnswer(Number(v))}>
                {answers.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <RadioGroupItem value={String(i)} id={`tf-${i}`} />
                    <Label htmlFor={`tf-${i}`}>{a.text}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {questionType === "multiple_answers_question" && (
            <div className="space-y-2">
              <Label>Answer Choices</Label>
              <p className="text-xs text-muted-foreground">Check all correct answers</p>
              {answers.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2">
                  <Checkbox checked={a.weight === 100} onCheckedChange={checked => updateAnswer(i, "weight", checked ? 100 : 0)} />
                  <Input value={a.text} onChange={e => updateAnswer(i, "text", e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAnswer(i)} disabled={answers.length <= 2}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addAnswer} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Option
              </Button>
            </div>
          )}

          {questionType === "matching_question" && (
            <div className="space-y-2">
              <Label>Matching Pairs</Label>
              {answers.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2">
                  <Input value={a.left || ""} onChange={e => updateAnswer(i, "left", e.target.value)} placeholder={`Term ${i + 1}`} className="flex-1" />
                  <span className="text-muted-foreground">→</span>
                  <Input value={a.right || ""} onChange={e => updateAnswer(i, "right", e.target.value)} placeholder={`Definition ${i + 1}`} className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAnswer(i)} disabled={answers.length <= 2}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addAnswer} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Pair
              </Button>
            </div>
          )}

          {(questionType === "short_answer_question" || questionType === "fill_in_multiple_blanks_question") && (
            <div className="space-y-2">
              <Label>Accepted Answer(s)</Label>
              <p className="text-xs text-muted-foreground">Enter acceptable answers (one per row)</p>
              {answers.map((a, i) => (
                <div key={a.id || i} className="flex items-center gap-2">
                  <Input value={a.text} onChange={e => updateAnswer(i, "text", e.target.value)} placeholder={`Answer ${i + 1}`} className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAnswer(i)} disabled={answers.length <= 1}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setAnswers(prev => [...prev, { id: Date.now(), text: "", weight: 100 }])} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Answer
              </Button>
            </div>
          )}

          {questionType === "essay_question" && (
            <p className="text-sm text-muted-foreground italic">Essay questions are open-ended and have no predefined answers.</p>
          )}

          {/* Cognitive Levels */}
          <CognitiveLevelPicker
            dokLevel={dokLevel}
            bloomsLevel={bloomsLevel}
            onDokChange={setDokLevel}
            onBloomsChange={setBloomsLevel}
          />

          {/* NGSS Standards */}
          <StandardsPicker standards={standards} onChange={setStandards} questionText={questionText} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save to Bank
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
