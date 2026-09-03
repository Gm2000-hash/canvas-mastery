import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, XCircle, Lightbulb, BarChart3, Target, TrendingUp,
} from "lucide-react";

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
}

interface ExamSummaryPanelProps {
  questions: ExamQuestion[];
  studentAnswers: Record<number, any>;
  score: number;
  totalPoints: number;
  hintsUsed: number;
  hintsEnabled: boolean;
  revealedHints: Set<number>;
}

function scoreQuestion(q: ExamQuestion, ans: any): { earned: number; status: "correct" | "partial" | "incorrect" | "unanswered" } {
  if (ans === undefined || ans === null) return { earned: 0, status: "unanswered" };

  if (
    q.question_type === "multiple_choice_question" ||
    q.question_type === "data_analysis_question" ||
    q.question_type === "scenario_question" ||
    q.question_type === "investigation_design_question"
  ) {
    if (Array.isArray(q.answers)) {
      const correct = q.answers.find((a: any) => a.weight === 100);
      if (correct && ans === correct.text) return { earned: q.points_possible, status: "correct" };
    }
    return { earned: 0, status: "incorrect" };
  }

  if (q.question_type === "multiple_answers_question") {
    if (Array.isArray(q.answers)) {
      const correctTexts = q.answers.filter((a: any) => a.weight === 100).map((a: any) => a.text);
      const selected = Array.isArray(ans) ? ans : [];
      const allCorrect = correctTexts.every((t: string) => selected.includes(t)) && selected.length === correctTexts.length;
      if (allCorrect) return { earned: q.points_possible, status: "correct" };
      if (selected.some((t: string) => correctTexts.includes(t))) return { earned: Math.round(q.points_possible * 0.5), status: "partial" };
    }
    return { earned: 0, status: "incorrect" };
  }

  if (q.question_type === "constructed_response_question") {
    if (typeof ans === "string" && ans.trim().length > 10) return { earned: Math.round(q.points_possible * 0.5), status: "partial" };
    return { earned: 0, status: "incorrect" };
  }

  // For other types (multi-step, drag-drop, concept map) — mark as partial if answered
  return { earned: 0, status: "partial" };
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice_question: "MC",
  multiple_answers_question: "Select All",
  drag_and_drop_question: "Drag & Drop",
  data_analysis_question: "Data Analysis",
  multi_step_question: "Multi-Step",
  scenario_question: "Scenario",
  constructed_response_question: "Constructed Response",
  investigation_design_question: "Investigation",
  concept_map_question: "Concept Map",
};

