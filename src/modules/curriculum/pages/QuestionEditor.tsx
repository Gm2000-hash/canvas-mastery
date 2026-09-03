import React, { useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "@/modules/curriculum/config/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, Loader2, GripVertical, Highlighter, MousePointerClick, Lightbulb, ChevronRight } from "lucide-react";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";

import { QUESTION_TYPE_CATEGORIES, ALL_QUESTION_TYPES, createDefaultAnswers, isISATType, getQuestionTypeLabel } from "@/modules/curriculum/lib/question-types";
import { createQuestion, suggestDokAndBlooms } from "@/modules/curriculum/lib/question-bank";
import { StandardsPicker, CognitiveLevelPicker } from "@/modules/curriculum/components/QuestionTagPickers";
import { toast } from "sonner";
import DokBloomsSuggestionsDialog from "@/modules/curriculum/components/DokBloomsSuggestionsDialog";

export default function QuestionEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") || "multi_step_question";

  const [questionType, setQuestionType] = useState(initialType);
  const [questionText, setQuestionText] = useState("");
  const [points, setPoints] = useState(1);
  const [answers, setAnswers] = useState<any>(createDefaultAnswers(initialType));
  const [dokLevel, setDokLevel] = useState<number | null>(null);
  const [bloomsLevel, setBloomsLevel] = useState<string | null>(null);
  const [standards, setStandards] = useState<{ ngss_code: string; ngss_description: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleTypeChange = (type: string) => {
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
      navigate("/app/curriculum/question-bank");
    } catch (e: any) {
      toast.error(e.message || "Failed to create question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-card/80 glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Question Bank", path: "/app/curriculum/question-bank" }, { label: "Create Question" }]} />
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={saving} className="rounded-xl font-medium">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save to Bank
          </Button>
        </div>
      </header>


      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor Panel */}
          <div className="space-y-5">
            <Card>
              <CardContent className="p-5 space-y-4">
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

                <div className="space-y-2">
                  <Label>Question Stem / Prompt</Label>
                  <Textarea value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="Enter the main question or scenario..." rows={4} />
                </div>

                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))} className="w-24" />
                </div>
              </CardContent>
            </Card>

            {/* Type-specific editor */}
            {questionType === "multi_step_question" && (
              <MultiStepEditor answers={answers} onChange={setAnswers} />
            )}
            {questionType === "drag_and_drop_question" && (
              <DragDropEditor answers={answers} onChange={setAnswers} />
            )}
            {questionType === "text_highlight_question" && (
              <TextHighlightEditor answers={answers} onChange={setAnswers} />
            )}
            {!isISATType(questionType) && (
              <TraditionalAnswerEditor type={questionType} answers={answers} onChange={setAnswers} />
            )}

            {/* Tagging */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Cognitive Levels</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() => setShowSuggestions(true)}
                    disabled={!questionText.trim()}
                  >
                    <Lightbulb className="h-3 w-3 text-warning" />
                    AI Suggestions
                  </Button>
                </div>
                <CognitiveLevelPicker
                  dokLevel={dokLevel}
                  bloomsLevel={bloomsLevel}
                  onDokChange={setDokLevel}
                  onBloomsChange={setBloomsLevel}
                />
                <StandardsPicker standards={standards} onChange={setStandards} questionText={questionText} />
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</h3>
            <Card className="border-2 border-dashed">
              <CardContent className="p-5">
                <QuestionPreview type={questionType} text={questionText} answers={answers} points={points} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <DokBloomsSuggestionsDialog
        open={showSuggestions}
        onOpenChange={setShowSuggestions}
        questionText={questionText}
        questionType={questionType}
        currentDok={dokLevel}
        currentBlooms={bloomsLevel}
        answers={answers}
        onApplySuggestion={(text, dok, blooms, newAnswers) => {
          setQuestionText(text);
          setDokLevel(dok);
          setBloomsLevel(blooms);
          if (newAnswers) setAnswers(newAnswers);
        }}
      />
    </div>
  );
}

// ─── Multi-Step Editor ───

