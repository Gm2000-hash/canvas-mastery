import React, { useState, useEffect } from "react";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getQuestionBank, deleteFromBank, deleteManyFromBank, updateQuestion, backfillDokAndBlooms, type QuestionBankItem } from "@/modules/curriculum/lib/question-bank";
import { DOK_LEVELS, BLOOMS_LEVELS, ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS, ALL_IDAHO_STANDARDS_FLAT } from "@/modules/curriculum/lib/idaho-standards-data";
import { exportBankQuizToDocx } from "@/modules/curriculum/lib/export-bank-quiz";
import { exportToQTI } from "@/modules/curriculum/lib/export-qti";
import { toast } from "sonner";
import { Loader2, Search, Trash2, FlaskConical, BookOpen, ArrowLeft, FileText, Pencil, X, List, LayoutGrid, Leaf, Globe, Atom, ChevronRight, ChevronDown, Wand2, BarChart3, PieChart as PieChartIcon, Plus, Sparkles, Lightbulb, Upload, Hash, Landmark, ClipboardCheck, Tag } from "lucide-react";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import CreateQuestionDialog from "@/modules/curriculum/components/CreateQuestionDialog";
import GenerateContentDialog from "@/modules/curriculum/components/GenerateContentDialog";
import GenerateISATExamDialog from "@/modules/curriculum/components/GenerateISATExamDialog";
import ISATExamList from "@/modules/curriculum/components/ISATExamList";
import DokBloomsSuggestionsDialog from "@/modules/curriculum/components/DokBloomsSuggestionsDialog";
import { QuestionStandardsTagDialog } from "@/modules/curriculum/components/QuestionStandardsTagDialog";
import { supabase } from "@/modules/curriculum/config/supabase";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import PushToCanvasDialog from "@/modules/curriculum/config/canvas-push-dialog";
import { useCanvasConfig } from "@/modules/curriculum/config/canvas-config";
import { BentoHero } from "@/modules/curriculum/config/chrome-bento-hero";
import { useNavigate } from "@/modules/curriculum/config/router";
import { MathText } from "@/modules/curriculum/components/MathText";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useProfile } from "@/modules/curriculum/config/profile";
import { StandardsCoverageGrid, rigorTone } from "@/modules/curriculum/components/StandardsCoverageGrid";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

// NGSS discipline categories
interface DisciplineConfig {
  key: string;
  label: string;
  icon: typeof Leaf;
  coreIdeas: string[]; // All MS core idea codes for this discipline
}

const DISCIPLINES: DisciplineConfig[] = [
  { key: "LS", label: "Life Science", icon: Leaf, coreIdeas: ["MS-LS1", "MS-LS2", "MS-LS3", "MS-LS4"] },
  { key: "ESS", label: "Earth & Space Science", icon: Globe, coreIdeas: ["MS-ESS1", "MS-ESS2", "MS-ESS3"] },
  { key: "PS", label: "Physical Science", icon: Atom, coreIdeas: ["MS-PS1", "MS-PS2", "MS-PS3", "MS-PS4"] },
];

// Idaho subject categories for tiles
interface IdahoSubjectConfig {
  key: string;
  label: string;
  icon: typeof BookOpen;
}

const IDAHO_SUBJECTS: IdahoSubjectConfig[] = [
  { key: "ELA", label: "English Language Arts", icon: BookOpen },
  { key: "Math", label: "Mathematics", icon: Hash },
  { key: "Social Studies", label: "Social Studies", icon: Landmark },
];

function getIdahoSubjectGrade(code: string): { subject: string; grade: string } | null {
  const match = ALL_IDAHO_STANDARDS_FLAT.find(s => s.code === code);
  return match ? { subject: match.subject, grade: match.grade } : null;
}

function isIdahoCode(code: string): boolean {
  return ALL_IDAHO_STANDARDS_FLAT.some(s => s.code === code);
}


// Parse a standard code like "MS-LS1-3" into { discipline: "LS", coreIdea: "MS-LS1", full: "MS-LS1-3" }
function parseStandardCode(code: string) {
  // Match patterns like MS-LS1-3, HS-PS2-1, MS-ESS1-4
  const match = code.match(/^(MS|HS)-(LS|ESS|PS)(\d+)(-\d+)?$/i);
  if (!match) return null;
  const level = match[1].toUpperCase(); // MS or HS
  const discipline = match[2].toUpperCase(); // LS, ESS, PS
  const coreNum = match[3]; // 1, 2, 3, etc.
  return {
    level,
    discipline,
    coreNum,
    // The "core idea" grouping key — always use MS prefix for grouping
    coreIdea: `MS-${discipline}${coreNum}`,
    full: code,
  };
}

// Get the core idea label (e.g., "MS-LS1" from "MS-LS1" or "HS-LS1")
function getCoreIdeaFromCode(code: string): string | null {
  const parsed = parseStandardCode(code);
  return parsed ? parsed.coreIdea : null;
}

function getDisciplineForCode(code: string): string | null {
  const parsed = parseStandardCode(code);
  return parsed ? parsed.discipline : null;
}

/** Tailwind classes for a substandard badge based on count of DoK 3+ questions covering it. */
function rigorBadgeClass(stdQuestions: { dok_level: number | null }[]): string {
  const high = stdQuestions.filter(q => (q.dok_level ?? 0) >= 3).length;
  const tone = rigorTone(high);
  if (tone === "green") return "bg-success/15 text-success border border-success/30 hover:bg-success/25";
  if (tone === "yellow") return "bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25";
  return "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20";
}

