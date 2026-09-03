import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { useNavigate, useParams } from "@/modules/curriculum/config/router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/modules/curriculum/config/supabase";
import { getQuestionBank, type QuestionBankItem } from "@/modules/curriculum/lib/question-bank";
import { useCanvasConfig } from "@/modules/curriculum/config/canvas-config";
import PushToCanvasDialog from "@/modules/curriculum/config/canvas-push-dialog";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { toast } from "sonner";
import {
  Loader2, Search, Plus, Minus, Save, Upload, ArrowLeft, GripVertical,
  Trash2, FileText, ClipboardCheck, Eye, EyeOff, ChevronUp, ChevronDown,
  CheckCircle2, XCircle, Circle, Download, Shuffle, Settings, Clock, Award, Copy,
} from "lucide-react";
import { exportBankQuizToDocx } from "@/modules/curriculum/lib/export-bank-quiz";
import { exportQuizToGoogleForm } from "@/modules/curriculum/lib/google-export";
import { useGoogleConnection } from "@/modules/curriculum/config/google-connection";
import { DOK_LEVELS, BLOOMS_LEVELS, ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS_FLAT } from "@/modules/curriculum/lib/idaho-standards-data";

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = DOMPurify.sanitize(html);
  return div.textContent || div.innerText || "";
}

interface QuizSettings {
  timeLimitMinutes: number | null;
  pointsPerQuestion: number | null;
  instructions: string;
  shuffleOnExport: boolean;
  showOneAtATime: boolean;
}

const DEFAULT_SETTINGS: QuizSettings = {
  timeLimitMinutes: null,
  pointsPerQuestion: null,
  instructions: "",
  shuffleOnExport: false,
  showOneAtATime: false,
};

interface SavedQuiz {
  id: string;
  title: string;
  description: string;
  question_ids: string[];
  settings: any;
  created_at: string;
  updated_at: string;
}

