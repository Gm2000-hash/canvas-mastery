import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "@/modules/curriculum/config/router";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";
import { Loader2, ArrowLeft, BookOpen, Layers, GraduationCap, RotateCcw, ChevronLeft, ChevronRight, Check, X, FileDown } from "lucide-react";
import { RichContent } from "@/modules/curriculum/components/activities/players/RichContent";

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

export default function ISATReviewPage() {
  usePageTitle("Review Materials");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState("");
  const [studyGuide, setStudyGuide] = useState<StudySection[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [reviewLesson, setReviewLesson] = useState<ReviewLesson | null>(null);
  const [tab, setTab] = useState("study-guide");

  // Flashcard state
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());

  // Practice Q state
  const [showAnswers, setShowAnswers] = useState<Set<number>>(new Set());

  const isEmbedded = window.self !== window.top;

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_public_review", { _exam_id: id }) as any;
      if (error || !data || data.length === 0) {
        toast.error("No review materials found for this exam");
        if (!isEmbedded) navigate(-1);
        setLoading(false);
        return;
      }
      const r = data[0];
      setExamTitle(r.exam_title || "");
      setStudyGuide(r.study_guide || []);
      setFlashcards(r.flashcards || []);
      setReviewLesson(r.review_lesson || null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const card = flashcards[cardIdx];
  const knownPct = flashcards.length ? Math.round((known.size / flashcards.length) * 100) : 0;

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to export PDF");
      return;
    }

    const studyHtml = studyGuide.map(s =>
      `<div class="section"><h2>${s.title}</h2><div>${s.content}</div>${s.key_points?.length ? `<div class="key-points"><p><strong>Key Takeaways:</strong></p><ul>${s.key_points.map(p => `<li>${p}</li>`).join("")}</ul></div>` : ""}</div>`
    ).join("");

    const flashcardsHtml = flashcards.map(f =>
      `<div class="card"><p class="term">${f.term}</p><p>${f.definition}</p>${f.example ? `<p class="example">Example: ${f.example}</p>` : ""}</div>`
    ).join("");

    const lessonHtml = reviewLesson ? `
      <h2>${reviewLesson.title}</h2>
      ${reviewLesson.objectives?.length ? `<div class="objectives"><p><strong>Learning Objectives:</strong></p><ul>${reviewLesson.objectives.map(o => `<li>${o}</li>`).join("")}</ul></div>` : ""}
      <div>${reviewLesson.introduction}</div>
      ${reviewLesson.sections?.map(s => `<div class="section"><h3>${s.title}</h3><div>${s.content}</div></div>`).join("") || ""}
      ${reviewLesson.summary ? `<div class="summary"><h3>Summary</h3><div>${reviewLesson.summary}</div></div>` : ""}
      ${reviewLesson.practice_questions?.length ? `<div class="practice"><h3>Practice Questions</h3>${reviewLesson.practice_questions.map((pq, i) => `<div class="pq"><p><strong>${i + 1}. ${pq.question}</strong></p><p class="answer">Answer: ${pq.answer}</p></div>`).join("")}</div>` : ""}
    ` : "";

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Review: ${examTitle}</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; font-size: 14px; line-height: 1.6; }
        h1 { font-size: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 24px; }
        h2 { font-size: 18px; color: #2563eb; margin-top: 28px; }
        h3 { font-size: 15px; margin-top: 16px; }
        .section { margin-bottom: 20px; page-break-inside: avoid; }
        .key-points { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-top: 8px; }
        .key-points ul { margin: 4px 0; padding-left: 20px; }
        .divider { border-top: 1px solid #e2e8f0; margin: 32px 0; }
        .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; page-break-inside: avoid; }
        .term { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
        .example { color: #64748b; font-style: italic; }
        .objectives ul { margin: 4px 0; padding-left: 20px; }
        .summary { background: #eff6ff; border-radius: 8px; padding: 12px 16px; margin-top: 16px; }
        .pq { margin-bottom: 12px; }
        .answer { color: #2563eb; padding-left: 16px; border-left: 3px solid #2563eb; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>📚 Review: ${examTitle}</h1>
      ${studyHtml ? `<h2>Study Guide</h2>${studyHtml}` : ""}
      ${flashcardsHtml ? `<div class="divider"></div><h2>Flashcards</h2>${flashcardsHtml}` : ""}
      ${lessonHtml ? `<div class="divider"></div>${lessonHtml}` : ""}
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="min-h-screen bg-background">
      {!isEmbedded && (
        <div className="border-b bg-card px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Review: {examTitle}</h1>
            <p className="text-xs text-muted-foreground">Study materials to help you prepare</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPdf}>
            <FileDown className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="study-guide" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> Study Guide
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="gap-1.5">
              <Layers className="h-4 w-4" /> Flashcards
            </TabsTrigger>
            <TabsTrigger value="lesson" className="gap-1.5">
              <GraduationCap className="h-4 w-4" /> Review Lesson
            </TabsTrigger>
          </TabsList>

          {/* Study Guide */}
          <TabsContent value="study-guide" className="mt-4 space-y-4">
            {studyGuide.length === 0 && <p className="text-muted-foreground text-center py-8">No study guide content yet.</p>}
            {studyGuide.map((section, i) => (
              <Card key={i}>
                <CardContent className="pt-5">
                  <h3 className="text-base font-semibold mb-2">{section.title}</h3>
                  <RichContent html={section.content} />
                  {section.key_points?.length > 0 && (
                    <div className="mt-3 bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Key Takeaways</p>
                      <ul className="space-y-1">
                        {section.key_points.map((pt, j) => (
                          <li key={j} className="text-sm flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Flashcards */}
          <TabsContent value="flashcards" className="mt-4">
            {flashcards.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No flashcards yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Card {cardIdx + 1} of {flashcards.length}</span>
                  <span>{knownPct}% mastered</span>
                </div>

                {/* Card */}
                <div
                  className="relative cursor-pointer rounded-xl border-2 border-primary/20 bg-card p-8 min-h-[220px] flex flex-col items-center justify-center text-center transition-all hover:shadow-lg"
                  onClick={() => setFlipped(!flipped)}
                >
                  {known.has(cardIdx) && (
                    <Badge className="absolute top-3 right-3 bg-green-100 text-green-800 text-[10px]">Mastered</Badge>
                  )}
                  {!flipped ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">TERM</p>
                      <p className="text-xl font-bold">{card?.term}</p>
                      <p className="text-xs text-muted-foreground mt-4">Click to flip</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">DEFINITION</p>
                      <p className="text-base leading-relaxed">{card?.definition}</p>
                      {card?.example && (
                        <p className="text-sm text-muted-foreground mt-3 italic">Example: {card.example}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="icon" disabled={cardIdx === 0} onClick={() => { setCardIdx(i => i - 1); setFlipped(false); }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={known.has(cardIdx) ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setKnown(prev => {
                      const n = new Set(prev);
                      n.has(cardIdx) ? n.delete(cardIdx) : n.add(cardIdx);
                      return n;
                    })}
                  >
                    <Check className="h-3.5 w-3.5" /> {known.has(cardIdx) ? "Mastered" : "Mark Known"}
                  </Button>
                  <Button variant="outline" size="icon" disabled={cardIdx === flashcards.length - 1} onClick={() => { setCardIdx(i => i + 1); setFlipped(false); }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex justify-center">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => { setCardIdx(0); setFlipped(false); setKnown(new Set()); }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset Progress
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Review Lesson */}
          <TabsContent value="lesson" className="mt-4 space-y-4">
            {!reviewLesson?.title ? (
              <p className="text-muted-foreground text-center py-8">No review lesson yet.</p>
            ) : (
              <>
                <Card>
                  <CardContent className="pt-5">
                    <h2 className="text-lg font-bold mb-2">{reviewLesson.title}</h2>
                    {reviewLesson.objectives?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Learning Objectives</p>
                        <ul className="space-y-1">
                          {reviewLesson.objectives.map((obj, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <GraduationCap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <RichContent html={reviewLesson.introduction} />
                  </CardContent>
                </Card>

                {reviewLesson.sections?.map((sec, i) => (
                  <Card key={i}>
                    <CardContent className="pt-5">
                      <h3 className="text-base font-semibold mb-2">{sec.title}</h3>
                      <RichContent html={sec.content} />
                    </CardContent>
                  </Card>
                ))}

                {reviewLesson.summary && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-5">
                      <h3 className="text-base font-semibold mb-2">Summary</h3>
                      <RichContent html={reviewLesson.summary} />
                    </CardContent>
                  </Card>
                )}

                {reviewLesson.practice_questions?.length > 0 && (
                  <Card>
                    <CardContent className="pt-5">
                      <h3 className="text-base font-semibold mb-3">Practice Questions</h3>
                      <div className="space-y-3">
                        {reviewLesson.practice_questions.map((pq, i) => (
                          <div key={i} className="border rounded-lg p-3">
                            <p className="text-sm font-medium">{i + 1}. {pq.question}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1.5 text-xs gap-1"
                              onClick={() => setShowAnswers(prev => {
                                const n = new Set(prev);
                                n.has(i) ? n.delete(i) : n.add(i);
                                return n;
                              })}
                            >
                              {showAnswers.has(i) ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                              {showAnswers.has(i) ? "Hide Answer" : "Show Answer"}
                            </Button>
                            {showAnswers.has(i) && (
                              <p className="text-sm text-primary mt-1 pl-2 border-l-2 border-primary">{pq.answer}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