export function ExamSummaryPanel({
  questions,
  studentAnswers,
  score,
  totalPoints,
  hintsUsed,
  hintsEnabled,
  revealedHints,
}: ExamSummaryPanelProps) {
  const scorePct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

  // Per-question results
  const questionResults = useMemo(() =>
    questions.map(q => ({
      ...q,
      ...scoreQuestion(q, studentAnswers[q.question_number]),
      usedHint: revealedHints.has(q.question_number),
    })),
    [questions, studentAnswers, revealedHints]
  );

  // Score by standard
  const standardStats = useMemo(() => {
    const map = new Map<string, { code: string; description: string; earned: number; possible: number; correct: number; total: number; hints: number }>();
    for (const qr of questionResults) {
      const existing = map.get(qr.standard_code) || {
        code: qr.standard_code,
        description: qr.standard_description || "",
        earned: 0,
        possible: 0,
        correct: 0,
        total: 0,
        hints: 0,
      };
      existing.earned += qr.earned;
      existing.possible += qr.points_possible;
      existing.total += 1;
      if (qr.status === "correct") existing.correct += 1;
      if (qr.usedHint) existing.hints += 1;
      map.set(qr.standard_code, existing);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aPct = a.possible > 0 ? a.earned / a.possible : 0;
      const bPct = b.possible > 0 ? b.earned / b.possible : 0;
      return aPct - bPct; // weakest first
    });
  }, [questionResults]);

  // Score by question type
  const typeStats = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const qr of questionResults) {
      const existing = map.get(qr.question_type) || { correct: 0, total: 0 };
      existing.total += 1;
      if (qr.status === "correct") existing.correct += 1;
      map.set(qr.question_type, existing);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [questionResults]);

  // DOK breakdown
  const dokStats = useMemo(() => {
    const map = new Map<number, { correct: number; total: number }>();
    for (const qr of questionResults) {
      const existing = map.get(qr.dok_level) || { correct: 0, total: 0 };
      existing.total += 1;
      if (qr.status === "correct") existing.correct += 1;
      map.set(qr.dok_level, existing);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [questionResults]);

  const correctCount = questionResults.filter(q => q.status === "correct").length;
  const incorrectCount = questionResults.filter(q => q.status === "incorrect").length;
  const partialCount = questionResults.filter(q => q.status === "partial").length;
  const unansweredCount = questionResults.filter(q => q.status === "unanswered").length;

  const gradeColor = scorePct >= 80 ? "text-green-600" : scorePct >= 60 ? "text-amber-600" : "text-red-600";
  const gradeBg = scorePct >= 80 ? "bg-green-50 border-green-200" : scorePct >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-4">
      {/* Overall Score Card */}
      <Card className={`border-2 ${gradeBg}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overall Score</p>
              <p className={`text-3xl font-bold ${gradeColor}`}>{scorePct}%</p>
              <p className="text-sm text-muted-foreground mt-1">{score}/{totalPoints} points</p>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{correctCount} correct</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>{incorrectCount} incorrect</span>
              </div>
              {partialCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  <span>{partialCount} partial</span>
                </div>
              )}
              {unansweredCount > 0 && (
                <p className="text-xs text-muted-foreground">{unansweredCount} unanswered</p>
              )}
              {hintsEnabled && (
                <div className="flex items-center gap-1.5 text-sm text-amber-600">
                  <Lightbulb className="h-4 w-4" />
                  <span>{hintsUsed} hint{hintsUsed !== 1 ? "s" : ""} used</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score by Standard */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Score by Standard</p>
          </div>
          <div className="space-y-2">
            {standardStats.map(stat => {
              const pct = stat.possible > 0 ? Math.round((stat.earned / stat.possible) * 100) : 0;
              const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={stat.code} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0">{stat.code}</Badge>
                      <span className="text-xs text-muted-foreground truncate">{stat.description}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hintsEnabled && stat.hints > 0 && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <Lightbulb className="h-3 w-3" />{stat.hints}
                        </span>
                      )}
                      <span className="text-xs font-medium w-16 text-right">{stat.earned}/{stat.possible} ({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Performance by Question Type + DOK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">By Question Type</p>
            </div>
            <div className="space-y-2">
              {typeStats.map(([type, stats]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs">{QUESTION_TYPE_LABELS[type] || type}</span>
                  <span className="text-xs font-medium">
                    {stats.correct}/{stats.total}
                    <span className="text-muted-foreground ml-1">
                      ({stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">By DOK Level</p>
            </div>
            <div className="space-y-2">
              {dokStats.map(([dok, stats]) => {
                const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                return (
                  <div key={dok} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">DOK {dok}</span>
                      <span className="text-xs font-medium">{stats.correct}/{stats.total} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Question Breakdown */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">Per-Question Breakdown</p>
          <div className="grid grid-cols-1 gap-1">
            {questionResults.map(qr => (
              <div
                key={qr.question_number}
                className={`flex items-center gap-3 px-3 py-1.5 rounded text-xs ${
                  qr.status === "correct" ? "bg-green-50" :
                  qr.status === "partial" ? "bg-amber-50" :
                  qr.status === "incorrect" ? "bg-red-50" :
                  "bg-muted/30"
                }`}
              >
                <span className="font-medium w-6">Q{qr.question_number}</span>
                {qr.status === "correct" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {qr.status === "incorrect" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                {qr.status === "partial" && <TrendingUp className="h-3.5 w-3.5 text-amber-500" />}
                {qr.status === "unanswered" && <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />}
                <Badge variant="outline" className="text-[10px] px-1 py-0">{qr.standard_code}</Badge>
                <span className="text-muted-foreground">{QUESTION_TYPE_LABELS[qr.question_type] || qr.question_type}</span>
                <span className="ml-auto font-medium">{qr.earned}/{qr.points_possible}</span>
                {qr.usedHint && hintsEnabled && (
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}