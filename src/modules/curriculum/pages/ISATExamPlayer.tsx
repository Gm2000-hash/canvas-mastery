import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "@/modules/curriculum/config/router";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, FileText, Clock, Send, RotateCcw, Lightbulb, BarChart3, BookOpen } from "lucide-react";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { ExamSummaryPanel } from "@/modules/curriculum/components/ExamSummaryPanel";
import { RichContent } from "@/modules/curriculum/components/activities/players/RichContent";
import { MathText } from "@/modules/curriculum/components/MathText";
import { ActivityPlayer } from "@/modules/curriculum/components/activities/ActivityPlayer";
import type { ActivityType, ActivityContent } from "@/modules/curriculum/lib/h5p-types";

interface ExamQuestionMedia {
  url: string;
  type: string;
  activity_id?: string;
  activity_type?: string;
}

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
  media?: ExamQuestionMedia;
}

interface ExamData {
  id: string;
  title: string;
  grade_level: string;
  question_count: number;
  questions: ExamQuestion[];
  answers: Record<string, any> | null;
  score: number | null;
  total_points: number | null;
  completed_at: string | null;
  hints_used: number;
  hints_enabled: boolean;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice_question: "Multiple Choice",
  multiple_answers_question: "Select All That Apply",
  drag_and_drop_question: "Drag & Drop",
  data_analysis_question: "Data Analysis",
  multi_step_question: "Multi-Step",
  scenario_question: "Scenario-Based",
  constructed_response_question: "Constructed Response",
  investigation_design_question: "Investigation Design",
  concept_map_question: "Concept Mapping",
};

const TYPE_COLORS: Record<string, string> = {
  multiple_choice_question: "bg-blue-100 text-blue-800",
  multiple_answers_question: "bg-indigo-100 text-indigo-800",
  drag_and_drop_question: "bg-purple-100 text-purple-800",
  data_analysis_question: "bg-emerald-100 text-emerald-800",
  multi_step_question: "bg-amber-100 text-amber-800",
  scenario_question: "bg-teal-100 text-teal-800",
  constructed_response_question: "bg-rose-100 text-rose-800",
  investigation_design_question: "bg-cyan-100 text-cyan-800",
  concept_map_question: "bg-orange-100 text-orange-800",
};

