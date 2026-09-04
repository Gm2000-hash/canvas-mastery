import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Leaf, Globe, Atom, BookOpen, Calculator, Landmark, FileText, GraduationCap, ChevronDown, ChevronRight } from "lucide-react";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS, ALL_IDAHO_STANDARDS_FLAT, IDAHO_CATEGORY_LABELS } from "@/modules/curriculum/lib/idaho-standards-data";
import {
  generateForCoreIdea,
  generateForDiscipline,
  generateForStandards,
  CONTENT_TYPE_LABELS,
  type GenerationProgress,
  type ContentType,
} from "@/modules/curriculum/lib/content-generator";
import { useProfileDefaults } from "@/modules/curriculum/hooks/useProfileDefaults";
import { useAiPreferences } from "@/modules/curriculum/hooks/useAiPreferences";
import { AiEngineSelect } from "@/modules/curriculum/components/AiEngineSelect";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  initialStandard?: { code: string; description: string; framework?: "NGSS" | "Idaho"; subject?: string } | null;
  /** Lock dialog to a specific content type */
  defaultContentType?: ContentType;
  /** Unit ID for lesson plans / readings */
  unitId?: string;
}

const DISCIPLINES = [
  { key: "LS", label: "Life Science", icon: Leaf, coreIdeas: ["MS-LS1", "MS-LS2", "MS-LS3", "MS-LS4"] },
  { key: "ESS", label: "Earth & Space Science", icon: Globe, coreIdeas: ["MS-ESS1", "MS-ESS2", "MS-ESS3"] },
  { key: "PS", label: "Physical Science", icon: Atom, coreIdeas: ["MS-PS1", "MS-PS2", "MS-PS3", "MS-PS4"] },
];

const IDAHO_SUBJECT_ICONS: Record<string, React.ElementType> = {
  ELA: BookOpen,
  Math: Calculator,
  "Social Studies": Landmark,
};

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; icon: React.ElementType }[] = [
  { value: "questions", label: "Questions", icon: FileText },
  { value: "lesson_plan", label: "Lesson Plans", icon: GraduationCap },
  { value: "reading", label: "Readings", icon: BookOpen },
];

type GenerateTarget =
  | { type: "coreIdea"; id: string }
  | { type: "discipline"; key: string }
  | { type: "all" }
  | { type: "ngssSubs"; standards: { code: string; description: string }[] }
  | { type: "idaho"; standards: { code: string; description: string }[]; subject: string };