const QuestionBank = () => {
  usePageTitle("Question Bank");
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDok, setFilterDok] = useState<string>("all");
  const [filterBlooms, setFilterBlooms] = useState<string>("all");
  const [filterStandard, setFilterStandard] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [chartMode, setChartMode] = useState<"bar" | "donut">("bar");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{ id: string; text: string } | null>(null);
  const [generateForStandard, setGenerateForStandard] = useState<{ code: string; description: string; framework: "NGSS" | "Idaho"; subject: string } | null>(null);
  const [showPushToCanvas, setShowPushToCanvas] = useState(false);
  const [showISATDialog, setShowISATDialog] = useState(false);
  const [isatRefreshKey, setIsatRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"questions" | "isat">("questions");
  const [quizTitle, setQuizTitle] = useState("Custom Quiz");
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const { config: canvasConfig, isConfigured: canvasConnected } = useCanvasConfig();
  const { profile } = useProfile();
  const teacherSubjects = profile?.subjects ?? [];
  const showNGSS = teacherSubjects.length === 0 || teacherSubjects.includes("Science");
  const activeIdahoSubjects = teacherSubjects.length === 0
    ? ["ELA", "Math", "Social Studies"]
    : teacherSubjects.filter(s => s !== "Science");
  const showIdaho = activeIdahoSubjects.length > 0;

  // Drill-down state for grouped view
  const [expandedDiscipline, setExpandedDiscipline] = useState<string | null>(null);
  const [expandedCoreIdea, setExpandedCoreIdea] = useState<string | null>(null);

  // Edit state
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null);
  const [editText, setEditText] = useState("");
  const [editPoints, setEditPoints] = useState(0);
  const [editType, setEditType] = useState("multiple_choice_question");
  const [editAnswers, setEditAnswers] = useState<{ id: number; text: string; weight: number; left?: string; right?: string }[]>([]);
  const [editStandards, setEditStandards] = useState<{ ngss_code: string; ngss_description: string }[]>([]);
  const [editDok, setEditDok] = useState<number | null>(null);
  const [editBlooms, setEditBlooms] = useState<string | null>(null);
  const [standardSearch, setStandardSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [suggestionsQuestion, setSuggestionsQuestion] = useState<QuestionBankItem | null>(null);
  const [tagQuestion, setTagQuestion] = useState<QuestionBankItem | null>(null);
  const [bulkTagging, setBulkTagging] = useState(false);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // DOK and Bloom's levels imported from shared data

  const QUESTION_TYPES = [
    { value: "multiple_choice_question", label: "Multiple Choice" },
    { value: "multiple_answers_question", label: "Multiple Correct Answers" },
    { value: "matching_question", label: "Matching" },
    { value: "fill_in_multiple_blanks_question", label: "Fill in the Blank" },
    { value: "short_answer_question", label: "Short Answer" },
    { value: "essay_question", label: "Essay" },
    { value: "true_false_question", label: "True/False" },
  ];

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await getQuestionBank();
      setQuestions(data);
    } catch {
      toast.error("Failed to load question bank");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuestions(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteFromBank(id);
      setQuestions(q => q.filter(item => item.id !== id));
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
      setSingleDeleteTarget(null);
      toast.success("Question removed");
    } catch {
      toast.error("Failed to delete question");
    }
  };

  const openEdit = (q: QuestionBankItem) => {
    setEditingQuestion(q);
    setEditText(stripHtml(q.question_text));
    setEditPoints(q.points_possible);
    setEditType(q.question_type);
    setEditAnswers((q.answers || []).map((a: any, i: number) => ({
      id: a.id || i,
      text: stripHtml(a.text || a.html || ""),
      weight: a.weight ?? 0,
      left: a.left || "",
      right: a.right || "",
    })));
    setEditStandards([...q.standards]);
    setEditDok(q.dok_level);
    setEditBlooms(q.blooms_level);
    setStandardSearch("");
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    setSaving(true);
    try {
      const savedAnswers = editAnswers.map(a => ({
        id: a.id,
        text: a.text,
        html: a.text,
        weight: a.weight,
        ...(editType === "matching_question" ? { left: a.left, right: a.right } : {}),
      }));
      await updateQuestion(
        editingQuestion.id,
        { question_text: editText, points_possible: editPoints, question_type: editType, answers: savedAnswers, dok_level: editDok, blooms_level: editBlooms },
        editStandards
      );
      setQuestions(prev => prev.map(q =>
        q.id === editingQuestion.id
          ? { ...q, question_text: editText, points_possible: editPoints, question_type: editType, answers: savedAnswers, dok_level: editDok, blooms_level: editBlooms, standards: editStandards }
          : q
      ));
      setEditingQuestion(null);
      toast.success("Question updated");
    } catch {
      toast.error("Failed to update question");
    } finally {
      setSaving(false);
    }
  };

  const removeStandard = (idx: number) => {
    setEditStandards(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = questions.filter(q => {
    if (search && !stripHtml(q.question_text).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDok !== "all" && String(q.dok_level) !== filterDok) return false;
    if (filterBlooms !== "all" && (q.blooms_level || "").toLowerCase() !== filterBlooms.toLowerCase()) return false;
    if (filterStandard !== "all") {
      if (filterStandard === "untagged") {
        if (q.standards.length > 0) return false;
      } else if (filterStandard.startsWith("disc:")) {
        const discKey = filterStandard.replace("disc:", "");
        if (!q.standards.some(s => getDisciplineForCode(s.ngss_code) === discKey)) return false;
      } else if (filterStandard.startsWith("idaho:")) {
        const [subject, grade] = filterStandard.replace("idaho:", "").split("|");
        const idahoCodes = ALL_IDAHO_STANDARDS_FLAT
          .filter(s => s.subject === subject && s.grade === grade)
          .map(s => s.code);
        if (!q.standards.some(s => idahoCodes.includes(s.ngss_code))) return false;
      } else {
        if (!q.standards.some(s => getCoreIdeaFromCode(s.ngss_code) === filterStandard)) return false;
      }
    }
    return true;
  });

  const selectAllFiltered = () => {
    if (filtered.every(q => selected.has(q.id))) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(q => next.delete(q.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(q => next.add(q.id));
        return next;
      });
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const count = await backfillDokAndBlooms();
      if (count > 0) {
        toast.success(`Auto-tagged ${count} question${count !== 1 ? "s" : ""} with DOK & Bloom's levels`);
        await loadQuestions();
      } else {
        toast.info("All questions already have DOK & Bloom's levels set");
      }
    } catch {
      toast.error("Failed to backfill levels");
    } finally {
      setBackfilling(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteTarget) return;
    setBulkDeleting(true);
    try {
      await deleteManyFromBank(bulkDeleteTarget.ids);
      setQuestions(prev => prev.filter(q => !bulkDeleteTarget.ids.includes(q.id)));
      setSelected(prev => {
        const next = new Set(prev);
        bulkDeleteTarget.ids.forEach(id => next.delete(id));
        return next;
      });
      toast.success(`Deleted ${bulkDeleteTarget.ids.length} question${bulkDeleteTarget.ids.length !== 1 ? "s" : ""}`);
      setBulkDeleteTarget(null);
    } catch {
      toast.error("Failed to delete questions");
    } finally {
      setBulkDeleting(false);
    }
  };

  /** AI-tag every selected question (or every untagged question if none selected) with NGSS standards. */
  const handleBulkAiTag = async () => {
    const MAX_BULK_TAG = 100;
    const targetIds = selected.size > 0
      ? [...selected]
      : questions.filter(q => q.standards.length === 0).map(q => q.id);

    if (targetIds.length === 0) {
      toast.info("Nothing to tag — every question already has standards.");
      return;
    }
    let targets = questions.filter(q => targetIds.includes(q.id));
    if (targets.length === 0) return;

    const totalRequested = targets.length;
    if (totalRequested > MAX_BULK_TAG) {
      targets = targets.slice(0, MAX_BULK_TAG);
      toast.info(
        `AI tagging is limited to ${MAX_BULK_TAG} questions per run. Tagging the first ${MAX_BULK_TAG} of ${totalRequested} — run again to continue.`
      );
    }

    setBulkTagging(true);
    let tagged = 0;
    let skipped = 0;
    try {
      // Process in chunks of 10 to keep the AI request payload small
      const chunkSize = 10;
      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        const { data, error } = await supabase.functions.invoke("standards-tagger", {
          body: {
            questions: chunk.map((q, idx) => ({ id: idx, question_text: stripHtml(q.question_text) })),
            framework: "ngss",
          },
        });
        if (error) throw error;

        const tagsByIdx: Record<number, { code: string; description: string }[]> =
          (data?.tags || []).reduce((acc: any, t: any) => {
            acc[t.id] = t.standards || [];
            return acc;
          }, {});

        // Persist results
        await Promise.all(chunk.map(async (q, idx) => {
          const newTags = tagsByIdx[idx] || [];
          if (newTags.length === 0) { skipped++; return; }
          const standards = newTags.map(t => ({ ngss_code: t.code, ngss_description: t.description }));
          await updateQuestion(q.id, {}, standards);
          tagged++;
          // Update local state immediately
          setQuestions(prev => prev.map(item =>
            item.id === q.id ? { ...item, standards } : item
          ));
        }));
      }
      if (tagged === 0) {
        toast.info("No confident NGSS matches found for the selected questions.");
      } else if (skipped > 0) {
        toast.success(`Tagged ${tagged} · ${skipped} skipped (no confident match)`);
      } else {
        toast.success(`Tagged ${tagged} question${tagged === 1 ? "" : "s"} with NGSS standards`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Bulk AI tagging failed");
    } finally {
      setBulkTagging(false);
    }
  };

  const handleExport = async () => {
    const selectedQuestions = questions.filter(q => selected.has(q.id));
    if (selectedQuestions.length === 0) return;
    setExporting(true);
    try {
      await exportBankQuizToDocx(quizTitle, selectedQuestions, includeAnswerKey);
      toast.success("Quiz exported!");
      setShowExportDialog(false);
    } catch {
      toast.error("Failed to export quiz");
    } finally {
      setExporting(false);
    }
  };

  const handleExportQTI = async () => {
    const selectedQuestions = questions.filter(q => selected.has(q.id));
    if (selectedQuestions.length === 0) return;
    setExporting(true);
    try {
      await exportToQTI(quizTitle, selectedQuestions);
      toast.success("QTI package exported! Import this .zip file into Mastery Connect.");
      setShowExportDialog(false);
    } catch {
      toast.error("Failed to export QTI package");
    } finally {
      setExporting(false);
    }
  };

  // Build discipline → coreIdea → questions hierarchy
  // HS standards are grouped under their MS counterpart core idea
  const buildHierarchy = () => {
    const hierarchy: Map<string, Map<string, { questionIds: Set<string>; descriptions: Set<string> }>> = new Map();
    const untagged: QuestionBankItem[] = [];

    for (const disc of DISCIPLINES) {
      const discMap = new Map<string, { questionIds: Set<string>; descriptions: Set<string> }>();
      for (const ci of disc.coreIdeas) {
        discMap.set(ci, { questionIds: new Set(), descriptions: new Set() });
      }
      hierarchy.set(disc.key, discMap);
    }

    // Idaho hierarchy: subject → grade → { questionIds, standards map }
    const idahoHierarchy: Map<string, Map<string, { questionIds: Set<string>; standards: Map<string, { code: string; description: string; questionIds: Set<string> }> }>> = new Map();
    for (const subj of activeIdahoSubjects) {
      const subjMap = new Map<string, { questionIds: Set<string>; standards: Map<string, { code: string; description: string; questionIds: Set<string> }> }>();
      const subjGrades = ALL_IDAHO_STANDARDS.filter(gs => gs.subject === subj);
      for (const gs of subjGrades) {
        const stdMap = new Map<string, { code: string; description: string; questionIds: Set<string> }>();
        for (const std of gs.standards) {
          stdMap.set(std.code, { code: std.code, description: std.description, questionIds: new Set() });
        }
        subjMap.set(gs.grade, { questionIds: new Set(), standards: stdMap });
      }
      idahoHierarchy.set(subj, subjMap);
    }

    for (const q of filtered) {
      if (q.standards.length === 0) {
        untagged.push(q);
        continue;
      }

      let hasRecognizedTag = false;

      for (const s of q.standards) {
        // Try NGSS
        const discipline = getDisciplineForCode(s.ngss_code);
        const coreIdea = getCoreIdeaFromCode(s.ngss_code);
        if (discipline && coreIdea) {
          hasRecognizedTag = true;
          const discMap = hierarchy.get(discipline);
          if (discMap) {
            if (!discMap.has(coreIdea)) {
              discMap.set(coreIdea, { questionIds: new Set(), descriptions: new Set() });
            }
            const group = discMap.get(coreIdea)!;
            group.questionIds.add(q.id);
            if (s.ngss_description) group.descriptions.add(s.ngss_description);
          }
        }

        // Try Idaho
        const idahoMatch = getIdahoSubjectGrade(s.ngss_code);
        if (idahoMatch) {
          hasRecognizedTag = true;
          const subjMap = idahoHierarchy.get(idahoMatch.subject);
          if (subjMap) {
            const gradeGroup = subjMap.get(idahoMatch.grade);
            if (gradeGroup) {
              gradeGroup.questionIds.add(q.id);
              const stdEntry = gradeGroup.standards.get(s.ngss_code);
              if (stdEntry) stdEntry.questionIds.add(q.id);
            }
          }
        }
      }

      if (!hasRecognizedTag) {
        untagged.push(q);
      }
    }

    return { hierarchy, idahoHierarchy, untagged };
  };

  const { hierarchy, idahoHierarchy, untagged } = buildHierarchy();

  // Count questions per NGSS discipline
  const disciplineCounts = (discKey: string) => {
    const discMap = hierarchy.get(discKey);
    if (!discMap) return 0;
    const ids = new Set<string>();
    for (const group of discMap.values()) {
      group.questionIds.forEach(id => ids.add(id));
    }
    return ids.size;
  };

  // Count questions per Idaho subject
  const idahoSubjectCounts = (subjKey: string) => {
    const subjMap = idahoHierarchy.get(subjKey);
    if (!subjMap) return 0;
    const ids = new Set<string>();
    for (const gradeGroup of subjMap.values()) {
      gradeGroup.questionIds.forEach(id => ids.add(id));
    }
    return ids.size;
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(q => selected.has(q.id));

  const questionCard = (q: QuestionBankItem, keyPrefix: string) => (
    <Card key={`${keyPrefix}-${q.id}`} className={`group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${selected.has(q.id) ? "ring-2 ring-primary" : ""}`} onClick={() => toggleSelect(q.id)}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-3">
          <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} onClick={e => e.stopPropagation()} className="mt-0.5" />
          <MathText text={q.question_text} className="text-sm text-foreground flex-1" inline />
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary" onClick={e => { e.stopPropagation(); setTagQuestion(q); }} title="Tag NGSS standards">
              <Tag className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 hover:text-amber-700" onClick={e => { e.stopPropagation(); setSuggestionsQuestion(q); }} title="AI DOK/Bloom's suggestions">
              <Lightbulb className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); openEdit(q); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setSingleDeleteTarget({ id: q.id, text: stripHtml(q.question_text).slice(0, 80) }); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-7">
          {q.standards.map(s => (
            <Badge key={s.ngss_code} variant="outline" className="text-xs">{s.ngss_code}</Badge>
          ))}
          {q.dok_level && (
            <Badge variant="secondary" className="text-xs">DOK {q.dok_level}</Badge>
          )}
          {q.blooms_level && (
            <Badge variant="secondary" className="text-xs capitalize">{q.blooms_level}</Badge>
          )}
          {q.source_course && (
            <span className="text-xs text-muted-foreground">
              {q.source_course}{q.source_quiz ? ` · ${q.source_quiz}` : ""}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{q.points_possible} pts</span>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-white glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Question Bank" }]} />
      </header>

      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6 bg-page-green border-warning-foreground border-0">
        <BentoHero
          eyebrow="Question Bank"
          title={<>Assessments,<br/>tagged and ready.</>}
          subtitle="Browse, search, and manage your library of NGSS / Idaho-aligned assessment questions."
          stats={[
            { label: "Questions", value: questions.length },
            { label: "Tagged", value: questions.filter(q => q.standards.length > 0).length },
            { label: "Untagged", value: questions.filter(q => q.standards.length === 0).length },
          ]}
          primaryAction={{
            label: "Create Question",
            icon: Plus,
            onClick: () => setShowCreateDialog(true),
            variant: "ink",
          }}
          secondaryActions={[
            { label: "Quiz Builder", icon: ClipboardCheck, onClick: () => navigate("/app/curriculum/quiz-builder") },
          ]}
          sideTiles={[
            {
              variant: "coral",
              eyebrow: "AI",
              title: "Generate Sample",
              body: "Spin up new questions for any standard in seconds.",
              action: { label: "Generate", icon: Sparkles, onClick: () => { setGenerateForStandard(null); setShowGenerateDialog(true); } },
            },
            {
              variant: "lilac",
              eyebrow: "ISAT",
              title: "Practice Exams",
              body: "Build full-length practice tests aligned to ISAT.",
              action: { label: "Open", icon: ClipboardCheck, onClick: () => setActiveTab("isat") },
            },
          ]}
        />
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "questions" | "isat")} className="w-full">
          <TabsList>
            <TabsTrigger value="questions" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Question Bank
            </TabsTrigger>
            <TabsTrigger value="isat" className="gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              ISAT Practice Exams
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "isat" ? (
          <ISATExamList
            refreshKey={isatRefreshKey}
            onTakeExam={(examId) => navigate(`/app/curriculum/isat-exams/${examId}`)}
            onGenerateNew={() => setShowISATDialog(true)}
          />
        ) : (
        <>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search questions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5 border-popover-foreground border-2">
              <Plus className="h-4 w-4" /> Create Question
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setGenerateForStandard(null); setShowGenerateDialog(true); }} className="gap-1.5 border-2 border-card-foreground">
              <Sparkles className="h-4 w-4" /> Generate Sample Questions
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/app/curriculum/quiz-builder")} className="gap-1.5 border-2 border-card-foreground">
              <ClipboardCheck className="h-4 w-4" /> Quiz Builder
            </Button>
            <Button variant={viewMode === "grouped" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grouped")} className="gap-1.5 border-card-foreground border-2">
              <LayoutGrid className="h-4 w-4" /> By Standard
            </Button>
            <Button variant={viewMode === "flat" ? "default" : "outline"} size="sm" onClick={() => setViewMode("flat")} className="gap-1.5 border-popover-foreground border-2">
              <List className="h-4 w-4" /> Flat List
            </Button>
            {questions.some(q => q.dok_level == null || q.blooms_level == null) && (
              <Button variant="outline" size="sm" onClick={handleBackfill} disabled={backfilling} className="gap-1.5">
                {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Auto-tag Levels
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 border-card-foreground border-0">
          <Select value={filterDok} onValueChange={setFilterDok}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
              <SelectValue placeholder="DOK Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All DOK Levels</SelectItem>
              {DOK_LEVELS.map(d => (
                <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterBlooms} onValueChange={setFilterBlooms}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
              <SelectValue placeholder="Bloom's Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bloom's Levels</SelectItem>
              {BLOOMS_LEVELS.map(b => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStandard} onValueChange={setFilterStandard}>
            <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Standards</SelectItem>
              <SelectItem value="untagged">Untagged</SelectItem>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">NGSS (Science)</div>
              {DISCIPLINES.map(disc => (
                <React.Fragment key={disc.key}>
                  <SelectItem value={`disc:${disc.key}`}>{disc.label}</SelectItem>
                  {disc.coreIdeas.map(ci => (
                    <SelectItem key={ci} value={ci} className="pl-8 text-muted-foreground">{ci}</SelectItem>
                  ))}
                </React.Fragment>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-1">Idaho Standards</div>
              {ALL_IDAHO_STANDARDS.map(gs => (
                <SelectItem key={`${gs.subject}|${gs.grade}`} value={`idaho:${gs.subject}|${gs.grade}`} className="text-muted-foreground">
                  {gs.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterDok !== "all" || filterBlooms !== "all" || filterStandard !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => { setFilterDok("all"); setFilterBlooms("all"); setFilterStandard("all"); }}>
              <X className="h-3.5 w-3.5" /> Clear Filters
            </Button>
          )}
          {selected.size === 0 && questions.some(q => q.standards.length === 0) && (() => {
            const untaggedCount = questions.filter(q => q.standards.length === 0).length;
            const willTag = Math.min(untaggedCount, 100);
            const label = untaggedCount > 100
              ? `Tag Untagged (${willTag} of ${untaggedCount})`
              : `Tag Untagged (${untaggedCount})`;
            return (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={handleBulkAiTag}
                disabled={bulkTagging}
                title="AI tagging runs on up to 100 questions at a time. Re-run to continue with the rest."
              >
                {bulkTagging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                {label}
              </Button>
            );
          })()}
          {selected.size > 0 && (
            <>
              <Button onClick={() => setShowExportDialog(true)} className="gap-2">
                <FileText className="h-4 w-4" />
                Create Quiz ({selected.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleBulkAiTag}
                disabled={bulkTagging}
                title="AI tagging runs on up to 100 questions at a time. Re-run to continue with the rest."
              >
                {bulkTagging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                AI Tag Standards ({selected.size > 100 ? `100 of ${selected.size}` : selected.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setBulkDeleteTarget({ ids: [...selected], label: `${selected.size} selected question${selected.size !== 1 ? "s" : ""}` })}
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selected.size})
              </Button>
              {canvasConnected && (
                <Button variant="outline" onClick={() => setShowPushToCanvas(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Push to Canvas ({selected.size})
                </Button>
              )}
            </>
          )}
        </div>

        {/* Distribution summary bar */}
        {questions.length > 0 && (() => {
          const dokHex = ["#34d399", "#38bdf8", "#fbbf24", "#fb7185"];
          const dokBg = ["bg-emerald-400", "bg-sky-400", "bg-amber-400", "bg-rose-400"];
          const dokData = [1, 2, 3, 4].map((level, i) => ({
            name: `DOK ${level}`, value: questions.filter(q => q.dok_level === level).length, fill: dokHex[i], bg: dokBg[i],
          })).filter(d => d.value > 0);
          const dokUnset = questions.filter(q => q.dok_level == null).length;
          if (dokUnset > 0) dokData.push({ name: "Unset", value: dokUnset, fill: "#94a3b8", bg: "bg-slate-400" });

          const bloomsLabels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
          const bloomsHex = ["#94a3b8", "#34d399", "#38bdf8", "#fbbf24", "#fb923c", "#fb7185"];
          const bloomsBg = ["bg-slate-400", "bg-emerald-400", "bg-sky-400", "bg-amber-400", "bg-orange-400", "bg-rose-400"];
          const bloomsData = bloomsLabels.map((level, i) => ({
            name: level, value: questions.filter(q => (q.blooms_level || "").toLowerCase() === level.toLowerCase()).length, fill: bloomsHex[i], bg: bloomsBg[i],
          })).filter(d => d.value > 0);
          const bloomsUnset = questions.filter(q => !q.blooms_level).length;
          if (bloomsUnset > 0) bloomsData.push({ name: "Unset", value: bloomsUnset, fill: "#94a3b8", bg: "bg-slate-400" });

          const Legend = ({ data }: { data: { name: string; value: number; bg: string }[] }) => (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {data.map(d => (
                <span key={d.name} className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${d.bg}`} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          );

          const DonutChart = ({ data }: { data: { name: string; value: number; fill: string; bg: string }[] }) => (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} strokeWidth={0}>
                    {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} question${value !== 1 ? "s" : ""}`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <Legend data={data} />
            </div>
          );

          return (
            <div className="space-y-2">
              <div className="flex justify-end">
                <div className="flex border rounded-md overflow-hidden">
                  <button className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${chartMode === "bar" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`} onClick={() => setChartMode("bar")}>
                    <BarChart3 className="h-3.5 w-3.5" /> Bar
                  </button>
                  <button className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${chartMode === "donut" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`} onClick={() => setChartMode("donut")}>
                    <PieChartIcon className="h-3.5 w-3.5" /> Donut
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">DOK Distribution</p>
                    {chartMode === "bar" ? (
                      <>
                        <div className="flex gap-0.5 h-5 rounded-full overflow-hidden bg-muted">
                          {dokData.map(d => (
                            <div key={d.name} style={{ width: `${(d.value / questions.length) * 100}%`, backgroundColor: d.fill }} className="transition-all" title={`${d.name}: ${d.value}`} />
                          ))}
                        </div>
                        <Legend data={dokData} />
                      </>
                    ) : (
                      <DonutChart data={dokData} />
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bloom's Distribution</p>
                    {chartMode === "bar" ? (
                      <>
                        <div className="flex gap-0.5 h-5 rounded-full overflow-hidden bg-muted">
                          {bloomsData.map(d => (
                            <div key={d.name} style={{ width: `${(d.value / questions.length) * 100}%`, backgroundColor: d.fill }} className="transition-all" title={`${d.name}: ${d.value}`} />
                          ))}
                        </div>
                        <Legend data={bloomsData} />
                      </>
                    ) : (
                      <DonutChart data={bloomsData} />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })()}

        {questions.length > 0 && (
          <StandardsCoverageGrid
            questions={questions}
            showNGSS={showNGSS}
            activeIdahoSubjects={showIdaho ? activeIdahoSubjects : []}
            onGapClick={(target) => {
              setGenerateForStandard(target);
              setShowGenerateDialog(true);
            }}
          />
        )}

        {/* Breadcrumb trail for grouped view */}
        {viewMode === "grouped" && (expandedDiscipline || expandedCoreIdea) && (
          <nav className="flex items-center gap-1.5 text-sm">
            <button
              className="text-primary hover:underline font-medium"
              onClick={() => { setExpandedDiscipline(null); setExpandedCoreIdea(null); }}
            >
              All Standards
            </button>
            {expandedDiscipline && expandedDiscipline !== "untagged" && (() => {
              // Check NGSS disciplines
              const disc = DISCIPLINES.find(d => d.key === expandedDiscipline);
              if (disc) return (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <button
                    className={`font-medium ${expandedCoreIdea ? "text-primary hover:underline" : "text-foreground"}`}
                    onClick={() => setExpandedCoreIdea(null)}
                  >
                    {disc.label}
                  </button>
                </>
              );
              // Check Idaho subjects
              if (expandedDiscipline.startsWith("idaho-")) {
                const subjKey = expandedDiscipline.replace("idaho-", "");
                const idahoSubj = IDAHO_SUBJECTS.find(s => s.key === subjKey);
                if (idahoSubj) return (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <button
                      className={`font-medium ${expandedCoreIdea ? "text-primary hover:underline" : "text-foreground"}`}
                      onClick={() => setExpandedCoreIdea(null)}
                    >
                      {idahoSubj.label}
                    </button>
                  </>
                );
              }
              return null;
            })()}
            {expandedDiscipline === "untagged" && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">Untagged</span>
              </>
            )}
            {expandedCoreIdea && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {expandedCoreIdea.match(/^\w+-(\d+)$/) ? `Grade ${expandedCoreIdea.split("-").pop()}` : expandedCoreIdea}
                </span>
              </>
            )}
          </nav>
        )}

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{questions.length === 0 ? "Your question bank is empty. Export a quiz to start building it!" : "No questions match your search."}</p>
            </CardContent>
          </Card>
        ) : viewMode === "grouped" ? (
          /* 3-tier grouped view: Discipline tiles → Core Ideas → Questions */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox checked={allFilteredSelected} onCheckedChange={selectAllFiltered} />
              <p className="text-sm text-muted-foreground">
                {allFilteredSelected ? "Deselect all" : "Select all"} · {filtered.length} unique question{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Standard tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* NGSS discipline tiles */}
              {showNGSS && DISCIPLINES.map(disc => {
                const count = disciplineCounts(disc.key);
                const isExpanded = expandedDiscipline === disc.key;
                const Icon = disc.icon;

                const discQuestionIds: string[] = [];
                const discMap = hierarchy.get(disc.key);
                if (discMap) {
                  for (const group of discMap.values()) {
                    group.questionIds.forEach(id => discQuestionIds.push(id));
                  }
                }
                const uniqueDiscIds = [...new Set(discQuestionIds)];
                const allDiscSelected = uniqueDiscIds.length > 0 && uniqueDiscIds.every(id => selected.has(id));

                let totalSubs = 0;
                let coveredSubs = 0;
                for (const ci of disc.coreIdeas) {
                  const subs = ALL_SUBSTANDARDS[ci] || [];
                  totalSubs += subs.length;
                  const group = discMap?.get(ci);
                  if (group) {
                    for (const sub of subs) {
                      const hasQ = filtered.some(q =>
                        group.questionIds.has(q.id) &&
                        q.standards.some(s => {
                          if (s.ngss_code === sub.code) return true;
                          const parsed = parseStandardCode(s.ngss_code);
                          if (!parsed || parsed.level !== "HS") return false;
                          return `MS-${parsed.discipline}${parsed.coreNum}-${s.ngss_code.match(/-(\d+)$/)?.[1]}` === sub.code;
                        })
                      );
                      if (hasQ) coveredSubs++;
                    }
                  }
                }
                const coveragePct = totalSubs > 0 ? Math.round((coveredSubs / totalSubs) * 100) : 0;

                return (
                  <Card
                    key={disc.key}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${isExpanded ? "ring-2 ring-primary col-span-1 sm:col-span-2 lg:col-span-3" : ""} ${count === 0 ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={() => {
                      if (count === 0) return;
                      setExpandedDiscipline(isExpanded ? null : disc.key);
                      setExpandedCoreIdea(null);
                    }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        {count > 0 && (
                          <Checkbox
                            checked={allDiscSelected}
                            onCheckedChange={() => {
                              setSelected(prev => {
                                const next = new Set(prev);
                                uniqueDiscIds.forEach(id => allDiscSelected ? next.delete(id) : next.add(id));
                                return next;
                              });
                            }}
                            onClick={e => e.stopPropagation()}
                            className="shrink-0"
                          />
                        )}
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{disc.label}</h3>
                            <Badge variant="outline" className="text-[10px]">NGSS</Badge>
                          </div>
                         <p className="text-sm text-muted-foreground">{count} question{count !== 1 ? "s" : ""} · {coveredSubs}/{totalSubs} standards covered ({coveragePct}%)</p>
                        </div>
                        {count > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                            title={`Delete all ${disc.label} questions`}
                            onClick={e => {
                              e.stopPropagation();
                              setBulkDeleteTarget({
                                ids: uniqueDiscIds,
                                label: `all ${uniqueDiscIds.length} ${disc.label} question${uniqueDiscIds.length !== 1 ? "s" : ""}`,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {count > 0 && (
                          isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-2 border-t border-border pt-4 overflow-x-hidden min-w-0" onClick={e => e.stopPropagation()}>
                          {Array.from(hierarchy.get(disc.key)?.entries() || [])
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([coreIdea, group]) => {
                              const isCoreExpanded = expandedCoreIdea === coreIdea;
                              const coreQuestions = filtered.filter(q => group.questionIds.has(q.id));
                              const firstDesc = Array.from(group.descriptions)[0] || "";

                              return (
                                <div key={coreIdea}>
                                  <div className="flex items-center gap-2">
                                    {coreQuestions.length > 0 && (
                                      <Checkbox
                                        checked={coreQuestions.length > 0 && coreQuestions.every(q => selected.has(q.id))}
                                        onCheckedChange={() => {
                                          const allSelected = coreQuestions.every(q => selected.has(q.id));
                                          setSelected(prev => {
                                            const next = new Set(prev);
                                            coreQuestions.forEach(q => allSelected ? next.delete(q.id) : next.add(q.id));
                                            return next;
                                          });
                                        }}
                                        className="shrink-0"
                                        onClick={e => e.stopPropagation()}
                                      />
                                    )}
                                    <button
                                      className="flex-1 flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                                      onClick={() => setExpandedCoreIdea(isCoreExpanded ? null : coreIdea)}
                                    >
                                      {isCoreExpanded ? <ChevronDown className="h-4 w-4 text-primary shrink-0" /> : <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="default" className="text-xs shrink-0">{coreIdea}</Badge>
                                          <span className="text-sm text-muted-foreground">({coreQuestions.length} question{coreQuestions.length !== 1 ? "s" : ""})</span>
                                        </div>
                                        {firstDesc && <p className="text-xs text-muted-foreground mt-1 break-words">{firstDesc}</p>}
                                      </div>
                                    </button>
                                    {coreQuestions.length > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                        title={`Delete all ${coreIdea} questions`}
                                        onClick={e => {
                                          e.stopPropagation();
                                          setBulkDeleteTarget({
                                            ids: coreQuestions.map(q => q.id),
                                            label: `all ${coreQuestions.length} question${coreQuestions.length !== 1 ? "s" : ""} for ${coreIdea}`,
                                          });
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>

                                  {isCoreExpanded && (
                                    <div className="space-y-3 mt-2 ml-6 border-l-2 border-primary/20 pl-4 overflow-x-hidden min-w-0">
                                      {(ALL_SUBSTANDARDS[coreIdea] || []).map(sub => {
                                        const subQuestions = coreQuestions.filter(q =>
                                          q.standards.some(s => s.ngss_code === sub.code) ||
                                          q.standards.some(s => {
                                            const parsed = parseStandardCode(s.ngss_code);
                                            if (!parsed || parsed.level !== "HS") return false;
                                            return `MS-${parsed.discipline}${parsed.coreNum}-${s.ngss_code.match(/-(\d+)$/)?.[1]}` === sub.code;
                                          })
                                        );
                                        return (
                                          <div key={sub.code}>
                                            <div className="flex items-start gap-2 py-1.5">
                                              <Badge
                                                variant={subQuestions.length > 0 ? "secondary" : "outline"}
                                                className={`text-xs shrink-0 mt-0.5 ${subQuestions.length > 0 ? rigorBadgeClass(subQuestions) : ""}`}
                                                title={subQuestions.length > 0 ? `${subQuestions.filter(q => (q.dok_level ?? 0) >= 3).length} of ${subQuestions.length} at DoK 3+` : undefined}
                                              >
                                                {sub.code}
                                              </Badge>
                                              <p className="text-xs text-muted-foreground flex-1 break-words">{sub.description}</p>
                                              {subQuestions.length > 0 && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-[10px] gap-1"
                                                    title={`Select all ${sub.code} questions`}
                                                    onClick={() => {
                                                      const allSelected = subQuestions.every(q => selected.has(q.id));
                                                      setSelected(prev => {
                                                        const next = new Set(prev);
                                                        subQuestions.forEach(q => allSelected ? next.delete(q.id) : next.add(q.id));
                                                        return next;
                                                      });
                                                    }}
                                                  >
                                                    <Checkbox checked={subQuestions.every(q => selected.has(q.id))} className="h-3 w-3" tabIndex={-1} />
                                                    {subQuestions.length} Q
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                                    title={`Delete all ${sub.code} questions`}
                                                    onClick={e => {
                                                      e.stopPropagation();
                                                      setBulkDeleteTarget({
                                                        ids: subQuestions.map(q => q.id),
                                                        label: `all ${subQuestions.length} question${subQuestions.length !== 1 ? "s" : ""} for ${sub.code}`,
                                                      });
                                                    }}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              )}
                                              {subQuestions.length === 0 && (
                                                <span className="text-xs text-muted-foreground shrink-0">—</span>
                                              )}
                                            </div>
                                            {subQuestions.length > 0 && (
                                              <div className="space-y-2 mt-1 ml-4">
                                                {subQuestions.map(q => questionCard(q, sub.code))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {coreQuestions.filter(q => {
                                        const subCodes = (ALL_SUBSTANDARDS[coreIdea] || []).map(s => s.code);
                                        return !q.standards.some(s => subCodes.includes(s.ngss_code) || (() => {
                                          const parsed = parseStandardCode(s.ngss_code);
                                          if (!parsed || parsed.level !== "HS") return false;
                                          return subCodes.includes(`MS-${parsed.discipline}${parsed.coreNum}-${s.ngss_code.match(/-(\d+)$/)?.[1]}`);
                                        })());
                                      }).length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground py-1.5">Other questions</p>
                                          <div className="space-y-2 ml-4">
                                            {coreQuestions.filter(q => {
                                              const subCodes = (ALL_SUBSTANDARDS[coreIdea] || []).map(s => s.code);
                                              return !q.standards.some(s => subCodes.includes(s.ngss_code) || (() => {
                                                const parsed = parseStandardCode(s.ngss_code);
                                                if (!parsed || parsed.level !== "HS") return false;
                                                return subCodes.includes(`MS-${parsed.discipline}${parsed.coreNum}-${s.ngss_code.match(/-(\d+)$/)?.[1]}`);
                                              })());
                                            }).map(q => questionCard(q, `${coreIdea}-other`))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Idaho subject tiles */}
              {showIdaho && IDAHO_SUBJECTS.filter(s => activeIdahoSubjects.includes(s.key)).map(subj => {
                const count = idahoSubjectCounts(subj.key);
                const isExpanded = expandedDiscipline === `idaho-${subj.key}`;
                const Icon = subj.icon;
                const subjMap = idahoHierarchy.get(subj.key);

                // Collect all question IDs
                const subjQuestionIds: string[] = [];
                if (subjMap) {
                  for (const gradeGroup of subjMap.values()) {
                    gradeGroup.questionIds.forEach(id => subjQuestionIds.push(id));
                  }
                }
                const uniqueSubjIds = [...new Set(subjQuestionIds)];
                const allSubjSelected = uniqueSubjIds.length > 0 && uniqueSubjIds.every(id => selected.has(id));

                // Coverage stats
                let totalStds = 0;
                let coveredStds = 0;
                const subjGrades = ALL_IDAHO_STANDARDS.filter(gs => gs.subject === subj.key);
                for (const gs of subjGrades) {
                  totalStds += gs.standards.length;
                  const gradeGroup = subjMap?.get(gs.grade);
                  if (gradeGroup) {
                    for (const [, std] of gradeGroup.standards) {
                      if (std.questionIds.size > 0) coveredStds++;
                    }
                  }
                }
                const coveragePct = totalStds > 0 ? Math.round((coveredStds / totalStds) * 100) : 0;

                return (
                  <Card
                    key={`idaho-${subj.key}`}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${isExpanded ? "ring-2 ring-primary col-span-1 sm:col-span-2 lg:col-span-3" : ""} ${count === 0 ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={() => {
                      if (count === 0) return;
                      setExpandedDiscipline(isExpanded ? null : `idaho-${subj.key}`);
                      setExpandedCoreIdea(null);
                    }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        {count > 0 && (
                          <Checkbox
                            checked={allSubjSelected}
                            onCheckedChange={() => {
                              setSelected(prev => {
                                const next = new Set(prev);
                                uniqueSubjIds.forEach(id => allSubjSelected ? next.delete(id) : next.add(id));
                                return next;
                              });
                            }}
                            onClick={e => e.stopPropagation()}
                            className="shrink-0"
                          />
                        )}
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{subj.label}</h3>
                            <Badge variant="outline" className="text-[10px]">Idaho</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{count} question{count !== 1 ? "s" : ""} · {coveredStds}/{totalStds} standards covered ({coveragePct}%)</p>
                        </div>
                        {count > 0 && (
                          isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Expanded: show grades */}
                      {isExpanded && subjMap && (
                        <div className="mt-4 space-y-2 border-t border-border pt-4 overflow-x-hidden min-w-0" onClick={e => e.stopPropagation()}>
                          {Array.from(subjMap.entries())
                            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                            .map(([grade, gradeGroup]) => {
                              const gradeKey = `${subj.key}-${grade}`;
                              const isGradeExpanded = expandedCoreIdea === gradeKey;
                              const gradeQuestions = filtered.filter(q => gradeGroup.questionIds.has(q.id));

                              return (
                                <div key={grade}>
                                  <div className="flex items-center gap-2">
                                    {gradeQuestions.length > 0 && (
                                      <Checkbox
                                        checked={gradeQuestions.length > 0 && gradeQuestions.every(q => selected.has(q.id))}
                                        onCheckedChange={() => {
                                          const allSelected = gradeQuestions.every(q => selected.has(q.id));
                                          setSelected(prev => {
                                            const next = new Set(prev);
                                            gradeQuestions.forEach(q => allSelected ? next.delete(q.id) : next.add(q.id));
                                            return next;
                                          });
                                        }}
                                        className="shrink-0"
                                        onClick={e => e.stopPropagation()}
                                      />
                                    )}
                                    <button
                                      className="flex-1 flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                                      onClick={() => setExpandedCoreIdea(isGradeExpanded ? null : gradeKey)}
                                    >
                                      {isGradeExpanded ? <ChevronDown className="h-4 w-4 text-primary shrink-0" /> : <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="default" className="text-xs shrink-0">Grade {grade}</Badge>
                                          <span className="text-sm text-muted-foreground">({gradeQuestions.length} question{gradeQuestions.length !== 1 ? "s" : ""})</span>
                                        </div>
                                      </div>
                                    </button>
                                    {gradeQuestions.length > 0 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                        title={`Delete all Grade ${grade} ${subj.label} questions`}
                                        onClick={e => {
                                          e.stopPropagation();
                                          setBulkDeleteTarget({
                                            ids: gradeQuestions.map(q => q.id),
                                            label: `all ${gradeQuestions.length} Grade ${grade} ${subj.label} question${gradeQuestions.length !== 1 ? "s" : ""}`,
                                          });
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>

                                  {/* Expanded: show individual standards with questions */}
                                  {isGradeExpanded && (
                                    <div className="space-y-3 mt-2 ml-6 border-l-2 border-primary/20 pl-4 overflow-x-hidden min-w-0">
                                      {Array.from(gradeGroup.standards.entries()).map(([code, std]) => {
                                        const stdQuestions = filtered.filter(q => std.questionIds.has(q.id));
                                        return (
                                          <div key={code}>
                                            <div className="flex items-start gap-2 py-1.5">
                                              <Badge
                                                variant={stdQuestions.length > 0 ? "secondary" : "outline"}
                                                className={`text-xs shrink-0 mt-0.5 ${stdQuestions.length > 0 ? rigorBadgeClass(stdQuestions) : ""}`}
                                                title={stdQuestions.length > 0 ? `${stdQuestions.filter(q => (q.dok_level ?? 0) >= 3).length} of ${stdQuestions.length} at DoK 3+` : undefined}
                                              >
                                                {code}
                                              </Badge>
                                              <p className="text-xs text-muted-foreground flex-1 break-words">{std.description}</p>
                                              {stdQuestions.length > 0 && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-[10px] gap-1"
                                                    title={`Select all ${code} questions`}
                                                    onClick={() => {
                                                      const allSelected = stdQuestions.every(q => selected.has(q.id));
                                                      setSelected(prev => {
                                                        const next = new Set(prev);
                                                        stdQuestions.forEach(q => allSelected ? next.delete(q.id) : next.add(q.id));
                                                        return next;
                                                      });
                                                    }}
                                                  >
                                                    <Checkbox checked={stdQuestions.every(q => selected.has(q.id))} className="h-3 w-3" tabIndex={-1} />
                                                    {stdQuestions.length} Q
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                                    title={`Delete all ${code} questions`}
                                                    onClick={e => {
                                                      e.stopPropagation();
                                                      setBulkDeleteTarget({
                                                        ids: stdQuestions.map(q => q.id),
                                                        label: `all ${stdQuestions.length} question${stdQuestions.length !== 1 ? "s" : ""} for ${code}`,
                                                      });
                                                    }}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              )}
                                              {stdQuestions.length === 0 && (
                                                <span className="text-xs text-muted-foreground shrink-0">—</span>
                                              )}
                                            </div>
                                            {stdQuestions.length > 0 && (
                                              <div className="space-y-2 mt-1 ml-4">
                                                {stdQuestions.map(q => questionCard(q, code))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Untagged section */}
            {untagged.length > 0 && (
              <Card className="mt-4">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={untagged.length > 0 && untagged.every(q => selected.has(q.id))}
                      onCheckedChange={() => {
                        const allSelected = untagged.every(q => selected.has(q.id));
                        setSelected(prev => {
                          const next = new Set(prev);
                          untagged.forEach(q => allSelected ? next.delete(q.id) : next.add(q.id));
                          return next;
                        });
                      }}
                      className="shrink-0"
                    />
                    <button
                      className="flex-1 flex items-center gap-3 text-left"
                      onClick={() => setExpandedDiscipline(expandedDiscipline === "untagged" ? null : "untagged")}
                    >
                      <FlaskConical className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-muted-foreground">Untagged</h3>
                        <p className="text-sm text-muted-foreground">{untagged.length} question{untagged.length !== 1 ? "s" : ""}</p>
                      </div>
                      {expandedDiscipline === "untagged" ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      title="Delete all untagged questions"
                      onClick={e => {
                        e.stopPropagation();
                        setBulkDeleteTarget({
                          ids: untagged.map(q => q.id),
                          label: `all ${untagged.length} untagged question${untagged.length !== 1 ? "s" : ""}`,
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {expandedDiscipline === "untagged" && (
                    <div className="space-y-2 mt-4 border-t border-border pt-4">
                      {untagged.map(q => questionCard(q, "untagged"))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* Flat list view */
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox checked={allFilteredSelected} onCheckedChange={selectAllFiltered} />
              <p className="text-sm text-muted-foreground">
                {allFilteredSelected ? "Deselect all" : "Select all"} · {filtered.length} question{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>
            {filtered.map(q => questionCard(q, "flat"))}
          </div>
        )}
        </>
        )}
      </main>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Quiz Document</DialogTitle>
            <DialogDescription>Configure your quiz export settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="quiz-title">Quiz Title</Label>
              <Input id="quiz-title" value={quizTitle} onChange={e => setQuizTitle(e.target.value)} placeholder="Enter quiz title..." />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="answer-key">Include Answer Key</Label>
              <Switch id="answer-key" checked={includeAnswerKey} onCheckedChange={setIncludeAnswerKey} />
            </div>
            <p className="text-sm text-muted-foreground">{selected.size} question{selected.size !== 1 ? "s" : ""} selected</p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
            <Button variant="secondary" onClick={handleExportQTI} disabled={exporting || !quizTitle.trim()} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Mastery Connect (QTI)
            </Button>
            <Button onClick={handleExport} disabled={exporting || !quizTitle.trim()} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Word Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={!!editingQuestion} onOpenChange={(open) => { if (!open) setEditingQuestion(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>Update question text, type, answers, and NGSS standards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 min-w-0">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4} className="break-words" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={editType} onValueChange={(val) => {
                  setEditType(val);
                  // Reset answers for new type
                  if (val === "true_false_question") {
                    setEditAnswers([
                      { id: 1, text: "True", weight: 100 },
                      { id: 2, text: "False", weight: 0 },
                    ]);
                  } else if (val === "essay_question") {
                    setEditAnswers([]);
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Points</Label>
                <Input type="number" min={0} value={editPoints} onChange={e => setEditPoints(Number(e.target.value))} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cognitive Levels</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => {
                    if (editingQuestion) setSuggestionsQuestion(editingQuestion);
                  }}
                >
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                  AI Suggestions
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={editDok !== null ? String(editDok) : "none"} onValueChange={val => setEditDok(val === "none" ? null : Number(val))}>
                  <SelectTrigger><SelectValue placeholder="Select DOK level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {DOK_LEVELS.map(d => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={editBlooms || "none"} onValueChange={val => setEditBlooms(val === "none" ? null : val)}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {BLOOMS_LEVELS.map(b => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Answer editing */}
            {editType !== "essay_question" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Answers</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setEditAnswers(prev => [...prev, {
                        id: Date.now(),
                        text: "",
                        weight: 0,
                        ...(editType === "matching_question" ? { left: "", right: "" } : {}),
                      }]);
                    }}
                  >
                    + Add Answer
                  </Button>
                </div>

                <div className="space-y-2">
                  {editType === "matching_question" ? (
                    /* Matching question: left-right pairs */
                    editAnswers.map((a, idx) => (
                      <div key={a.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                        <Input
                          placeholder="Left side"
                          value={a.left || ""}
                          onChange={e => {
                            const updated = [...editAnswers];
                            updated[idx] = { ...updated[idx], left: e.target.value };
                            setEditAnswers(updated);
                          }}
                          className="text-sm h-8 flex-1"
                        />
                        <span className="text-muted-foreground text-xs">→</span>
                        <Input
                          placeholder="Right side"
                          value={a.right || ""}
                          onChange={e => {
                            const updated = [...editAnswers];
                            updated[idx] = { ...updated[idx], right: e.target.value };
                            setEditAnswers(updated);
                          }}
                          className="text-sm h-8 flex-1"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => setEditAnswers(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : editType === "fill_in_multiple_blanks_question" || editType === "short_answer_question" ? (
                    /* Fill-in / Short answer: just accepted answers */
                    editAnswers.map((a, idx) => (
                      <div key={a.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                        <span className="text-xs text-muted-foreground shrink-0">Accepted:</span>
                        <Input
                          value={a.text}
                          onChange={e => {
                            const updated = [...editAnswers];
                            updated[idx] = { ...updated[idx], text: e.target.value, weight: 100 };
                            setEditAnswers(updated);
                          }}
                          className="text-sm h-8 flex-1"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => setEditAnswers(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : editType === "true_false_question" ? (
                    /* True/False: radio for correct answer */
                    <RadioGroup
                      value={editAnswers.find(a => a.weight === 100)?.text || "True"}
                      onValueChange={val => {
                        setEditAnswers(prev => prev.map(a => ({ ...a, weight: a.text === val ? 100 : 0 })));
                      }}
                    >
                      {editAnswers.map(a => (
                        <div key={a.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                          <RadioGroupItem value={a.text} id={`tf-${a.id}`} />
                          <Label htmlFor={`tf-${a.id}`} className="text-sm flex-1 cursor-pointer">{a.text}</Label>
                          {a.weight === 100 && <Badge variant="default" className="text-xs">Correct</Badge>}
                        </div>
                      ))}
                    </RadioGroup>
                  ) : editType === "multiple_answers_question" ? (
                    /* Multiple correct: checkboxes */
                    editAnswers.map((a, idx) => (
                      <div key={a.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                        <Checkbox
                          checked={a.weight > 0}
                          onCheckedChange={checked => {
                            const updated = [...editAnswers];
                            updated[idx] = { ...updated[idx], weight: checked ? 100 : 0 };
                            setEditAnswers(updated);
                          }}
                        />
                        <Input
                          value={a.text}
                          onChange={e => {
                            const updated = [...editAnswers];
                            updated[idx] = { ...updated[idx], text: e.target.value };
                            setEditAnswers(updated);
                          }}
                          className="text-sm h-8 flex-1"
                        />
                        {a.weight > 0 && <Badge variant="default" className="text-xs shrink-0">Correct</Badge>}
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => setEditAnswers(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    /* Multiple choice (single correct): radio + editable text */
                    <RadioGroup
                      value={String(editAnswers.find(a => a.weight === 100)?.id || "")}
                      onValueChange={val => {
                        setEditAnswers(prev => prev.map(a => ({ ...a, weight: String(a.id) === val ? 100 : 0 })));
                      }}
                    >
                      {editAnswers.map((a, idx) => (
                        <div key={a.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                          <RadioGroupItem value={String(a.id)} id={`mc-${a.id}`} />
                          <Input
                            value={a.text}
                            onChange={e => {
                              const updated = [...editAnswers];
                              updated[idx] = { ...updated[idx], text: e.target.value };
                              setEditAnswers(updated);
                            }}
                            className="text-sm h-8 flex-1"
                          />
                          {a.weight === 100 && <Badge variant="default" className="text-xs shrink-0">Correct</Badge>}
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => setEditAnswers(prev => prev.filter((_, i) => i !== idx))}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Standards</Label>
              <div className="space-y-2">
                {editStandards.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-muted/50 rounded-md px-3 py-2 min-w-0">
                    <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">{s.ngss_code}</Badge>
                    <span className="text-xs text-muted-foreground flex-1 break-words">{s.ngss_description}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeStandard(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search standards (NGSS or Idaho)..."
                  value={standardSearch}
                  onChange={e => setStandardSearch(e.target.value)}
                  className="pl-8 text-sm h-9"
                />
              </div>
              {standardSearch.trim() && (() => {
                const q = standardSearch.toLowerCase();
                const ngssResults = Object.values(ALL_SUBSTANDARDS).flat()
                  .filter(s => (s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) && !editStandards.some(es => es.ngss_code === s.code))
                  .slice(0, 10)
                  .map(s => ({ code: s.code, description: s.description, framework: "NGSS" }));
                const idahoResults = ALL_IDAHO_STANDARDS_FLAT
                  .filter(s => (s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) && !editStandards.some(es => es.ngss_code === s.code))
                  .slice(0, 10)
                  .map(s => ({ code: s.code, description: s.description, framework: `Idaho ${s.subject} ${s.grade}` }));
                const results = [...ngssResults, ...idahoResults].slice(0, 15);
                return results.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                    {results.map((s, i) => (
                      <button
                        key={`${s.code}-${i}`}
                        type="button"
                        className="w-full flex items-start gap-2 px-3 py-2 hover:bg-muted/50 text-left transition-colors"
                        onClick={() => {
                          setEditStandards(prev => [...prev, { ngss_code: s.code, ngss_description: s.description }]);
                          setStandardSearch("");
                        }}
                      >
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{s.code}</Badge>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{s.framework}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{s.description.length > 80 ? s.description.slice(0, 80) + "…" : s.description}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-2">No matching standards found</p>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuestion(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editText.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateQuestionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={loadQuestions}
      />
      <GenerateContentDialog
        open={showGenerateDialog}
        onOpenChange={(v) => {
          setShowGenerateDialog(v);
          if (!v) setGenerateForStandard(null);
        }}
        onComplete={loadQuestions}
        initialStandard={generateForStandard}
        defaultContentType="questions"
      />
      <DokBloomsSuggestionsDialog
        open={!!suggestionsQuestion}
        onOpenChange={(open) => { if (!open) setSuggestionsQuestion(null); }}
        questionText={suggestionsQuestion ? stripHtml(suggestionsQuestion.question_text) : ""}
        questionType={suggestionsQuestion?.question_type || "multiple_choice_question"}
        currentDok={suggestionsQuestion?.dok_level ?? null}
        currentBlooms={suggestionsQuestion?.blooms_level ?? null}
        answers={suggestionsQuestion?.answers}
        onApplySuggestion={(text, dok, blooms, newAnswers) => {
          if (suggestionsQuestion) {
            // Only use new answers if they're a valid array (for MC/TF/matching) or valid object (for multi-step/drag-drop)
            const validAnswers = newAnswers && (Array.isArray(newAnswers) ? newAnswers.length > 0 : typeof newAnswers === 'object' && Object.keys(newAnswers).length > 0);
            const answersUpdate = validAnswers ? { answers: newAnswers } : {};
            // If editing, update edit state; otherwise update the question directly
            if (editingQuestion && editingQuestion.id === suggestionsQuestion.id) {
              setEditText(text);
              setEditDok(dok);
              setEditBlooms(blooms);
              if (newAnswers && Array.isArray(newAnswers)) {
                setEditAnswers(newAnswers.map((a: any, i: number) => ({
                  id: a.id || i,
                  text: a.text || "",
                  weight: a.weight ?? 0,
                  left: a.left,
                  right: a.right,
                })));
              }
            } else {
              // Apply directly via updateQuestion
              updateQuestion(suggestionsQuestion.id, { question_text: text, dok_level: dok, blooms_level: blooms, ...answersUpdate })
                .then(() => {
                  setQuestions(prev => prev.map(q =>
                    q.id === suggestionsQuestion.id
                      ? { ...q, question_text: text, dok_level: dok, blooms_level: blooms, ...answersUpdate }
                      : q
                  ));
                  toast.success("Question updated with suggested version");
                })
                .catch(() => toast.error("Failed to apply suggestion"));
            }
          }
        }}
      />
      {canvasConnected && canvasConfig && (
        <PushToCanvasDialog
          open={showPushToCanvas}
          onOpenChange={setShowPushToCanvas}
          questions={questions.filter(q => selected.has(q.id))}
          config={canvasConfig}
        />
      )}
      {/* Bulk Delete Confirmation */}
      <AlertDialog open={!!bulkDeleteTarget} onOpenChange={(open) => !open && setBulkDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Questions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{bulkDeleteTarget?.label}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete {bulkDeleteTarget?.ids.length} Question{(bulkDeleteTarget?.ids.length || 0) !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!singleDeleteTarget} onOpenChange={(open) => !open && setSingleDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
              <br /><br />
              <span className="text-xs text-muted-foreground italic">"{singleDeleteTarget?.text}…"</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => singleDeleteTarget && handleDelete(singleDeleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <GenerateISATExamDialog
        open={showISATDialog}
        onOpenChange={setShowISATDialog}
        onComplete={() => setIsatRefreshKey(k => k + 1)}
      />
      <QuestionStandardsTagDialog
        open={tagQuestion !== null}
        onOpenChange={(v) => { if (!v) setTagQuestion(null); }}
        question={tagQuestion}
        onSaved={(qid, standards) => {
          setQuestions(prev => prev.map(q => q.id === qid ? { ...q, standards } : q));
        }}
      />
    </div>
  );
};

export default QuestionBank;
