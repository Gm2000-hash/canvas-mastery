import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import { Loader2, Trash2, Play, CheckCircle2, FileText, Clock, Sparkles, Lightbulb, Upload, ChevronDown, Copy, Pencil, BookOpen, Wand2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "@/modules/curriculum/config/router";
import { useCanvasConfig } from "@/modules/curriculum/config/canvas-config";
import PushISATToCanvasDialog from "@/modules/curriculum/config/canvas-push-isat-dialog";
import { EnhanceQuestionDialog, type EnhanceResult, type EnhanceQuestion } from "@/modules/curriculum/components/EnhanceQuestionDialog";


interface ISATExam {
  id: string;
  title: string;
  grade_level: string;
  question_count: number;
  score: number | null;
  total_points: number | null;
  completed_at: string | null;
  created_at: string;
  hints_used: number;
  hints_enabled: boolean;
}

interface Props {
  onTakeExam: (examId: string) => void;
  onGenerateNew: () => void;
  refreshKey?: number;
}

const GRADE_LABELS: Record<string, string> = {
  "6th": "Physical Science",
  "7th": "Life Science",
  "8th": "Earth & Space Science",
};

export default function ISATExamList({ onTakeExam, onGenerateNew, refreshKey }: Props) {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ISATExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ISATExam | null>(null);
  const [pushTarget, setPushTarget] = useState<ISATExam | null>(null);
  const [pushQuestions, setPushQuestions] = useState<any[]>([]);

  // Bulk enrichment wizard state
  const [enrichExamId, setEnrichExamId] = useState<string | null>(null);
  const [enrichExamTitle, setEnrichExamTitle] = useState<string>("");
  const [enrichQuestions, setEnrichQuestions] = useState<any[]>([]);
  const [enrichIndex, setEnrichIndex] = useState(0);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichDialogOpen, setEnrichDialogOpen] = useState(false);

  const { config: canvasConfig, isConfigured: canvasConnected } = useCanvasConfig();

  const loadExams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("isat_exams")
        .select("id, title, grade_level, question_count, score, total_points, completed_at, created_at, hints_used, hints_enabled")
        .order("created_at", { ascending: false }) as any;

      if (error) throw error;
      setExams(data || []);
    } catch {
      toast.error("Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExams(); }, [refreshKey]);

  const handlePushToCanvas = async (exam: ISATExam) => {
    try {
      const { data, error } = await supabase
        .from("isat_exams")
        .select("questions")
        .eq("id", exam.id)
        .single() as any;
      if (error) throw error;
      setPushQuestions(data.questions || []);
      setPushTarget(exam);
    } catch {
      toast.error("Failed to load exam questions");
    }
  };

  const handleStartEnrich = async (exam: ISATExam) => {
    setEnrichLoading(true);
    try {
      const { data, error } = await supabase
        .from("isat_exams")
        .select("questions")
        .eq("id", exam.id)
        .single() as any;
      if (error) throw error;
      const all = (data?.questions || []) as any[];
      const remaining = all
        .map((q: any, i: number) => ({ q, i }))
        .filter(({ q }) => !q.image_url && !q.media);
      if (remaining.length === 0) {
        toast.info("All questions already have an image or manipulative");
        return;
      }
      setEnrichExamId(exam.id);
      setEnrichExamTitle(exam.title);
      setEnrichQuestions(all);
      setEnrichIndex(remaining[0].i);
      setEnrichDialogOpen(true);
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setEnrichLoading(false);
    }
  };

  const findNextUnenhanced = (questions: any[], fromIdx: number) => {
    for (let i = fromIdx; i < questions.length; i++) {
      const q = questions[i];
      if (!q.image_url && !q.media) return i;
    }
    return -1;
  };

  const handleEnrichApply = async (result: EnhanceResult) => {
    if (!enrichExamId) return;
    const updated = enrichQuestions.map((q, i) => {
      if (i !== enrichIndex) return q;
      return {
        ...q,
        ...(result.image_url ? { image_url: result.image_url } : {}),
        ...(result.media ? { media: result.media } : {}),
        ...(result.question_text ? { question_text: result.question_text } : {}),
        ...(result.answers ? { answers: result.answers } : {}),
        ...(result.dok_level ? { dok_level: result.dok_level } : {}),
      };
    });
    setEnrichQuestions(updated);
    try {
      const { error } = await supabase
        .from("isat_exams")
        .update({ questions: updated })
        .eq("id", enrichExamId) as any;
      if (error) throw error;
      toast.success(`Question ${enrichIndex + 1} enhanced`);
    } catch {
      toast.error("Failed to save enhancement");
      return;
    }
    const next = findNextUnenhanced(updated, enrichIndex + 1);
    if (next === -1) {
      toast.success("All questions enriched!");
      setEnrichDialogOpen(false);
      setEnrichExamId(null);
      loadExams();
    } else {
      setEnrichIndex(next);
    }
  };

  const handleEnrichSkip = () => {
    const next = findNextUnenhanced(enrichQuestions, enrichIndex + 1);
    if (next === -1) {
      toast.info("No more questions to enrich");
      setEnrichDialogOpen(false);
      setEnrichExamId(null);
    } else {
      setEnrichIndex(next);
    }
  };

  const enrichRemainingCount = enrichQuestions.filter((q) => !q.image_url && !q.media).length;
  const currentEnrichQuestion: EnhanceQuestion | null =
    enrichDialogOpen && enrichQuestions[enrichIndex]
      ? {
          question_number: enrichIndex + 1,
          question_type: enrichQuestions[enrichIndex].question_type,
          question_text: enrichQuestions[enrichIndex].question_text,
          standard_code: enrichQuestions[enrichIndex].standard_code,
          standard_description: enrichQuestions[enrichIndex].standard_description,
          dok_level: enrichQuestions[enrichIndex].dok_level,
          answers: enrichQuestions[enrichIndex].answers,
        }
      : null;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from("isat_exams")
        .delete()
        .eq("id", deleteTarget.id) as any;
      if (error) throw error;
      setExams((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      toast.success("Exam deleted");
    } catch {
      toast.error("Failed to delete exam");
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
        <div>
          <p className="text-sm font-medium">No ISAT practice exams yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Generate a practice exam to help students prepare for the ISAT ECA.
          </p>
        </div>
        <Button onClick={onGenerateNew} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Generate Practice Exam
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{exams.length} exam{exams.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={onGenerateNew} className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          Generate New Exam
        </Button>
      </div>

      {exams.map((exam) => (
        <Card key={exam.id} className="group hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{exam.title}</p>
                {exam.completed_at && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-base">
                  {exam.grade_level} Grade — {GRADE_LABELS[exam.grade_level] || exam.grade_level}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {exam.question_count} questions
                </Badge>
                {exam.completed_at && exam.score != null && exam.total_points != null && (
                  <Badge variant="default" className="text-xs">
                    Score: {exam.score}/{exam.total_points} ({Math.round((exam.score / exam.total_points) * 100)}%)
                  </Badge>
                )}
                {exam.completed_at && exam.hints_enabled && exam.hints_used > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700 bg-amber-50">
                    <Lightbulb className="h-3 w-3" />
                    {exam.hints_used} hint{exam.hints_used !== 1 ? "s" : ""} used
                  </Badge>
                )}
                {!exam.hints_enabled && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Formal
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(exam.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Canvas
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      if (!canvasConnected) {
                        toast.error("Configure Canvas in Settings first");
                        return;
                      }
                      handlePushToCanvas(exam);
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Push as Quiz
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const embedUrl = `https://canvas-quiz-doc-export.lovable.app/isat-exam/${exam.id}`;
                      const iframeHtml = `<iframe src="${embedUrl}" width="100%" height="600" style="border:none;" allowfullscreen></iframe>`;
                      navigator.clipboard.writeText(iframeHtml).then(() => {
                        toast.success("Embed code copied to clipboard");
                      }).catch(() => {
                        toast.error("Failed to copy embed code");
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Embed Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStartEnrich(exam)} disabled={enrichLoading}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Enrich with images
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/app/curriculum/isat-exams/${exam.id}/edit`)}
                className="gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/app/curriculum/isat-exams/${exam.id}/review`)}
                className="gap-1.5"
              >
                <BookOpen className="h-4 w-4" />
                Review
              </Button>
              <Button
                size="sm"
                onClick={() => onTakeExam(exam.id)}
                className="gap-1.5"
              >
                <Play className="h-4 w-4" />
                {exam.completed_at ? "Review" : "Take Exam"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setDeleteTarget(exam)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {canvasConnected && canvasConfig && pushTarget && (
        <PushISATToCanvasDialog
          open={!!pushTarget}
          onOpenChange={(v) => !v && setPushTarget(null)}
          examTitle={pushTarget.title}
          questions={pushQuestions}
          config={canvasConfig}
        />
      )}

      <EnhanceQuestionDialog
        open={enrichDialogOpen}
        onOpenChange={(v) => {
          setEnrichDialogOpen(v);
          if (!v) {
            setEnrichExamId(null);
            loadExams();
          }
        }}
        question={currentEnrichQuestion}
        onApply={handleEnrichApply}
        headerExtra={
          enrichDialogOpen ? (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {enrichExamTitle} — Question {enrichIndex + 1} · {enrichRemainingCount} remaining
              </p>
              <Button variant="ghost" size="sm" onClick={handleEnrichSkip}>
                Skip
              </Button>
            </div>
          ) : null
        }
      />
    </div>
  );
}