export default function GenerateContentDialog({ open, onOpenChange, onComplete, initialStandard, defaultContentType = "questions", unitId }: Props) {
  const { defaultFramework, defaultIdahoFilter } = useProfileDefaults();
  const { preferences } = useAiPreferences();
  const [contentType, setContentType] = useState<ContentType>(defaultContentType);
  const [countPerSub, setCountPerSub] = useState(10);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [framework, setFramework] = useState<"ngss" | "idaho">(defaultFramework);
  const [idahoGradeFilter, setIdahoGradeFilter] = useState<string>(defaultIdahoFilter);
  const [idahoCategoryFilter, setIdahoCategoryFilter] = useState<string>("essential");
  const [selectedIdahoStandards, setSelectedIdahoStandards] = useState<Set<string>>(new Set());
  const [selectedNgssSubs, setSelectedNgssSubs] = useState<Set<string>>(new Set());
  const [expandedCoreIdeas, setExpandedCoreIdeas] = useState<Set<string>>(new Set());
  const [targetDok, setTargetDok] = useState<string>("any");
  const [modelOverride, setModelOverride] = useState<string>("");
  const abortRef = useRef(false);
  const latestProgressRef = useRef<GenerationProgress | null>(null);

  useEffect(() => {
    setFramework(defaultFramework);
    setIdahoGradeFilter(defaultIdahoFilter);
  }, [defaultFramework, defaultIdahoFilter]);

  useEffect(() => {
    if (open) {
      setContentType(defaultContentType);
      if (initialStandard) {
        setTargetDok("any");
        setCountPerSub(contentType === "questions" ? 10 : 3);
      }
    }
  }, [open, initialStandard, defaultContentType]);

  // Adjust default count when content type changes
  useEffect(() => {
    setCountPerSub(contentType === "questions" ? 10 : 3);
  }, [contentType]);

  const labels = CONTENT_TYPE_LABELS[contentType];

  const handleGapGenerate = async () => {
    if (!initialStandard) return;
    setGenerating(true);
    setDone(false);
    abortRef.current = false;
    latestProgressRef.current = null;
    try {
      const dokValue = contentType === "questions" && targetDok !== "any" ? Number(targetDok) : null;
      const fw = initialStandard.framework || "NGSS";
      const subj = initialStandard.subject || "Science";
      await generateForStandards(
        contentType,
        [{ code: initialStandard.code, description: initialStandard.description }],
        countPerSub,
        (p) => { latestProgressRef.current = p; setProgress(p); },
        { framework: fw, subject: subj, dokLevel: dokValue, unitId, modelOverride: modelOverride || undefined, aiPreferences: preferences }
      );
      setDone(true);
      const total = (latestProgressRef.current as any)?.itemsGenerated ?? 0;
      toast.success(`Generated ${total} ${total !== 1 ? labels.plural : labels.singular} for ${initialStandard.code}!`);
      onComplete();
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleProgressUpdate = (p: GenerationProgress) => {
    latestProgressRef.current = p;
    setProgress(p);
  };

  const getFilteredIdahoStandards = () => {
    let standards = ALL_IDAHO_STANDARDS_FLAT;
    if (idahoGradeFilter !== "all") {
      const [subject, grade] = idahoGradeFilter.split("|");
      standards = standards.filter(s => s.subject === subject && s.grade === grade);
    }
    if (idahoCategoryFilter !== "all") {
      standards = standards.filter(s => s.category === idahoCategoryFilter);
    }
    return standards;
  };

  const filteredIdaho = getFilteredIdahoStandards();

  const toggleIdahoStandard = (code: string) => {
    const next = new Set(selectedIdahoStandards);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedIdahoStandards(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedIdahoStandards);
    filteredIdaho.forEach(s => next.add(s.code));
    setSelectedIdahoStandards(next);
  };

  const clearSelected = () => setSelectedIdahoStandards(new Set());

  const toggleNgssSub = (code: string) => {
    const next = new Set(selectedNgssSubs);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedNgssSubs(next);
  };

  const toggleCoreIdeaExpanded = (id: string) => {
    const next = new Set(expandedCoreIdeas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCoreIdeas(next);
  };

  const toggleAllInCoreIdea = (coreIdeaId: string, select: boolean) => {
    const subs = ALL_SUBSTANDARDS[coreIdeaId] || [];
    const next = new Set(selectedNgssSubs);
    subs.forEach(s => { if (select) next.add(s.code); else next.delete(s.code); });
    setSelectedNgssSubs(next);
  };

  const clearNgssSubs = () => setSelectedNgssSubs(new Set());

  const handleNgssSubsGenerate = () => {
    const allSubs = Object.values(ALL_SUBSTANDARDS).flat();
    const standards = allSubs
      .filter(s => selectedNgssSubs.has(s.code))
      .map(s => ({ code: s.code, description: s.description }));
    if (standards.length === 0) {
      toast.error("Select at least one substandard");
      return;
    }
    handleGenerate({ type: "ngssSubs", standards });
  };

  const handleGenerate = async (target: GenerateTarget) => {
    setGenerating(true);
    setDone(false);
    abortRef.current = false;
    latestProgressRef.current = null;

    try {
      const opts = { unitId, modelOverride: modelOverride || undefined, aiPreferences: preferences };
      if (target.type === "coreIdea") {
        await generateForCoreIdea(contentType, target.id, countPerSub, handleProgressUpdate, opts);
      } else if (target.type === "discipline") {
        const disc = DISCIPLINES.find(d => d.key === target.key);
        if (disc) await generateForDiscipline(contentType, disc.coreIdeas, countPerSub, handleProgressUpdate, opts);
      } else if (target.type === "idaho") {
        await generateForStandards(contentType, target.standards, countPerSub, handleProgressUpdate, {
          framework: "Idaho",
          subject: target.subject,
          unitId,
          modelOverride: modelOverride || undefined,
          aiPreferences: preferences,
        });
      } else if (target.type === "ngssSubs") {
        await generateForStandards(contentType, target.standards, countPerSub, handleProgressUpdate, {
          framework: "NGSS",
          subject: "Science",
          unitId,
          modelOverride: modelOverride || undefined,
          aiPreferences: preferences,
        });
      } else {
        const allCoreIdeas = DISCIPLINES.flatMap(d => d.coreIdeas);
        await generateForDiscipline(contentType, allCoreIdeas, countPerSub, handleProgressUpdate, opts);
      }
      setDone(true);
      const total = (latestProgressRef.current as any)?.itemsGenerated ?? 0;
      toast.success(`Generated ${total} ${labels.plural}!`);
      onComplete();
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleIdahoGenerate = () => {
    const standards = ALL_IDAHO_STANDARDS_FLAT.filter(s => selectedIdahoStandards.has(s.code));
    if (standards.length === 0) {
      toast.error("Select at least one standard");
      return;
    }
    const subject = standards[0].subject;
    handleGenerate({
      type: "idaho",
      standards: standards.map(s => ({ code: s.code, description: s.description })),
      subject,
    });
  };

  const reset = () => {
    setProgress(null);
    setDone(false);
  };

  const progressPct = progress ? Math.round((progress.completed / Math.max(progress.total, 1)) * 100) : 0;

  const contentTypeLabel = CONTENT_TYPE_OPTIONS.find(o => o.value === contentType)?.label || "Content";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!generating) { onOpenChange(v); reset(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {initialStandard ? `Generate ${contentTypeLabel} for ${initialStandard.code}` : `AI Content Generator`}
          </DialogTitle>
          <DialogDescription>
            {initialStandard
              ? initialStandard.description
              : `Use AI to generate standards-aligned ${labels.plural} — questions, lesson plans, or textbook readings.`}
          </DialogDescription>
        </DialogHeader>

        {/* Content type selector */}
        {!generating && !done && (
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border">
            {CONTENT_TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setContentType(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    contentType === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {!generating && !done && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">UDL-aligned</span><span>Engagement · Representation · Action & Expression baked in.</span></div>
        )}

        {/* Gap-click config form */}
        {initialStandard && !generating && !done ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" className="text-xs">{initialStandard.code}</Badge>
                <span className="text-xs text-muted-foreground">{initialStandard.framework === "Idaho" ? `Idaho ${initialStandard.subject || ""} Standard` : "NGSS Standard"}</span>
              </div>
              <p className="text-sm text-foreground">{initialStandard.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Number of {labels.plural}</Label>
                <Select value={String(countPerSub)} onValueChange={v => setCountPerSub(Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(contentType === "questions" ? [3, 5, 10, 15, 20] : [1, 2, 3, 5]).map(n => (
                      <SelectItem key={n} value={String(n)}>{n} {n === 1 ? labels.singular : labels.plural}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {contentType === "questions" && (
                <div className="space-y-1.5">
                  <Label className="text-sm">DOK Level</Label>
                  <Select value={targetDok} onValueChange={setTargetDok}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Mix (DOK 1-3)</SelectItem>
                      <SelectItem value="1">DOK 1 – Recall</SelectItem>
                      <SelectItem value="2">DOK 2 – Skills & Concepts</SelectItem>
                      <SelectItem value="3">DOK 3 – Strategic Thinking</SelectItem>
                      <SelectItem value="4">DOK 4 – Extended Thinking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <Button onClick={handleGapGenerate} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Generate {countPerSub} {contentTypeLabel} for {initialStandard.code}
            </Button>
          </div>
        ) : null}

        {/* Progress view */}
        {(generating || done) && progress ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {done ? "Complete!" : `Generating for ${progress.current || "..."}` }
                </span>
                <span className="font-medium">{progress.completed}/{progress.total} standards</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              )}
              <div className="text-sm">
                <span className="font-medium">{progress.itemsGenerated}</span> {labels.plural} generated
                {progress.errors.length > 0 && (
                  <span className="text-destructive ml-2">· {progress.errors.length} errors</span>
                )}
              </div>
            </div>

            {progress.errors.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {progress.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {done && (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Close</Button>
                <Button onClick={reset}>Generate More</Button>
              </div>
            )}
          </div>
        ) : initialStandard ? null : (
          /* Selection view */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{contentTypeLabel} per standard</Label>
              <Input
                type="number"
                min={1}
                max={contentType === "questions" ? 50 : 10}
                value={countPerSub}
                onChange={(e) => setCountPerSub(Math.max(1, Math.min(contentType === "questions" ? 50 : 10, parseInt(e.target.value) || 1)))}
                className="w-32 h-9 text-sm"
              />
            </div>

            <Tabs value={framework} onValueChange={v => setFramework(v as "ngss" | "idaho")}>
              <TabsList className="w-full">
                <TabsTrigger value="idaho" className="flex-1">Idaho Standards</TabsTrigger>
                <TabsTrigger value="ngss" className="flex-1">NGSS (Science)</TabsTrigger>
              </TabsList>
            </Tabs>

            {framework === "idaho" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Select value={idahoGradeFilter} onValueChange={v => { setIdahoGradeFilter(v); setSelectedIdahoStandards(new Set()); }}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="All subjects" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects & Grades</SelectItem>
                      {ALL_IDAHO_STANDARDS.map(gs => (
                        <SelectItem key={`${gs.subject}|${gs.grade}`} value={`${gs.subject}|${gs.grade}`}>
                          {gs.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={idahoCategoryFilter} onValueChange={setIdahoCategoryFilter}>
                    <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(IDAHO_CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selectedIdahoStandards.size} selected · {filteredIdaho.length} shown
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={selectAllFiltered}>Select All</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={clearSelected}>Clear</Button>
                  </div>
                </div>

                <ScrollArea className="h-[200px] border rounded-md">
                  <div className="p-1 space-y-0.5">
                    {filteredIdaho.map(s => (
                      <label key={s.code} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer">
                        <Checkbox checked={selectedIdahoStandards.has(s.code)} onCheckedChange={() => toggleIdahoStandard(s.code)} className="mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold">{s.code}</span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">{s.subject} {s.grade}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{s.description}</p>
                        </div>
                      </label>
                    ))}
                    {filteredIdaho.length === 0 && (
                      <p className="text-xs text-muted-foreground p-4 text-center">No standards match filters</p>
                    )}
                  </div>
                </ScrollArea>

                <Button className="w-full gap-2" onClick={handleIdahoGenerate} disabled={generating || selectedIdahoStandards.size === 0}>
                  <Sparkles className="h-4 w-4" />
                  Generate {selectedIdahoStandards.size * countPerSub} {contentTypeLabel}
                  ({selectedIdahoStandards.size} standards × {countPerSub})
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedNgssSubs.size > 0 ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">
                        {selectedNgssSubs.size} substandard{selectedNgssSubs.size === 1 ? "" : "s"} selected
                      </span>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={clearNgssSubs}>
                        Clear
                      </Button>
                    </div>
                    <Button className="w-full gap-2" onClick={handleNgssSubsGenerate} disabled={generating}>
                      <Sparkles className="h-4 w-4" />
                      Generate {selectedNgssSubs.size * countPerSub} {contentTypeLabel}
                      ({selectedNgssSubs.size} × {countPerSub})
                    </Button>
                  </div>
                ) : (
                  <Button variant="default" className="w-full gap-2" onClick={() => handleGenerate({ type: "all" })} disabled={generating}>
                    <Sparkles className="h-4 w-4" />
                    Generate All ({Object.values(ALL_SUBSTANDARDS).reduce((s, a) => s + a.length, 0) * countPerSub} {labels.plural})
                  </Button>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  — or generate by discipline, core idea, or pick specific substandards —
                </div>

                {DISCIPLINES.map(disc => {
                  const Icon = disc.icon;
                  const subCount = disc.coreIdeas.reduce((s, ci) => s + (ALL_SUBSTANDARDS[ci]?.length || 0), 0);
                  return (
                    <div key={disc.key} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{disc.label}</span>
                          <Badge variant="secondary" className="text-xs">{subCount} standards</Badge>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => handleGenerate({ type: "discipline", key: disc.key })} disabled={generating}>
                          <Sparkles className="h-3 w-3" /> Generate All
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {disc.coreIdeas.map(ci => {
                          const subs = ALL_SUBSTANDARDS[ci] || [];
                          const isExpanded = expandedCoreIdeas.has(ci);
                          const selectedInGroup = subs.filter(s => selectedNgssSubs.has(s.code)).length;
                          const allSelected = selectedInGroup === subs.length && subs.length > 0;
                          return (
                            <div key={ci} className="rounded-md border border-border">
                              <div className="flex items-center gap-1 px-2 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleCoreIdeaExpanded(ci)}
                                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:opacity-80"
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <Badge variant="outline" className="text-[10px] px-1.5">{ci}</Badge>
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {subs.length} subs
                                    {selectedInGroup > 0 && (
                                      <span className="ml-1 text-primary font-medium">· {selectedInGroup} selected</span>
                                    )}
                                  </span>
                                </button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => handleGenerate({ type: "coreIdea", id: ci })}
                                  disabled={generating}
                                >
                                  Generate all
                                </Button>
                              </div>
                              {isExpanded && (
                                <div className="border-t border-border px-2 py-1.5 space-y-0.5 bg-muted/30">
                                  <div className="flex items-center justify-between pb-1">
                                    <span className="text-[10px] text-muted-foreground">Pick specific PEs</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 text-[10px] px-1.5"
                                      onClick={() => toggleAllInCoreIdea(ci, !allSelected)}
                                    >
                                      {allSelected ? "Unselect all" : "Select all"}
                                    </Button>
                                  </div>
                                  {subs.map(s => (
                                    <label
                                      key={s.code}
                                      className="flex items-start gap-2 px-1.5 py-1 rounded hover:bg-accent/50 cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={selectedNgssSubs.has(s.code)}
                                        onCheckedChange={() => toggleNgssSub(s.code)}
                                        className="mt-0.5"
                                      />
                                      <div className="min-w-0">
                                        <span className="text-[11px] font-semibold">{s.code}</span>
                                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                                          {s.description}
                                        </p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
