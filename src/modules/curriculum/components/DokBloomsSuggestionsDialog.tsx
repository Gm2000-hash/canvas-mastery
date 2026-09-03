import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Lightbulb, Copy, Check, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";

interface DokSuggestion {
  level: number;
  level_name: string;
  explanation: string;
  rewritten_question: string;
  rewritten_answers?: any;
  is_current: boolean;
}

interface BloomsSuggestion {
  level: string;
  explanation: string;
  rewritten_question: string;
  rewritten_answers?: any;
  is_current: boolean;
}

interface Suggestions {
  dok_suggestions: DokSuggestion[];
  blooms_suggestions: BloomsSuggestion[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionText: string;
  questionType: string;
  currentDok: number | null;
  currentBlooms: string | null;
  answers?: any;
  onApplySuggestion?: (text: string, dok: number, blooms: string, answers?: any) => void;
}

function AnswerPreview({ answers }: { answers: any }) {
  if (!answers) return null;

  // Array answers (MC, TF, Select All, Matching)
  if (Array.isArray(answers) && answers.length > 0) {
    const isMatching = answers[0]?.left !== undefined;
    if (isMatching) {
      return (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Answer Choices:</p>
          {answers.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
              <span className="font-medium">{a.left}</span>
              <span>→</span>
              <span>{a.right}</span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="mt-2 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Answer Choices:</p>
        {answers.map((a: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 text-xs pl-2">
            {a.weight > 0 ? (
              <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
            ) : (
              <XCircle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            )}
            <span className={a.weight > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
              {a.text || a.html || `Option ${i + 1}`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Multi-step
  if (answers?.parts && Array.isArray(answers.parts)) {
    return (
      <div className="mt-2 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Parts:</p>
        {answers.parts.map((p: any, i: number) => (
          <div key={i} className="text-xs text-muted-foreground pl-2">
            <span className="font-medium">{p.label}:</span> {p.prompt}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default function DokBloomsSuggestionsDialog({
  open,
  onOpenChange,
  questionText,
  questionType,
  currentDok,
  currentBlooms,
  answers,
  onApplySuggestion,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    setSuggestions(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-dok-blooms", {
        body: {
          question_text: questionText,
          question_type: questionType,
          current_dok: currentDok,
          current_blooms: currentBlooms,
          answers: answers || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSuggestions(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when opened
  React.useEffect(() => {
    if (open && !suggestions && !loading && questionText.trim()) {
      fetchSuggestions();
    }
    if (!open) {
      setSuggestions(null);
    }
  }, [open]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const dokColors: Record<number, string> = {
    1: "bg-success/15 text-success",
    2: "bg-info/15 text-info",
    3: "bg-warning/15 text-warning",
    4: "bg-destructive/15 text-destructive",
  };

  const bloomsColors: Record<string, string> = {
    Remember: "bg-muted text-muted-foreground",
    Understand: "bg-success/15 text-success",
    Apply: "bg-info/15 text-info",
    Analyze: "bg-warning/15 text-warning",
    Evaluate: "bg-chart-3/15 text-chart-3",
    Create: "bg-destructive/15 text-destructive",
  };

  const SuggestionCard = ({
    label,
    colorClass,
    explanation,
    rewrittenQuestion,
    rewrittenAnswers,
    isCurrent,
    id,
    onApply,
  }: {
    label: string;
    colorClass: string;
    explanation: string;
    rewrittenQuestion: string;
    rewrittenAnswers?: any;
    isCurrent: boolean;
    id: string;
    onApply?: () => void;
  }) => (
    <Card className={`transition-all ${isCurrent ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Badge className={`${colorClass} border-0 text-xs font-medium`}>{label}</Badge>
          {isCurrent && (
            <Badge variant="outline" className="text-xs text-primary border-primary">
              Current Level
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{explanation}</p>
        <div className="bg-muted/50 rounded-md p-3 text-sm leading-relaxed">
          {rewrittenQuestion}
          <AnswerPreview answers={rewrittenAnswers} />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => handleCopy(rewrittenQuestion, id)}
          >
            {copiedId === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedId === id ? "Copied" : "Copy"}
          </Button>
          {onApply && !isCurrent && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={onApply}
            >
              <Sparkles className="h-3 w-3" />
              Apply This Version
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-warning" />
            DOK & Bloom's Customization Suggestions
          </DialogTitle>
          <DialogDescription>
            AI-generated suggestions for how to modify this question to target different cognitive levels.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing question and generating suggestions...</p>
          </div>
        )}

        {!loading && suggestions && (
          <Tabs defaultValue="dok" className="mt-2">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="dok">DOK Levels (1–4)</TabsTrigger>
              <TabsTrigger value="blooms">Bloom's Taxonomy</TabsTrigger>
            </TabsList>

            <TabsContent value="dok" className="space-y-3 mt-3">
              {suggestions.dok_suggestions
                .sort((a, b) => a.level - b.level)
                .map((s) => (
                  <SuggestionCard
                    key={`dok-${s.level}`}
                    id={`dok-${s.level}`}
                    label={`DOK ${s.level} — ${s.level_name}`}
                    colorClass={dokColors[s.level] || ""}
                    explanation={s.explanation}
                    rewrittenQuestion={s.rewritten_question}
                    rewrittenAnswers={s.rewritten_answers}
                    isCurrent={s.is_current}
                    onApply={
                      onApplySuggestion
                        ? () => {
                            const bloomsForDok: Record<number, string> = { 1: "Remember", 2: "Apply", 3: "Analyze", 4: "Create" };
                            onApplySuggestion(s.rewritten_question, s.level, bloomsForDok[s.level] || currentBlooms || "Remember", s.rewritten_answers);
                            onOpenChange(false);
                          }
                        : undefined
                    }
                  />
                ))}
            </TabsContent>

            <TabsContent value="blooms" className="space-y-3 mt-3">
              {suggestions.blooms_suggestions.map((s) => (
                <SuggestionCard
                  key={`blooms-${s.level}`}
                  id={`blooms-${s.level}`}
                  label={s.level}
                  colorClass={bloomsColors[s.level] || ""}
                  explanation={s.explanation}
                  rewrittenQuestion={s.rewritten_question}
                  rewrittenAnswers={s.rewritten_answers}
                  isCurrent={s.is_current}
                  onApply={
                    onApplySuggestion
                      ? () => {
                          const dokForBlooms: Record<string, number> = { Remember: 1, Understand: 2, Apply: 2, Analyze: 3, Evaluate: 3, Create: 4 };
                          onApplySuggestion(s.rewritten_question, dokForBlooms[s.level] || currentDok || 1, s.level, s.rewritten_answers);
                          onOpenChange(false);
                        }
                      : undefined
                  }
                />
              ))}
            </TabsContent>
          </Tabs>
        )}

        {!loading && !suggestions && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Lightbulb className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No suggestions yet</p>
            <Button onClick={fetchSuggestions} className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Generate Suggestions
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