export default function ISATExamPlayer() {
  usePageTitle("ISAT Practice Exam");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ltiSessionId = searchParams.get("lti_session");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [revealedHints, setRevealedHints] = useState<Set<number>>(new Set());
  const [showSummary, setShowSummary] = useState(false);

  const isEmbedded = window.self !== window.top;

  useEffect(() => {
    if (!id) return;
    (async () => {
      // Check if user is authenticated
      const { data: sessionData } = await supabase.auth.getSession();
      const isAuthenticated = !!sessionData?.session;

      if (isAuthenticated) {
        // Authenticated users get full exam data (answers, scores, etc.)
        const { data, error } = await supabase
          .from("isat_exams")
          .select("*")
          .eq("id", id)
          .single() as any;

        if (error || !data) {
          toast.error("Exam not found");
          if (!isEmbedded) navigate("/app/curriculum/question-bank");
          return;
        }

        setExam(data as ExamData);
        if (data.completed_at && data.answers) {
          setStudentAnswers(data.answers);
          setSubmitted(true);
          setShowSummary(true);
        }
      } else {
        // Public access: use secure function that only returns content fields
        const { data, error } = await supabase
          .rpc("get_public_exam", { _exam_id: id }) as any;

        if (error || !data || data.length === 0) {
          toast.error("Exam not found");
          return;
        }

        const exam = data[0];
        setExam({
          ...exam,
          answers: null,
          score: null,
          total_points: null,
          completed_at: null,
          hints_used: 0,
        } as ExamData);
      }

      setLoading(false);
    })();
  }, [id]);

  if (loading || !exam) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const questions = exam.questions || [];
  const question = questions[currentQ];
  const totalPoints = questions.reduce((sum, q) => sum + (q.points_possible || 1), 0);
  const answeredCount = Object.keys(studentAnswers).length;
  const progressPct = Math.round((answeredCount / questions.length) * 100);

  const setAnswer = (qNum: number, value: any) => {
    setStudentAnswers((prev) => ({ ...prev, [qNum]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Auto-score MC, multi-answer, drag-and-drop
      let totalScore = 0;
      for (const q of questions) {
        const ans = studentAnswers[q.question_number];
        if (!ans) continue;

        if (
          q.question_type === "multiple_choice_question" ||
          q.question_type === "data_analysis_question" ||
          q.question_type === "scenario_question" ||
          q.question_type === "investigation_design_question"
        ) {
          if (Array.isArray(q.answers)) {
            const correct = q.answers.find((a: any) => a.weight === 100);
            if (correct && ans === correct.text) {
              totalScore += q.points_possible;
            }
          }
        } else if (q.question_type === "multiple_answers_question") {
          if (Array.isArray(q.answers)) {
            const correctTexts = q.answers.filter((a: any) => a.weight === 100).map((a: any) => a.text);
            const selected = Array.isArray(ans) ? ans : [];
            const allCorrect = correctTexts.every((t: string) => selected.includes(t)) && selected.length === correctTexts.length;
            if (allCorrect) totalScore += q.points_possible;
            else if (selected.some((t: string) => correctTexts.includes(t))) totalScore += Math.round(q.points_possible * 0.5);
          }
        } else if (q.question_type === "constructed_response_question") {
          // Give credit for any written response
          if (typeof ans === "string" && ans.trim().length > 10) {
            totalScore += Math.round(q.points_possible * 0.5); // Partial credit for attempting
          }
        }
        // Multi-step, drag-and-drop, concept map — partial scoring is complex, skip auto-grade
      }

      const hintsCount = revealedHints.size;

      const { data: sessionData } = await supabase.auth.getSession();
      const isAuthenticated = !!sessionData?.session;

      if (isAuthenticated) {
        const { error } = await supabase
          .from("isat_exams")
          .update({
            answers: studentAnswers as any,
            score: totalScore,
            total_points: totalPoints,
            hints_used: hintsCount,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", exam.id) as any;

        if (error) console.warn("Could not save exam results:", error.message);
      }

      setExam((prev) => prev ? { ...prev, score: totalScore, total_points: totalPoints, hints_used: hintsCount, completed_at: new Date().toISOString(), answers: studentAnswers } : prev);
      setSubmitted(true);
      setShowSummary(true);
      toast.success(`Exam submitted! Auto-scored: ${totalScore}/${totalPoints} points`);

      // LTI grade passback if launched from Canvas
      if (ltiSessionId) {
        try {
          const { data: gradeResult, error: gradeError } = await supabase.functions.invoke('lti-score', {
            body: {
              sessionId: ltiSessionId,
              score: totalScore,
              maxScore: totalPoints,
              activityId: `isat-exam-${exam.id}`,
            },
          });
          if (gradeError) {
            console.error('LTI grade passback error:', gradeError);
            toast.info("Score saved but grade passback to Canvas failed");
          } else if (gradeResult?.gradePosted) {
            toast.success("Score posted to Canvas gradebook");
          } else {
            toast.info(gradeResult?.message || "Score saved locally");
          }
        } catch (e) {
          console.error('LTI grade passback error:', e);
        }
      }
    } catch {
      toast.error("Failed to submit exam");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = async () => {
    try {
      const { error } = await supabase
        .from("isat_exams")
        .update({
          answers: null,
          score: null,
          completed_at: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", exam.id) as any;

      if (error) throw error;

      setStudentAnswers({});
      setSubmitted(false);
      setShowSummary(false);
      setCurrentQ(0);
      setRevealedHints(new Set());
      setExam((prev) => prev ? { ...prev, score: null, total_points: null, completed_at: null, answers: null, hints_used: 0 } : prev);
      toast.success("Exam reset — you can retake it now");
    } catch {
      toast.error("Failed to reset exam");
    }
  };

  const renderQuestion = (q: ExamQuestion) => {
    const ans = studentAnswers[q.question_number];
    const isReview = submitted;

    // Render based on question type
    if (
      q.question_type === "multiple_choice_question" ||
      q.question_type === "data_analysis_question" ||
      q.question_type === "scenario_question" ||
      q.question_type === "investigation_design_question"
    ) {
      const options = Array.isArray(q.answers) ? q.answers : [];
      return (
        <RadioGroup
          value={ans || ""}
          onValueChange={(v) => !isReview && setAnswer(q.question_number, v)}
          className="space-y-2"
        >
          {options.map((opt: any, i: number) => {
            const isCorrect = opt.weight === 100;
            const isSelected = ans === opt.text;
            let borderClass = "";
            if (isReview) {
              if (isCorrect) borderClass = "border-green-500 bg-green-50";
              else if (isSelected && !isCorrect) borderClass = "border-red-500 bg-red-50";
            }
            return (
              <label
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${borderClass}`}
              >
                <RadioGroupItem value={opt.text} disabled={isReview} className="mt-0.5" />
                <MathText text={opt.text} className="text-sm" inline />
                {isReview && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto shrink-0" />}
                {isReview && isSelected && !isCorrect && <AlertCircle className="h-4 w-4 text-red-500 ml-auto shrink-0" />}
              </label>
            );
          })}
        </RadioGroup>
      );
    }

    if (q.question_type === "multiple_answers_question") {
      const options = Array.isArray(q.answers) ? q.answers : [];
      const selected: string[] = Array.isArray(ans) ? ans : [];
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground italic">Select all that apply.</p>
          {options.map((opt: any, i: number) => {
            const isCorrect = opt.weight === 100;
            const isChecked = selected.includes(opt.text);
            let borderClass = "";
            if (isReview) {
              if (isCorrect) borderClass = "border-green-500 bg-green-50";
              else if (isChecked && !isCorrect) borderClass = "border-red-500 bg-red-50";
            }
            return (
              <label
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${borderClass}`}
              >
                <Checkbox
                  checked={isChecked}
                  disabled={isReview}
                  onCheckedChange={(checked) => {
                    if (isReview) return;
                    const next = checked
                      ? [...selected, opt.text]
                      : selected.filter((t) => t !== opt.text);
                    setAnswer(q.question_number, next);
                  }}
                  className="mt-0.5"
                />
                <MathText text={opt.text} className="text-sm" inline />
                {isReview && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto shrink-0" />}
              </label>
            );
          })}
        </div>
      );
    }

    if (q.question_type === "constructed_response_question") {
      const promptData = q.answers;
      const rubric = promptData?.scoring_rubric;
      const sample = promptData?.sample_response;
      return (
        <div className="space-y-3">
          {promptData?.prompt && (
            <p className="text-sm text-muted-foreground italic">{promptData.prompt}</p>
          )}
          <Textarea
            placeholder="Write your response here..."
            value={typeof ans === "string" ? ans : ""}
            onChange={(e) => !isReview && setAnswer(q.question_number, e.target.value)}
            disabled={isReview}
            className="min-h-[120px]"
          />
          {isReview && rubric && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-1">
              <p className="text-xs font-semibold text-blue-800">Scoring Rubric:</p>
              <p className="text-xs text-blue-700">{rubric}</p>
            </div>
          )}
          {isReview && sample && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 space-y-1">
              <p className="text-xs font-semibold text-green-800">Sample Response:</p>
              <p className="text-xs text-green-700">{sample}</p>
            </div>
          )}
        </div>
      );
    }

    if (q.question_type === "multi_step_question") {
      const parts = q.answers?.parts || [];
      const partAnswers: Record<string, any> = typeof ans === "object" && ans !== null ? ans : {};
      return (
        <div className="space-y-4">
          {parts.map((part: any, pi: number) => (
            <div key={pi} className="p-3 rounded-lg border bg-muted/30 space-y-2">
              <p className="text-sm font-semibold">{part.label}</p>
              <p className="text-sm">{part.prompt}</p>
              {part.type === "multiple_choice" && part.options && (
                <RadioGroup
                  value={partAnswers[part.label] || ""}
                  onValueChange={(v) => {
                    if (isReview) return;
                    setAnswer(q.question_number, { ...partAnswers, [part.label]: v });
                  }}
                  className="space-y-1.5"
                >
                  {part.options.map((opt: any, oi: number) => {
                    const isCorrect = opt.correct;
                    const isSelected = partAnswers[part.label] === opt.text;
                    let borderClass = "";
                    if (isReview) {
                      if (isCorrect) borderClass = "border-green-500 bg-green-50";
                      else if (isSelected && !isCorrect) borderClass = "border-red-500 bg-red-50";
                    }
                    return (
                      <label key={oi} className={`flex items-start gap-3 p-2 rounded border cursor-pointer hover:bg-accent/50 ${borderClass}`}>
                        <RadioGroupItem value={opt.text} disabled={isReview} className="mt-0.5" />
                        <MathText text={opt.text} className="text-sm" inline />
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
              {(part.type === "short_answer" || part.type === "select_all") && (
                <div>
                  <Textarea
                    placeholder="Type your answer..."
                    value={partAnswers[part.label] || ""}
                    onChange={(e) => {
                      if (isReview) return;
                      setAnswer(q.question_number, { ...partAnswers, [part.label]: e.target.value });
                    }}
                    disabled={isReview}
                    className="min-h-[60px]"
                  />
                  {isReview && part.correctText && (
                    <p className="text-xs text-green-700 mt-1">Expected: {part.correctText}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (q.question_type === "drag_and_drop_question" || q.question_type === "concept_map_question") {
      const categories = q.answers?.categories || [];
      // Simplified: show categories and items, let students type which category each belongs to
      const allItems = categories.flatMap((c: any) => (c.items || []).map((item: string) => ({ item, category: c.label })));
      const assignments: Record<string, string> = typeof ans === "object" && ans !== null && !Array.isArray(ans) ? ans : {};

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <p className="text-xs text-muted-foreground w-full">Categories:</p>
            {categories.map((c: any, i: number) => (
              <Badge key={i} variant="outline" className="text-base">{c.label}</Badge>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Assign each item to a category:</p>
            {allItems.map((entry: any, i: number) => {
              const isCorrect = isReview && assignments[entry.item] === entry.category;
              const isWrong = isReview && assignments[entry.item] && assignments[entry.item] !== entry.category;
              return (
                <div key={i} className={`flex items-center gap-3 p-2 rounded border ${isCorrect ? "border-green-500 bg-green-50" : isWrong ? "border-red-500 bg-red-50" : ""}`}>
                  <span className="text-sm flex-1">{entry.item}</span>
                  <select
                    className="text-sm border rounded px-2 py-1 bg-background"
                    value={assignments[entry.item] || ""}
                    disabled={isReview}
                    onChange={(e) => {
                      if (isReview) return;
                      setAnswer(q.question_number, { ...assignments, [entry.item]: e.target.value });
                    }}
                  >
                    <option value="">Select...</option>
                    {categories.map((c: any, ci: number) => (
                      <option key={ci} value={c.label}>{c.label}</option>
                    ))}
                  </select>
                  {isReview && isWrong && (
                    <span className="text-xs text-green-700">→ {entry.category}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Fallback: show as text input
    return (
      <div>
        <Textarea
          placeholder="Type your answer..."
          value={typeof ans === "string" ? ans : ""}
          onChange={(e) => !isReview && setAnswer(q.question_number, e.target.value)}
          disabled={isReview}
          className="min-h-[100px]"
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-white glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[
          { label: "Question Bank", path: "/app/curriculum/question-bank" },
          { label: exam.title },
        ]} />
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-4">
        {/* Exam header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{exam.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{exam.grade_level} Grade</Badge>
              <Badge variant="secondary">{questions.length} questions</Badge>
              <Badge variant="secondary">{totalPoints} points</Badge>
              {submitted && exam.score != null && (
                <Badge variant="default" className="bg-primary">
                  Score: {exam.score}/{totalPoints} ({Math.round(((exam.score || 0) / totalPoints) * 100)}%)
                </Badge>
              )}
              {submitted && exam.hints_enabled && (
                <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 bg-amber-50">
                  <Lightbulb className="h-3 w-3" />
                  {exam.hints_used}/{questions.filter(q => q.hint).length} hints used
                </Badge>
              )}
              {!exam.hints_enabled && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  Formal Assessment — No Hints
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {submitted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/curriculum/isat-exams/${id}/review`)}
                className="gap-1.5"
              >
                <BookOpen className="h-4 w-4" />
                Study Materials
              </Button>
            )}
            {submitted && (
              <Button
                variant={showSummary ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSummary(s => !s)}
                className="gap-1.5"
              >
                <BarChart3 className="h-4 w-4" />
                {showSummary ? "Hide Summary" : "Summary"}
              </Button>
            )}
            {submitted && (
              <Button variant="outline" size="sm" onClick={handleRetake} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Retake
              </Button>
            )}
            {!isEmbedded && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/app/curriculum/question-bank")} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{answeredCount}/{questions.length} answered</span>
            <span>Question {currentQ + 1} of {questions.length}</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Summary panel */}
        {submitted && showSummary && exam.score != null && (
          <ExamSummaryPanel
            questions={questions}
            studentAnswers={studentAnswers}
            score={exam.score}
            totalPoints={totalPoints}
            hintsUsed={exam.hints_used}
            hintsEnabled={exam.hints_enabled}
            revealedHints={revealedHints}
          />
        )}

        {/* Question navigation strip */}
        <div className="flex flex-wrap gap-1">
          {questions.map((q, i) => {
            const hasAnswer = studentAnswers[q.question_number] !== undefined;
            return (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`w-8 h-8 text-xs rounded border font-medium transition-colors
                  ${i === currentQ ? "bg-primary text-primary-foreground border-primary" : ""}
                  ${hasAnswer && i !== currentQ ? "bg-primary/20 border-primary/40" : ""}
                  ${!hasAnswer && i !== currentQ ? "bg-background border-border hover:bg-accent" : ""}
                `}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Current question */}
        {question && (
          <Card className="border-2">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">Q{question.question_number}.</span>
                  <Badge className={`text-xs ${TYPE_COLORS[question.question_type] || "bg-gray-100 text-gray-800"}`}>
                    {QUESTION_TYPE_LABELS[question.question_type] || question.question_type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{question.standard_code}</Badge>
                  <Badge variant="secondary" className="text-xs">DOK {question.dok_level}</Badge>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{question.points_possible} pt{question.points_possible !== 1 ? "s" : ""}</span>
              </div>

              <RichContent html={question.question_text} />

              {/* Question image/media */}
              {question.image_url && (
                <img src={question.image_url} alt="Question illustration" className="max-h-64 rounded-lg border" />
              )}
              {question.media?.url && question.media.type === "image" && (
                <img src={question.media.url} alt="Question media" className="max-h-64 rounded-lg border" />
              )}
              {question.media?.url && question.media.type === "video" && (
                <video src={question.media.url} controls className="w-full rounded-lg max-h-64" preload="metadata" />
              )}
              {question.media?.url && question.media.type === "audio" && (
                <audio src={question.media.url} controls className="w-full" preload="metadata" />
              )}
              {question.media?.type === "h5p" && question.media.activity_id && (
                <H5PMediaRenderer activityId={question.media.activity_id} fallbackImage={question.media.url} />
              )}

              {/* Hint section — only when hints are enabled */}
              {exam.hints_enabled && question.hint && !submitted && (
                <div>
                  {revealedHints.has(question.question_number) ? (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">{question.hint}</p>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => setRevealedHints(prev => new Set(prev).add(question.question_number))}
                    >
                      <Lightbulb className="h-4 w-4" />
                      Show Hint
                    </Button>
                  )}
                </div>
              )}

              {/* Show hint automatically in review mode */}
              {question.hint && submitted && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Hint:</p>
                    <p className="text-sm text-amber-800">{question.hint}</p>
                  </div>
                </div>
              )}

              {renderQuestion(question)}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
            disabled={currentQ === 0}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          {currentQ === questions.length - 1 && !submitted ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5"
              size="lg"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Exam ({answeredCount}/{questions.length} answered)
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
              disabled={currentQ === questions.length - 1}
              className="gap-1.5"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function H5PMediaRenderer({ activityId, fallbackImage }: { activityId: string; fallbackImage?: string }) {
  const [activity, setActivity] = useState<{ activity_type: string; content: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("h5p_activities")
          .select("activity_type, content")
          .eq("id", activityId)
          .maybeSingle() as any;
        if (cancelled) return;
        if (error || !data) {
          setActivity(null);
        } else {
          setActivity(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activityId]);

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading interactive...</div>;
  }
  if (!activity) {
    // Fallback: just show the static image if available
    return fallbackImage ? <img src={fallbackImage} alt="Question media" className="max-h-64 rounded-lg border" /> : null;
  }
  return (
    <div className="rounded-lg border bg-card p-3">
      <ActivityPlayer type={activity.activity_type as any} content={activity.content} />
    </div>
  );
}

