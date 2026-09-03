import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Wand2, ArrowLeft, Target, Layers, ListChecks, MessageCircleQuestion, Eye, Save, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/modules/curriculum/config/supabase";
import { toast } from "sonner";

// Three teacher-approved categories of formative assessment.
type Category = "traditional" | "formative" | "theory";
const CATEGORIES: { key: Category; label: string; blurb: string; icon: any }[] = [
  { key: "traditional", label: "Traditional", blurb: "Quizzes, worksheets, essays, lab reports — graded products of learning.", icon: ListChecks },
  { key: "formative", label: "Formative strategies", blurb: "Exit tickets, hinge questions, retrieval practice, misconception checks.", icon: Sparkles },
  { key: "theory", label: "Learning-theory anchored", blurb: "Constructivist, cognitive, Kolb experiential, metacognitive, Danielson.", icon: Layers },
];

const TYPES_BY_CATEGORY: Record<Category, { value: string; label: string; hint: string }[]> = {
  traditional: [
    { value: "worksheet", label: "Worksheet / problem set", hint: "Skill practice with mixed item types" },
    { value: "quiz", label: "Short formative quiz", hint: "5–10 quick items to check understanding" },
    { value: "essay", label: "Essay / extended response", hint: "Written argument or explanation" },
    { value: "short-answer", label: "Constructed response (CER)", hint: "Claim · Evidence · Reasoning" },
    { value: "lab-report", label: "Lab report", hint: "Investigation write-up" },
    { value: "homework", label: "Homework practice", hint: "Independent practice outside class" },
    { value: "presentation", label: "Presentation / pitch", hint: "Oral defense with visuals" },
  ],
  formative: [
    { value: "exit-ticket", label: "Exit ticket", hint: "1–3 items answered at end of class" },
    { value: "entrance-ticket", label: "Entrance ticket / Do Now", hint: "Activate prior knowledge to start class" },
    { value: "hinge-question", label: "Hinge question", hint: "Single decision-point item that re-routes the lesson" },
    { value: "misconception-check", label: "Misconception probe", hint: "Items designed to surface known misconceptions" },
    { value: "quick-write", label: "Quick write", hint: "Two-minute focused writing prompt" },
    { value: "retrieval-practice", label: "Retrieval practice set", hint: "Low-stakes recall to strengthen memory" },
    { value: "muddiest-point", label: "Muddiest-point reflection", hint: "What was most confusing and why?" },
    { value: "one-minute-paper", label: "One-minute paper", hint: "Takeaway + lingering question" },
    { value: "formative-checkpoint", label: "Check for understanding", hint: "Quick polling/signaling mid-lesson" },
  ],
  theory: [
    { value: "concept-map", label: "Concept map (Constructivism)", hint: "Visual web showing how ideas connect" },
    { value: "scaffolded-problem", label: "Scaffolded problem (Vygotsky ZPD)", hint: "Tiered hints in the zone of proximal development" },
    { value: "kwl-chart", label: "K-W-L chart", hint: "Know · Want to know · Learned" },
    { value: "frayer-model", label: "Frayer model (cognitive)", hint: "Definition · characteristics · examples · non-examples" },
    { value: "self-assessment", label: "Metacognitive self-assessment", hint: "Rate confidence + explain reasoning" },
    { value: "error-analysis", label: "Error analysis", hint: "Diagnose & correct a flawed sample" },
    { value: "dok-ladder", label: "DOK ladder (Bloom)", hint: "Same topic, recall → extended thinking" },
    { value: "kolb-cycle", label: "Kolb experiential cycle", hint: "Experience → reflect → conceptualize → experiment" },
    { value: "case-study", label: "Case study analysis (Kolb)", hint: "Apply concepts to a real-world scenario" },
    { value: "socratic-seminar", label: "Socratic seminar", hint: "Student-led inquiry discussion" },
    { value: "peer-feedback", label: "Peer feedback protocol (Danielson)", hint: "Structured critique against rubric" },
    { value: "questioning-protocol", label: "High-level questioning protocol (Danielson)", hint: "Pre-planned Bloom-tiered questions" },
  ],
};

const ALL_TYPES = Object.values(TYPES_BY_CATEGORY).flat();
const labelFor = (v: string) => ALL_TYPES.find(o => o.value === v)?.label || v;

type Step = "goal" | "category" | "type" | "clarify" | "preview";