export default function QuizBuilder() {
  usePageTitle("Quiz Builder");
  const navigate = useNavigate();
  const { id: quizId } = useParams<{ id: string }>();
  const { config: canvasConfig, isConfigured: canvasConnected } = useCanvasConfig();

  // Bank questions
  const [allQuestions, setAllQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quiz state
  const [quizTitle, setQuizTitle] = useState("Custom Quiz");
  const [quizDescription, setQuizDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [exportingForm, setExportingForm] = useState(false);
  const { status: googleStatus } = useGoogleConnection();
  const [existingId, setExistingId] = useState<string | null>(quizId || null);
  const [settings, setSettings] = useState<QuizSettings>({ ...DEFAULT_SETTINGS });

  // Filters
  const [search, setSearch] = useState("");
  const [filterStandard, setFilterStandard] = useState("all");
  const [filterDok, setFilterDok] = useState("all");
  const [filterBlooms, setFilterBlooms] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Push
  const [showPush, setShowPush] = useState(false);

  // Saved quizzes list
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // Preview mode
  const [previewMode, setPreviewMode] = useState(false);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadingSaved(true);
    try {
      const [questions, savedRes] = await Promise.all([
        getQuestionBank(),
        supabase.from("custom_quizzes").select("*").order("updated_at", { ascending: false }) as any,
      ]);
      setAllQuestions(questions);
      if (savedRes.data) setSavedQuizzes(savedRes.data);

      if (quizId && savedRes.data) {
        const quiz = savedRes.data.find((q: SavedQuiz) => q.id === quizId);
        if (quiz) {
          setQuizTitle(quiz.title);
          setQuizDescription(quiz.description || "");
          setSelectedIds(quiz.question_ids || []);
          setExistingId(quiz.id);
          setSettings({ ...DEFAULT_SETTINGS, ...(quiz.settings || {}) });
        }
      }
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
      setLoadingSaved(false);
    }
  };

  const allStandards = useMemo(() => {
    const set = new Set<string>();
    allQuestions.forEach(q => q.standards.forEach(s => set.add(s.ngss_code)));
    return Array.from(set).sort();
  }, [allQuestions]);

  const filtered = useMemo(() => {
    return allQuestions.filter(q => {
      if (search) {
        const s = search.toLowerCase();
        if (!stripHtml(q.question_text).toLowerCase().includes(s)) return false;
      }
      if (filterStandard !== "all" && !q.standards.some(s => s.ngss_code === filterStandard)) return false;
      if (filterDok !== "all" && q.dok_level !== Number(filterDok)) return false;
      if (filterBlooms !== "all" && q.blooms_level !== filterBlooms) return false;
      if (filterType !== "all" && q.question_type !== filterType) return false;
      return true;
    });
  }, [allQuestions, search, filterStandard, filterDok, filterBlooms, filterType]);

  const selectedQuestions = useMemo(() => {
    const map = new Map(allQuestions.map(q => [q.id, q]));
    return selectedIds.map(id => map.get(id)).filter(Boolean) as QuestionBankItem[];
  }, [selectedIds, allQuestions]);

  const toggleQuestion = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const removeQuestion = (id: string) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  // Drag-and-drop handlers
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setSelectedIds(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const moveQuestion = (idx: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= selectedIds.length) return;
    setSelectedIds(prev => {
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!quizTitle.trim()) { toast.error("Enter a quiz title"); return; }
    if (selectedIds.length === 0) { toast.error("Add at least one question"); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        title: quizTitle.trim(),
        description: quizDescription.trim(),
        question_ids: selectedIds,
        settings: settings as any,
        updated_at: new Date().toISOString(),
      };

      if (existingId) {
        const { error } = await (supabase.from("custom_quizzes").update(payload).eq("id", existingId) as any);
        if (error) throw error;
        toast.success("Quiz saved!");
      } else {
        const { data, error } = await (supabase.from("custom_quizzes").insert({ ...payload, user_id: user.id }).select("id").single() as any);
        if (error) throw error;
        setExistingId(data.id);
        toast.success("Quiz created!");
      }

      const { data: updated } = await supabase.from("custom_quizzes").select("*").order("updated_at", { ascending: false }) as any;
      if (updated) setSavedQuizzes(updated);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    try {
      const { error } = await (supabase.from("custom_quizzes").delete().eq("id", id) as any);
      if (error) throw error;
      setSavedQuizzes(prev => prev.filter(q => q.id !== id));
      if (existingId === id) {
        setExistingId(null);
        setQuizTitle("Custom Quiz");
        setQuizDescription("");
        setSelectedIds([]);
      }
      toast.success("Quiz deleted");
    } catch {
      toast.error("Failed to delete quiz");
    }
  };

  const handleDuplicateQuiz = async (quiz: SavedQuiz) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase.from("custom_quizzes").insert({
        title: `${quiz.title} (Copy)`,
        description: quiz.description || "",
        question_ids: quiz.question_ids || [],
        settings: quiz.settings || {},
        user_id: user.id,
      }).select("*").single() as any);
      if (error) throw error;
      setSavedQuizzes(prev => [data, ...prev]);
      loadQuiz(data);
      toast.success("Quiz duplicated!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to duplicate quiz");
    }
  };

  const loadQuiz = (quiz: SavedQuiz) => {
    setQuizTitle(quiz.title);
    setQuizDescription(quiz.description || "");
    setSelectedIds(quiz.question_ids || []);
    setExistingId(quiz.id);
    setSettings({ ...DEFAULT_SETTINGS, ...(quiz.settings || {}) });
    setPreviewMode(false);
  };

  const startNew = () => {
    setExistingId(null);
    setQuizTitle("Custom Quiz");
    setQuizDescription("");
    setSelectedIds([]);
    setSettings({ ...DEFAULT_SETTINGS });
    setPreviewMode(false);
  };

  const totalPoints = selectedQuestions.reduce((sum, q) => sum + (settings.pointsPerQuestion ?? q.points_possible ?? 1), 0);

  const QUESTION_TYPES: Record<string, string> = {
    multiple_choice_question: "Multiple Choice",
    multiple_answers_question: "Select All",
    true_false_question: "True/False",
    short_answer_question: "Short Answer",
    essay_question: "Essay",
    matching_question: "Matching",
    fill_in_multiple_blanks_question: "Fill in Blanks",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Preview mode render
  if (previewMode) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <AppNavSheet />
            <Breadcrumbs items={[
              { label: "Question Bank", path: "/app/curriculum/question-bank" },
              { label: quizTitle, path: existingId ? `/app/curriculum/quiz-builder/${existingId}` : "/app/curriculum/quiz-builder" },
              { label: "Preview" },
            ]} />
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewMode(false)} className="gap-1.5">
                <EyeOff className="h-4 w-4" /> Exit Preview
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">{quizTitle}</h1>
            {quizDescription && <p className="text-muted-foreground mt-1">{quizDescription}</p>}
            <div className="flex items-center justify-center gap-3 mt-3">
              <Badge variant="secondary">{selectedQuestions.length} questions</Badge>
              <Badge variant="outline">{totalPoints} points</Badge>
              {settings.timeLimitMinutes && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" /> {settings.timeLimitMinutes} min
                </Badge>
              )}
            </div>
          </div>

          {settings.instructions && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Instructions</p>
                <p className="text-sm whitespace-pre-wrap">{settings.instructions}</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            {selectedQuestions.map((q, idx) => (
              <PreviewQuestion key={q.id} question={q} index={idx} questionTypes={QUESTION_TYPES} />
            ))}
          </div>

          {selectedQuestions.length === 0 && (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No questions to preview. Go back and add some questions.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <AppNavSheet />
          <Breadcrumbs items={[
            { label: "Question Bank", path: "/app/curriculum/question-bank" },
            { label: existingId ? quizTitle : "New Quiz" },
          ]} />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/app/curriculum/question-bank")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {selectedIds.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedIds(prev => {
                  const shuffled = [...prev];
                  for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                  }
                  return shuffled;
                });
                toast.success("Questions shuffled!");
              }} className="gap-1.5">
                <Shuffle className="h-4 w-4" /> Shuffle
              </Button>
            )}
            {selectedIds.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setPreviewMode(true)} className="gap-1.5">
                <Eye className="h-4 w-4" /> Preview
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Quiz
            </Button>
            {selectedIds.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => {
                exportBankQuizToDocx(quizTitle, selectedQuestions, true);
                toast.success("Exporting quiz to Word...");
              }} className="gap-1.5">
                <Download className="h-4 w-4" /> Export Word
              </Button>
            )}
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={exportingForm}
                className="gap-1.5"
                title={googleStatus?.connected ? "Export as Google Forms quiz" : "Connect Google in Settings → Google"}
                onClick={async () => {
                  if (!googleStatus?.connected) {
                    toast.error("Connect your Google account first (Settings → Google).");
                    return;
                  }
                  setExportingForm(true);
                  try {
                    const res = await exportQuizToGoogleForm(quizTitle, selectedQuestions as any);
                    toast.success("Exported to Google Forms", {
                      action: { label: "Open", onClick: () => window.open(res.editUrl, "_blank") },
                    });
                  } catch (e: any) {
                    toast.error(e?.message || "Google Forms export failed");
                  } finally {
                    setExportingForm(false);
                  }
                }}
              >
                {exportingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Export to Google Forms
              </Button>
            )}
            {canvasConnected && selectedIds.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowPush(true)} className="gap-1.5">
                <Upload className="h-4 w-4" /> Push to Canvas
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Quiz config + selected questions */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  <Label>Quiz Title</Label>
                  <Input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={quizDescription} onChange={e => setQuizDescription(e.target.value)} rows={2} />
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="secondary">{selectedIds.length} questions</Badge>
                  <Badge variant="outline">{totalPoints} points</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quiz Settings */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Quiz Settings</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Time Limit (min)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="No limit"
                      value={settings.timeLimitMinutes ?? ""}
                      onChange={e => setSettings(s => ({
                        ...s,
                        timeLimitMinutes: e.target.value ? Number(e.target.value) : null,
                      }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Award className="h-3 w-3" /> Points Each
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="Use original"
                      value={settings.pointsPerQuestion ?? ""}
                      onChange={e => setSettings(s => ({
                        ...s,
                        pointsPerQuestion: e.target.value ? Number(e.target.value) : null,
                      }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Instructions for Students</Label>
                  <Textarea
                    placeholder="e.g. Read each question carefully. Show your work where applicable."
                    value={settings.instructions}
                    onChange={e => setSettings(s => ({ ...s, instructions: e.target.value }))}
                    rows={2}
                    className="text-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Shuffle on export</Label>
                  <Switch
                    checked={settings.shuffleOnExport}
                    onCheckedChange={v => setSettings(s => ({ ...s, shuffleOnExport: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show one question at a time</Label>
                  <Switch
                    checked={settings.showOneAtATime}
                    onCheckedChange={v => setSettings(s => ({ ...s, showOneAtATime: v }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Selected questions with drag-and-drop */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-2">Selected Questions</p>
                <p className="text-[10px] text-muted-foreground mb-2">Drag to reorder or use arrows</p>
                {selectedIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No questions selected. Browse and add from the right panel.
                  </p>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-1">
                      {selectedQuestions.map((q, idx) => (
                        <div
                          key={q.id}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-start gap-1.5 p-2 rounded group transition-colors ${
                            dragIdx === idx ? "opacity-40" : ""
                          } ${dragOverIdx === idx && dragIdx !== idx ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab mt-0.5 shrink-0" />
                          <span className="text-xs text-muted-foreground mt-0.5 w-4 shrink-0">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs line-clamp-2">{stripHtml(q.question_text)}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {q.standards.slice(0, 1).map(s => (
                                <Badge key={s.ngss_code} variant="outline" className="text-[9px] px-1 py-0">{s.ngss_code}</Badge>
                              ))}
                              <span className="text-[10px] text-muted-foreground">{q.points_possible || 1}pt</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                            <Button
                              variant="ghost" size="icon"
                              className="h-5 w-5"
                              onClick={() => moveQuestion(idx, "up")}
                              disabled={idx === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-5 w-5"
                              onClick={() => moveQuestion(idx, "down")}
                              disabled={idx === selectedIds.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                            onClick={() => removeQuestion(q.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Saved quizzes */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Saved Quizzes</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={startNew}>
                    <Plus className="h-3 w-3" /> New
                  </Button>
                </div>
                {loadingSaved ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : savedQuizzes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No saved quizzes yet</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {savedQuizzes.map(q => (
                      <div
                        key={q.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer group hover:bg-muted/50 ${existingId === q.id ? "bg-primary/10 border border-primary/20" : ""}`}
                        onClick={() => loadQuiz(q)}
                      >
                        <ClipboardCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{q.title}</p>
                          <p className="text-[10px] text-muted-foreground">{q.question_ids?.length || 0} questions</p>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground"
                          onClick={e => { e.stopPropagation(); handleDuplicateQuiz(q); }}
                          title="Duplicate quiz"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={e => { e.stopPropagation(); handleDeleteQuiz(q.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Question browser */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search questions..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={filterStandard} onValueChange={setFilterStandard}>
                    <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Standard" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Standards</SelectItem>
                      {allStandards.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterDok} onValueChange={setFilterDok}>
                    <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue placeholder="DOK" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All DOK</SelectItem>
                      {[1, 2, 3, 4].map(d => <SelectItem key={d} value={String(d)}>DOK {d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterBlooms} onValueChange={setFilterBlooms}>
                    <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Bloom's" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Bloom's</SelectItem>
                      {BLOOMS_LEVELS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {Object.entries(QUESTION_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">{filtered.length} questions found</p>
              </CardContent>
            </Card>

            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-1.5">
                {filtered.map(q => {
                  const isSelected = selectedIds.includes(q.id);
                  return (
                    <Card
                      key={q.id}
                      className={`cursor-pointer transition-all hover:shadow-sm ${isSelected ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
                      onClick={() => toggleQuestion(q.id)}
                    >
                      <CardContent className="p-3 flex items-start gap-3">
                        <Checkbox checked={isSelected} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2">{stripHtml(q.question_text)}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {q.standards.map(s => (
                              <Badge key={s.ngss_code} variant="outline" className="text-[10px] px-1.5 py-0">{s.ngss_code}</Badge>
                            ))}
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {QUESTION_TYPES[q.question_type] || q.question_type}
                            </Badge>
                            {q.dok_level && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">DOK {q.dok_level}</Badge>
                            )}
                            {q.blooms_level && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{q.blooms_level}</Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">{q.points_possible || 1}pt</span>
                          </div>
                        </div>
                        {isSelected ? (
                          <Badge className="shrink-0 text-[10px]">Added</Badge>
                        ) : (
                          <Plus className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No questions match your filters</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {canvasConnected && canvasConfig && (
        <PushToCanvasDialog
          open={showPush}
          onOpenChange={setShowPush}
          questions={selectedQuestions}
          config={canvasConfig}
        />
      )}
    </div>
  );
}

/* ─── Preview Question Component ─── */

function PreviewQuestion({
  question,
  index,
  questionTypes,
}: {
  question: QuestionBankItem;
  index: number;
  questionTypes: Record<string, string>;
}) {
  const answers = (question.answers || []) as any[];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="bg-primary text-primary-foreground rounded-full h-7 w-7 flex items-center justify-center text-sm font-bold shrink-0">
            {index + 1}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {questionTypes[question.question_type] || question.question_type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {question.points_possible || 1} {(question.points_possible || 1) === 1 ? "point" : "points"}
              </Badge>
              {question.dok_level && (
                <Badge variant="outline" className="text-xs">DOK {question.dok_level}</Badge>
              )}
              {question.standards.map(s => (
                <Badge key={s.ngss_code} variant="outline" className="text-xs">{s.ngss_code}</Badge>
              ))}
            </div>
            <div
              className="text-sm leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.question_text) }}
            />
          </div>
        </div>

        {/* Answer choices */}
        {(question.question_type === "multiple_choice_question" ||
          question.question_type === "multiple_answers_question" ||
          question.question_type === "true_false_question") && answers.length > 0 && (
          <div className="ml-10 space-y-2">
            {answers.map((a: any, i: number) => {
              const isCorrect = a.weight > 0;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                    isCorrect
                      ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                      : "bg-muted/30 border-border"
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <span className="text-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a.html || a.text || "") }} />
                </div>
              );
            })}
          </div>
        )}

        {question.question_type === "short_answer_question" && answers.length > 0 && (
          <div className="ml-10 mt-2">
            <p className="text-xs text-muted-foreground mb-1">Accepted answers:</p>
            <div className="flex flex-wrap gap-1.5">
              {answers.map((a: any, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">{a.text}</Badge>
              ))}
            </div>
          </div>
        )}

        {question.question_type === "essay_question" && (
          <div className="ml-10 mt-2 border rounded-lg p-4 bg-muted/20">
            <p className="text-xs text-muted-foreground italic">Open-ended response — graded manually</p>
          </div>
        )}

        {question.question_type === "matching_question" && answers.length > 0 && (
          <div className="ml-10 mt-2 space-y-1.5">
            {answers.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{a.left}</span>
                <span className="text-muted-foreground">→</span>
                <Badge variant="secondary">{a.right}</Badge>
              </div>
            ))}
          </div>
        )}

        {question.question_type === "fill_in_multiple_blanks_question" && answers.length > 0 && (
          <div className="ml-10 mt-2">
            <p className="text-xs text-muted-foreground mb-1">Accepted fill-ins:</p>
            <div className="flex flex-wrap gap-1.5">
              {answers.map((a: any, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {a.blank_id}: {a.text}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