function MultiStepEditor({ answers, onChange }: { answers: any; onChange: (a: any) => void }) {
  const parts = answers?.parts || [];

  const updatePart = (index: number, field: string, value: any) => {
    const newParts = parts.map((p: any, i: number) => i === index ? { ...p, [field]: value } : p);
    onChange({ ...answers, parts: newParts });
  };

  const updatePartOption = (partIndex: number, optIndex: number, field: string, value: any) => {
    const newParts = parts.map((p: any, pi: number) => {
      if (pi !== partIndex) return p;
      const newOptions = (p.options || []).map((o: any, oi: number) => oi === optIndex ? { ...o, [field]: value } : o);
      return { ...p, options: newOptions };
    });
    onChange({ ...answers, parts: newParts });
  };

  const addPart = () => {
    const label = `Part ${String.fromCharCode(65 + parts.length)}`;
    onChange({ ...answers, parts: [...parts, { label, prompt: "", type: "multiple_choice", options: [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }, { text: "", correct: false }] }] });
  };

  const removePart = (index: number) => {
    if (parts.length <= 1) return;
    onChange({ ...answers, parts: parts.filter((_: any, i: number) => i !== index) });
  };

  const addOption = (partIndex: number) => {
    const newParts = parts.map((p: any, i: number) => {
      if (i !== partIndex) return p;
      return { ...p, options: [...(p.options || []), { text: "", correct: false }] };
    });
    onChange({ ...answers, parts: newParts });
  };

  const removeOption = (partIndex: number, optIndex: number) => {
    const newParts = parts.map((p: any, i: number) => {
      if (i !== partIndex) return p;
      if ((p.options || []).length <= 2) return p;
      return { ...p, options: p.options.filter((_: any, oi: number) => oi !== optIndex) };
    });
    onChange({ ...answers, parts: newParts });
  };

  return (
    <div className="space-y-4">
      {parts.map((part: any, pi: number) => (
        <Card key={pi}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-sm">{part.label}</Badge>
              <div className="flex items-center gap-2">
                <Select value={part.type} onValueChange={v => updatePart(pi, "type", v)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="select_all">Select All</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePart(pi)} disabled={parts.length <= 1}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Textarea
              value={part.prompt}
              onChange={e => updatePart(pi, "prompt", e.target.value)}
              placeholder={`${part.label} prompt...`}
              rows={2}
            />

            {(part.type === "multiple_choice" || part.type === "select_all") && (
              <div className="space-y-2 pl-2">
                {(part.options || []).map((opt: any, oi: number) => (
                  <div key={oi} className="flex items-center gap-2">
                    {part.type === "multiple_choice" ? (
                      <input
                        type="radio"
                        name={`part-${pi}`}
                        checked={opt.correct}
                        onChange={() => {
                          const newOpts = part.options.map((o: any, i: number) => ({ ...o, correct: i === oi }));
                          updatePart(pi, "options", newOpts);
                        }}
                        className="accent-primary"
                      />
                    ) : (
                      <Checkbox
                        checked={opt.correct}
                        onCheckedChange={checked => updatePartOption(pi, oi, "correct", !!checked)}
                      />
                    )}
                    <Input
                      value={opt.text}
                      onChange={e => updatePartOption(pi, oi, "text", e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOption(pi, oi)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addOption(pi)} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add Option
                </Button>
              </div>
            )}

            {part.type === "short_answer" && (
              <Input
                value={part.correctText || ""}
                onChange={e => updatePart(pi, "correctText", e.target.value)}
                placeholder="Expected answer..."
                className="h-8 text-sm"
              />
            )}
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={addPart} className="gap-1.5 w-full">
        <Plus className="h-4 w-4" /> Add Part
      </Button>
    </div>
  );
}

// ─── Drag & Drop Editor ───

function DragDropEditor({ answers, onChange }: { answers: any; onChange: (a: any) => void }) {
  const categories = answers?.categories || [];

  const updateCategory = (index: number, field: string, value: any) => {
    const newCats = categories.map((c: any, i: number) => i === index ? { ...c, [field]: value } : c);
    onChange({ ...answers, categories: newCats });
  };

  const updateItem = (catIndex: number, itemIndex: number, value: string) => {
    const newCats = categories.map((c: any, ci: number) => {
      if (ci !== catIndex) return c;
      const newItems = c.items.map((item: string, ii: number) => ii === itemIndex ? value : item);
      return { ...c, items: newItems };
    });
    onChange({ ...answers, categories: newCats });
  };

  const addItem = (catIndex: number) => {
    const newCats = categories.map((c: any, i: number) =>
      i === catIndex ? { ...c, items: [...c.items, ""] } : c
    );
    onChange({ ...answers, categories: newCats });
  };

  const removeItem = (catIndex: number, itemIndex: number) => {
    const newCats = categories.map((c: any, ci: number) => {
      if (ci !== catIndex) return c;
      return { ...c, items: c.items.filter((_: any, ii: number) => ii !== itemIndex) };
    });
    onChange({ ...answers, categories: newCats });
  };

  const addCategory = () => {
    onChange({ ...answers, categories: [...categories, { label: `Category ${categories.length + 1}`, items: [""] }] });
  };

  const removeCategory = (index: number) => {
    if (categories.length <= 2) return;
    onChange({ ...answers, categories: categories.filter((_: any, i: number) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Define categories and the items that belong to each. Students will drag items into the correct category.</p>
      {categories.map((cat: any, ci: number) => (
        <Card key={ci}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={cat.label}
                onChange={e => updateCategory(ci, "label", e.target.value)}
                placeholder="Category name"
                className="font-medium"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeCategory(ci)} disabled={categories.length <= 2}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2 pl-3">
              {cat.items.map((item: string, ii: number) => (
                <div key={ii} className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    value={item}
                    onChange={e => updateItem(ci, ii, e.target.value)}
                    placeholder={`Item ${ii + 1}`}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(ci, ii)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addItem(ci)} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={addCategory} className="gap-1.5 w-full">
        <Plus className="h-4 w-4" /> Add Category
      </Button>
    </div>
  );
}

// ─── Text Highlight Editor ───

function TextHighlightEditor({ answers, onChange }: { answers: any; onChange: (a: any) => void }) {
  const passage = answers?.passage || "";
  const selections = answers?.correctSelections || [];

  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) return;

    const container = document.getElementById("highlight-passage");
    if (!container) return;

    const range = selection.getRangeAt(0);
    const preRange = document.createRange();
    preRange.setStart(container, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const text = selection.toString();
    const end = start + text.length;

    // Avoid duplicates
    const already = selections.some((s: any) => s.start === start && s.end === end);
    if (!already) {
      onChange({
        ...answers,
        correctSelections: [...selections, { start, end, text }],
      });
    }
    selection.removeAllRanges();
  };

  const removeSelection = (index: number) => {
    onChange({
      ...answers,
      correctSelections: selections.filter((_: any, i: number) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>Passage Text</Label>
          <Textarea
            value={passage}
            onChange={e => onChange({ ...answers, passage: e.target.value, correctSelections: [] })}
            placeholder="Paste or type the reading passage here..."
            rows={6}
          />
        </CardContent>
      </Card>

      {passage && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Highlighter className="h-4 w-4 text-primary" />
              <Label>Select correct portions below</Label>
            </div>
            <p className="text-xs text-muted-foreground">Highlight text in the passage below to mark correct selections. Students will need to select these portions.</p>
            <div
              id="highlight-passage"
              className="p-3 bg-muted/50 rounded-md text-sm leading-relaxed cursor-text select-text border"
              onMouseUp={handleTextSelect}
            >
              <HighlightedPassage passage={passage} selections={selections} />
            </div>
            {selections.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Correct selections:</p>
                {selections.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-normal truncate max-w-[300px]">"{s.text}"</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSelection(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HighlightedPassage({ passage, selections }: { passage: string; selections: any[] }) {
  if (selections.length === 0) return <>{passage}</>;

  const sorted = [...selections].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const sel of sorted) {
    if (sel.start > lastEnd) {
      parts.push(passage.slice(lastEnd, sel.start));
    }
    parts.push(
      <span key={sel.start} className="bg-primary/20 text-primary font-medium rounded px-0.5">
        {passage.slice(sel.start, sel.end)}
      </span>
    );
    lastEnd = sel.end;
  }
  if (lastEnd < passage.length) {
    parts.push(passage.slice(lastEnd));
  }

  return <>{parts}</>;
}

// ─── Traditional Answer Editor (for full page) ───

function TraditionalAnswerEditor({ type, answers, onChange }: { type: string; answers: any[]; onChange: (a: any) => void }) {
  const updateAnswer = (index: number, field: string, value: any) => {
    onChange(answers.map((a: any, i: number) => i === index ? { ...a, [field]: value } : a));
  };

  const addAnswer = () => {
    onChange([...answers, { id: Date.now(), text: "", weight: 0, left: "", right: "" }]);
  };

  const removeAnswer = (index: number) => {
    if (answers.length <= 2) return;
    onChange(answers.filter((_: any, i: number) => i !== index));
  };

  const setCorrect = (index: number) => {
    onChange(answers.map((a: any, i: number) => ({ ...a, weight: i === index ? 100 : 0 })));
  };

  if (type === "essay_question") {
    return <p className="text-sm text-muted-foreground italic">Essay questions are open-ended with no predefined answers.</p>;
  }

  if (type === "true_false_question") {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label>Correct Answer</Label>
          <RadioGroup value={String(answers.findIndex((a: any) => a.weight === 100))} onValueChange={v => setCorrect(Number(v))}>
            {answers.map((a: any, i: number) => (
              <div key={a.id} className="flex items-center gap-2">
                <RadioGroupItem value={String(i)} id={`tf-full-${i}`} />
                <Label htmlFor={`tf-full-${i}`}>{a.text}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    );
  }

  if (type === "matching_question") {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>Matching Pairs</Label>
          {answers.map((a: any, i: number) => (
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
        </CardContent>
      </Card>
    );
  }

  if (type === "multiple_choice_question") {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>Answer Choices</Label>
          <RadioGroup value={String(answers.findIndex((a: any) => a.weight === 100))} onValueChange={v => setCorrect(Number(v))}>
            {answers.map((a: any, i: number) => (
              <div key={a.id} className="flex items-center gap-2">
                <RadioGroupItem value={String(i)} id={`mc-full-${i}`} />
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
        </CardContent>
      </Card>
    );
  }

  if (type === "multiple_answers_question") {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>Answer Choices (check all correct)</Label>
          {answers.map((a: any, i: number) => (
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
        </CardContent>
      </Card>
    );
  }

  // short_answer / fill_in_blank
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Label>Accepted Answers</Label>
        {answers.map((a: any, i: number) => (
          <div key={a.id || i} className="flex items-center gap-2">
            <Input value={a.text} onChange={e => updateAnswer(i, "text", e.target.value)} placeholder={`Answer ${i + 1}`} className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAnswer(i)} disabled={answers.length <= 1}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange([...answers, { id: Date.now(), text: "", weight: 100 }])} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Answer
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Live Preview ───

function QuestionPreview({ type, text, answers, points }: { type: string; text: string; answers: any; points: number }) {
  if (!text.trim()) {
    return <p className="text-muted-foreground text-sm italic">Start typing to see a preview...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium text-foreground">{text}</p>
        <Badge variant="outline" className="shrink-0">{points} pt{points !== 1 ? "s" : ""}</Badge>
      </div>
      <Badge variant="secondary" className="text-xs">{getQuestionTypeLabel(type)}</Badge>

      {type === "multiple_choice_question" && Array.isArray(answers) && (
        <div className="space-y-2 pl-1">
          {answers.map((a: any, i: number) => (
            <div key={i} className={`flex items-center gap-2 p-2 rounded-md border text-sm ${a.weight === 100 ? "border-primary bg-primary/5" : "border-border"}`}>
              <span className="font-medium text-muted-foreground w-5">{String.fromCharCode(65 + i)}.</span>
              <span>{a.text || "..."}</span>
              {a.weight === 100 && <Badge className="ml-auto text-xs">Correct</Badge>}
            </div>
          ))}
        </div>
      )}

      {type === "true_false_question" && Array.isArray(answers) && (
        <div className="space-y-2 pl-1">
          {answers.map((a: any, i: number) => (
            <div key={i} className={`flex items-center gap-2 p-2 rounded-md border text-sm ${a.weight === 100 ? "border-primary bg-primary/5" : "border-border"}`}>
              <span>{a.text}</span>
              {a.weight === 100 && <Badge className="ml-auto text-xs">Correct</Badge>}
            </div>
          ))}
        </div>
      )}

      {type === "multiple_answers_question" && Array.isArray(answers) && (
        <div className="space-y-2 pl-1">
          {answers.map((a: any, i: number) => (
            <div key={i} className={`flex items-center gap-2 p-2 rounded-md border text-sm ${a.weight === 100 ? "border-primary bg-primary/5" : "border-border"}`}>
              <Checkbox checked={a.weight === 100} disabled className="pointer-events-none" />
              <span>{a.text || "..."}</span>
            </div>
          ))}
        </div>
      )}

      {type === "matching_question" && Array.isArray(answers) && (
        <div className="space-y-2 pl-1">
          {answers.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-md border text-sm">
              <span className="font-medium">{a.left || "..."}</span>
              <span className="text-muted-foreground">→</span>
              <span>{a.right || "..."}</span>
            </div>
          ))}
        </div>
      )}

      {(type === "short_answer_question" || type === "fill_in_multiple_blanks_question") && Array.isArray(answers) && (
        <div className="border-b-2 border-dashed border-muted-foreground/40 w-48 h-8" />
      )}

      {type === "essay_question" && (
        <div className="border-2 border-dashed border-muted-foreground/30 rounded-md h-24 flex items-center justify-center text-xs text-muted-foreground">
          Student response area
        </div>
      )}

      {type === "multi_step_question" && answers?.parts && (
        <div className="space-y-4">
          {answers.parts.map((part: any, pi: number) => (
            <div key={pi} className="border rounded-md p-3 space-y-2">
              <p className="text-sm font-semibold text-primary">{part.label}</p>
              <p className="text-sm">{part.prompt || "..."}</p>
              {(part.type === "multiple_choice" || part.type === "select_all") && (
                <div className="space-y-1 pl-2">
                  {(part.options || []).map((opt: any, oi: number) => (
                    <div key={oi} className={`flex items-center gap-2 p-1.5 rounded text-sm ${opt.correct ? "bg-primary/5 font-medium" : ""}`}>
                      {part.type === "multiple_choice" ? (
                        <span className="h-3.5 w-3.5 rounded-full border border-current shrink-0" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-sm border border-current shrink-0" />
                      )}
                      <span>{opt.text || "..."}</span>
                    </div>
                  ))}
                </div>
              )}
              {part.type === "short_answer" && (
                <div className="border-b-2 border-dashed border-muted-foreground/40 w-48 h-6" />
              )}
            </div>
          ))}
        </div>
      )}

      {type === "drag_and_drop_question" && answers?.categories && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {answers.categories.flatMap((cat: any) => cat.items).filter((item: string) => item).map((item: string, i: number) => (
              <Badge key={i} variant="outline" className="px-3 py-1.5 cursor-grab text-sm">
                {item || "..."}
              </Badge>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {answers.categories.map((cat: any, ci: number) => (
              <div key={ci} className="border-2 border-dashed rounded-md p-3 min-h-[80px]">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{cat.label}</p>
                <p className="text-xs text-muted-foreground italic">Drop items here</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {type === "text_highlight_question" && answers?.passage && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            <span>Select the correct portion(s) of text</span>
          </div>
          <div className="p-3 bg-muted/50 rounded-md text-sm leading-relaxed border">
            <HighlightedPassage passage={answers.passage} selections={answers.correctSelections || []} />
          </div>
        </div>
      )}
    </div>
  );
}