interface ClarQ { question: string; suggestions: string[] }
interface ClarA { question: string; answer: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonPlanId: string;
  onCreated: (assignmentId: string) => void;
}

export default function AssignmentBrainstormDialog({ open, onOpenChange, lessonPlanId, onCreated }: Props) {
  const [step, setStep] = useState<Step>("goal");
  const [learningGoal, setLearningGoal] = useState("");
  const [goalSeeded, setGoalSeeded] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [assignmentType, setAssignmentType] = useState<string>("");
  const [loadingQs, setLoadingQs] = useState(false);
  const [questions, setQuestions] = useState<ClarQ[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("goal");
      setCategory(null);
      setAssignmentType("");
      setQuestions([]);
      setAnswers([]);
      setGoalSeeded(false);
      setPreview(null);
    }
  }, [open]);

  // Seed learning goal from lesson objectives once
  useEffect(() => {
    if (!open || goalSeeded || !lessonPlanId) return;
    (async () => {
      const { data } = await supabase
        .from("lesson_plans")
        .select("objectives")
        .eq("id", lessonPlanId)
        .single();
      const obj = (data?.objectives || "").toString().trim();
      if (obj && !learningGoal) setLearningGoal(obj);
      setGoalSeeded(true);
    })();
  }, [open, lessonPlanId, goalSeeded, learningGoal]);

  const fetchClarifyingQuestions = async () => {
    setLoadingQs(true);
    setQuestions([]);
    setAnswers([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-assignment", {
        body: {
          lessonPlanId,
          mode: "clarify",
          assignmentType,
          learningGoal,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const qs: ClarQ[] = data?.questions || [];
      if (!qs.length) { toast.error("AI returned no questions"); return; }
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(""));
      setStep("clarify");
    } catch (e: any) {
      toast.error(e?.message || "Failed to get clarifying questions");
    } finally {
      setLoadingQs(false);
    }
  };

  const generateFull = async () => {
    setGenerating(true);
    try {
      const clarifications: ClarA[] = questions
        .map((q, i) => ({ question: q.question, answer: (answers[i] || "").trim() }))
        .filter(c => c.answer.length > 0);

      const { data, error } = await supabase.functions.invoke("generate-assignment", {
        body: {
          lessonPlanId,
          mode: "full",
          assignmentType,
          learningGoal,
          clarifications,
          teacherIdea: learningGoal,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreview({ ...data.assignment, _clarifications: clarifications });
      setStep("preview");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate assignment");
    } finally {
      setGenerating(false);
    }
  };

  const savePreview = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const a = preview;
      const { data: inserted, error: insErr } = await (supabase.from("lesson_assignments") as any).insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        lesson_plan_id: lessonPlanId,
        title: a.title,
        assignment_type: a.assignment_type || assignmentType,
        instructions: a.instructions || "",
        points_possible: a.points_possible ?? 100,
        materials: a.materials || [],
        rubric: a.rubric || [],
        ai_metadata: {
          mode: "goal→category→type→clarify→preview→full",
          model: "google/gemini-3-flash-preview",
          category,
          type: assignmentType,
          learningGoal,
          clarifications: a._clarifications || [],
        },
      }).select("id").single();
      if (insErr) throw insErr;
      toast.success("Assignment saved");
      onCreated(inserted.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save assignment");
    } finally {
      setSaving(false);
    }
  };

  const titleByStep: Record<Step, string> = {
    goal: "What evidence of learning do you want to collect?",
    category: "Choose an assessment family",
    type: `Choose a ${category === "traditional" ? "traditional" : category === "formative" ? "formative" : "theory-anchored"} format`,
    clarify: `Tune the ${labelFor(assignmentType).toLowerCase()}`,
    preview: "Preview assignment",
  };
  const iconByStep: Record<Step, any> = { goal: Target, category: Layers, type: ListChecks, clarify: MessageCircleQuestion, preview: Eye };
  const StepIcon = iconByStep[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StepIcon className="h-4 w-4 text-primary" />
            {titleByStep[step]}
          </DialogTitle>
          <DialogDescription>
            {step === "goal" && "Describe the specific learning evidence you need from students. The AI will use this to shape the assessment."}
            {step === "category" && "Pick the family of assessment that best matches your goal."}
            {step === "type" && "Pick a specific format. The AI will then ask a few clarifying questions before building it."}
            {step === "clarify" && "Answer (or skip) any of these. Each shapes the final assignment."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — Learning goal */}
        {step === "goal" && (
          <div className="flex-1 overflow-y-auto space-y-3">
            <Label className="text-xs">Learning goal / evidence of learning</Label>
            <Textarea
              value={learningGoal}
              onChange={e => setLearningGoal(e.target.value)}
              rows={6}
              placeholder="e.g. Students explain how the structures of plant cells support photosynthesis, using evidence from the onion-cell lab."
            />
            <div className="flex justify-end">
              <Button onClick={() => setStep("category")} disabled={learningGoal.trim().length < 5} className="gap-2">
                Next <Layers className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Category */}
        {step === "category" && (
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="grid gap-2">
              {CATEGORIES.map(c => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => { setCategory(c.key); setAssignmentType(""); setStep("type"); }}
                    className={`text-left rounded-lg border p-3 transition hover:bg-muted/40 ${
                      category === c.key ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <Icon className="h-4 w-4 text-primary" /> {c.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{c.blurb}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-start border-t border-border/60 pt-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("goal")} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Specific type */}
        {step === "type" && category && (
          <div className="flex-1 overflow-y-auto space-y-2">
            <div className="grid gap-2">
              {TYPES_BY_CATEGORY[category].map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setAssignmentType(t.value)}
                  className={`text-left rounded-lg border p-3 transition hover:bg-muted/40 ${
                    assignmentType === t.value ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border/60"
                  }`}
                >
                  <div className="font-medium text-sm">{t.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.hint}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("category")} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={fetchClarifyingQuestions} disabled={!assignmentType || loadingQs} className="gap-2">
                {loadingQs ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircleQuestion className="h-4 w-4" />}
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Clarifying questions */}
        {step === "clarify" && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="space-y-2">
                <Label className="text-sm">{q.question}</Label>
                {q.suggestions?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {q.suggestions.map((s, si) => (
                      <button
                        key={si}
                        type="button"
                        onClick={() => setAnswers(a => { const n = [...a]; n[i] = s; return n; })}
                        className={`text-xs rounded-full border px-2.5 py-1 transition ${
                          answers[i] === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 hover:bg-muted/50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  value={answers[i] || ""}
                  onChange={e => setAnswers(a => { const n = [...a]; n[i] = e.target.value; return n; })}
                  placeholder="Or type your own answer…"
                  className="h-8 text-sm"
                />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <Button variant="ghost" size="sm" onClick={() => setStep("type")} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={generateFull} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Preview assignment
              </Button>
            </div>
          </div>
        )}

        {/* Step 5 — Preview */}
        {step === "preview" && preview && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold">{preview.title}</h3>
                <Badge variant="secondary" className="text-[10px]">{preview.assignment_type || assignmentType}</Badge>
                <Badge variant="outline" className="text-[10px]">{preview.points_possible ?? 100} pts</Badge>
              </div>
            </div>

            {preview.instructions && (
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Instructions</Label>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none mt-1 text-sm"
                  dangerouslySetInnerHTML={{ __html: preview.instructions }}
                />
              </div>
            )}

            {Array.isArray(preview.materials) && preview.materials.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Materials</Label>
                <ul className="list-disc ml-5 mt-1 text-sm space-y-0.5">
                  {preview.materials.map((m: string, i: number) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}

            {Array.isArray(preview.rubric) && preview.rubric.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Rubric</Label>
                <div className="mt-1 overflow-x-auto rounded-md border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left p-2">Criterion</th>
                        <th className="text-left p-2">Exemplary</th>
                        <th className="text-left p-2">Proficient</th>
                        <th className="text-left p-2">Developing</th>
                        <th className="text-left p-2">Beginning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rubric.map((r: any, i: number) => (
                        <tr key={i} className="border-t border-border/40 align-top">
                          <td className="p-2 font-medium">{r.criterion}</td>
                          <td className="p-2">{r.exemplary}</td>
                          <td className="p-2">{r.proficient}</td>
                          <td className="p-2">{r.developing}</td>
                          <td className="p-2">{r.beginning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 sticky bottom-0 bg-card">
              <Button variant="ghost" size="sm" onClick={() => setStep("clarify")} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generateFull} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Regenerate
                </Button>
                <Button onClick={savePreview} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save assignment
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
