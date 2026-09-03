import { useState, useEffect, useMemo } from "react";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { useNavigate } from "@/modules/curriculum/config/router";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { PageBanner } from "@/modules/curriculum/config/chrome-page-banner";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/modules/curriculum/components/activities/ActivityCard";
import { ActivityPlayer } from "@/modules/curriculum/components/activities/ActivityPlayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "@/modules/curriculum/config/auth";
import { useToast } from "@/modules/curriculum/config/toast";
import { useActivityStandards, type ActivityStandard } from "@/modules/curriculum/hooks/useActivityStandards";
import { useProfileDefaults } from "@/modules/curriculum/hooks/useProfileDefaults";
import { ACTIVITY_TYPES, getDefaultContent } from "@/modules/curriculum/lib/h5p-types";
import type { ActivityType, ActivityContent } from "@/modules/curriculum/lib/h5p-types";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS, ALL_IDAHO_STANDARDS_FLAT, IDAHO_CATEGORY_LABELS } from "@/modules/curriculum/lib/idaho-standards-data";
import { Plus, Puzzle, Search, Sparkles, Loader2, LayoutGrid, List, FileText, BookOpen, Library, RotateCcw } from "lucide-react";
import { useCanvasConfig } from "@/modules/curriculum/config/canvas-config";
import PushActivityToCanvasDialog from "@/modules/curriculum/config/canvas-push-activity-dialog";

interface SourceOption { id: string; title: string; type: "lesson_plan" | "curriculum_lesson" | "reading_library"; }

interface Activity {
  id: string;
  title: string;
  activity_type: string;
  content: any;
  updated_at: string;
}

export default function ActivityBuilder() {
  usePageTitle("Activity Builder");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { tagActivity, fetchStandards } = useActivityStandards();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [standardsMap, setStandardsMap] = useState<Record<string, ActivityStandard[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ActivityType>("fill_in_blanks");
  const [useAI, setUseAI] = useState(false);
  const [aiSourceMode, setAiSourceMode] = useState<"lesson" | "reading" | "standard">("lesson");
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedReading, setSelectedReading] = useState<string>("");
  const [selectedBook, setSelectedBook] = useState<string>("");
  const [bookSections, setBookSections] = useState<{ id: string; title: string }[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [selectedStandard, setSelectedStandard] = useState<{ code: string; description: string } | null>(null);
  const [standardFramework, setStandardFramework] = useState<"ngss" | "idaho">("idaho");
  const [idahoFilter, setIdahoFilter] = useState<string>("all");
  const [standardSearch, setStandardSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; currentLabel: string } | null>(null);
  const { defaultFramework } = useProfileDefaults();

  const filteredStandards = useMemo(() => {
    let list: { code: string; description: string; category?: string }[] = [];
    if (standardFramework === "ngss") {
      list = Object.values(ALL_SUBSTANDARDS).flat();
    } else {
      let stds = ALL_IDAHO_STANDARDS_FLAT as { code: string; description: string; category?: string; subject?: string; grade?: string }[];
      if (idahoFilter !== "all") {
        const [subject, grade] = idahoFilter.split("|");
        stds = stds.filter(s => s.subject === subject && s.grade === grade);
      }
      list = stds;
    }
    if (standardSearch.trim()) {
      const q = standardSearch.toLowerCase();
      list = list.filter(s => s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return list;
  }, [standardFramework, idahoFilter, standardSearch]);

  // Canvas push
  const { config: canvasConfig } = useCanvasConfig();
  const [pushTarget, setPushTarget] = useState<Activity | null>(null);

  // Preview dialog
  const [previewActivity, setPreviewActivity] = useState<Activity | null>(null);

  const fetchActivities = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("h5p_activities")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    const acts = (data as Activity[]) ?? [];
    setActivities(acts);
    setLoading(false);

    // Fetch standards for all activities
    if (acts.length > 0) {
      const map = await fetchStandards(acts.map(a => a.id));
      setStandardsMap(map);
    }
  };

  useEffect(() => { fetchActivities(); }, [user]);

  // Fetch sources when AI toggle is enabled
  useEffect(() => {
    if (!useAI || !user || sourcesLoaded) return;
    Promise.all([
      supabase.from("lesson_plans").select("id, title").eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("curriculum_lessons").select("id, title").eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("library_books").select("id, title, source_discipline").eq("user_id", user.id).not("source_discipline", "is", null).order("updated_at", { ascending: false }),
    ]).then(([lp, cl, lb]) => {
      const opts: SourceOption[] = [
        ...((lb.data || []) as any[]).map(d => ({ id: d.id, title: d.title, type: "reading_library" as const })),
        ...((lp.data || []) as any[]).map(d => ({ id: d.id, title: d.title, type: "lesson_plan" as const })),
        ...((cl.data || []) as any[]).map(d => ({ id: d.id, title: d.title, type: "curriculum_lesson" as const })),
      ];
      setSources(opts);
      setSourcesLoaded(true);
      const lessonSources = opts.filter(s => s.type !== "reading_library");
      const readingSources = opts.filter(s => s.type === "reading_library");
      if (lessonSources.length > 0) setSelectedSource(lessonSources[0].id);
      if (readingSources.length > 0) setSelectedBook(readingSources[0].id);
    });
  }, [useAI, user, sourcesLoaded]);

  // Fetch sections (curriculum lessons) when a book is selected
  useEffect(() => {
    if (!selectedBook || !user) {
      setBookSections([]);
      setSelectedReading("");
      return;
    }
    const book = sources.find(s => s.id === selectedBook);
    if (!book) return;
    setLoadingSections(true);
    // Get the discipline from the book title pattern "X Readings" or fall back
    supabase.from("library_books").select("source_discipline").eq("id", selectedBook).single().then(async ({ data: bookData }) => {
      if (!bookData?.source_discipline) { setLoadingSections(false); return; }
      const { data: units } = await supabase.from("units").select("id").eq("user_id", user.id).eq("discipline", bookData.source_discipline);
      if (!units || units.length === 0) { setBookSections([]); setLoadingSections(false); return; }
      const { data: lessons } = await supabase
        .from("curriculum_lessons")
        .select("id, title, reading_title")
        .in("unit_id", units.map(u => u.id))
        .eq("user_id", user.id)
        .order("sort_order");
      const sections = (lessons || []).map((l: any) => ({ id: l.id, title: l.reading_title || l.title }));
      setBookSections(sections);
      if (sections.length > 0) setSelectedReading(sections[0].id);
      setLoadingSections(false);
    });
  }, [selectedBook, user, sources]);

  // Auto-fill title from selected source with sequential letter suffix
  useEffect(() => {
    if (!useAI) return;
    let baseTitle = "";
    if (aiSourceMode === "lesson" && selectedSource) {
      const src = sources.find(s => s.id === selectedSource);
      if (src) baseTitle = src.title;
    } else if (aiSourceMode === "reading" && selectedReading) {
      const section = bookSections.find(s => s.id === selectedReading);
      if (section) baseTitle = section.title;
    } else if (aiSourceMode === "standard" && selectedStandard) {
      baseTitle = selectedStandard.code;
    }
    if (!baseTitle) return;

    // Count existing activities that start with this base title
    const existing = activities.filter(a => a.title === baseTitle || /^.+ [A-Z]$/.test(a.title) && a.title.slice(0, -2) === baseTitle);
    const letter = String.fromCharCode(65 + existing.length); // A, B, C...
    setNewTitle(existing.length === 0 ? baseTitle : `${baseTitle} ${letter}`);
  }, [selectedSource, selectedReading, selectedStandard, aiSourceMode, useAI, sources, activities]);

  const toggleType = (type: ActivityType) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleCreate = async () => {
    if (!user) return;

    if (useAI) {
      const typesToGenerate = selectedTypes.length > 0 ? selectedTypes : [newType];

      let baseBody: any;
      if (aiSourceMode === "standard" && selectedStandard) {
        baseBody = { sourceType: "standard", standardCode: selectedStandard.code, standardDescription: selectedStandard.description };
      } else if (aiSourceMode === "reading" && selectedReading) {
        baseBody = { sourceType: "curriculum_lesson", sourceId: selectedReading };
      } else if (aiSourceMode === "lesson" && selectedSource) {
        const source = sources.find(s => s.id === selectedSource);
        if (!source) return;
        baseBody = { sourceType: source.type, sourceId: source.id };
      } else {
        return;
      }

      const baseTitle = newTitle.trim() || "Activity";

      setGenerating(true);
      setBulkProgress({ current: 0, total: typesToGenerate.length, currentLabel: "" });
      const createdIds: string[] = [];
      let failCount = 0;

      for (let i = 0; i < typesToGenerate.length; i++) {
        const actType = typesToGenerate[i];
        const typeLabel = ACTIVITY_TYPES.find(t => t.type === actType)?.label || actType;
        setBulkProgress({ current: i + 1, total: typesToGenerate.length, currentLabel: typeLabel });

        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-h5p-activity", {
            body: { ...baseBody, activityType: actType },
          });
          if (fnData?.error) throw new Error(fnData.error);
          if (fnError) throw fnError;
          if (!fnData?.content) throw new Error("No content generated");

          const actTitle = typesToGenerate.length > 1
            ? `${baseTitle} ${String.fromCharCode(65 + i)}`
            : baseTitle;

          const { data, error } = await supabase
            .from("h5p_activities")
            .insert({ user_id: user.id, title: actTitle, activity_type: actType, content: fnData.content as any })
            .select()
            .single();
          if (error) throw error;
          const actId = (data as any).id;
          createdIds.push(actId);

          if (aiSourceMode === "standard" && selectedStandard) {
            await supabase.from("h5p_activity_standards").insert({
              activity_id: actId, ngss_code: selectedStandard.code, ngss_description: selectedStandard.description,
            });
          }
          tagActivity(actId, actType, fnData.content, actTitle);
        } catch (err: any) {
          failCount++;
          console.error(`Failed to generate ${typeLabel}:`, err);
        }
      }

      setGenerating(false);
      setBulkProgress(null);
      setShowCreate(false);
      setNewTitle("");
      setSelectedTypes([]);
      setUseAI(false);

      if (createdIds.length > 0) {
        toast({
          title: `${createdIds.length} activit${createdIds.length === 1 ? "y" : "ies"} generated!`,
          description: failCount > 0 ? `${failCount} failed — check console.` : undefined,
        });
        await fetchActivities();
        if (createdIds.length === 1) navigate(`/app/curriculum/activities/${createdIds[0]}`);
      } else {
        toast({ title: "Generation failed", description: "No activities were created.", variant: "destructive" });
      }
      return;
    }

    if (!newTitle.trim()) return;
    const content = getDefaultContent(newType);
    const { data, error } = await supabase
      .from("h5p_activities")
      .insert({ user_id: user.id, title: newTitle.trim(), activity_type: newType, content: content as any })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setShowCreate(false);
    setNewTitle("");
    navigate(`/app/curriculum/activities/${(data as any).id}`);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("h5p_activities").delete().eq("id", id);
    setActivities(prev => prev.filter(a => a.id !== id));
    setDeleteTarget(null);
    toast({ title: "Activity deleted" });
  };

  const handleDuplicate = async (activity: Activity) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("h5p_activities")
      .insert({
        user_id: user.id,
        title: `${activity.title} (Copy)`,
        activity_type: activity.activity_type,
        content: activity.content,
      })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Activity duplicated" });
    // Also duplicate standards
    const existingStandards = standardsMap[activity.id];
    if (existingStandards && existingStandards.length > 0) {
      await supabase.from("h5p_activity_standards").insert(
        existingStandards.map(s => ({
          activity_id: (data as any).id,
          ngss_code: s.ngss_code,
          ngss_description: s.ngss_description,
          matched_terms: s.matched_terms || [],
        }))
      );
    }
    fetchActivities();
  };

  const filtered = activities.filter(a => {
    if (filterType !== "all" && a.activity_type !== filterType) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group activities by type for library view
  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    filtered.forEach(a => {
      if (!map.has(a.activity_type)) map.set(a.activity_type, []);
      map.get(a.activity_type)!.push(a);
    });
    // Sort groups by ACTIVITY_TYPES order
    const sorted: { type: string; label: string; activities: Activity[] }[] = [];
    ACTIVITY_TYPES.forEach(t => {
      const acts = map.get(t.type);
      if (acts && acts.length > 0) {
        sorted.push({ type: t.type, label: t.label, activities: acts });
      }
    });
    return sorted;
  }, [filtered]);

  const PUBLISHED_BASE = "https://canvas-quiz-doc-export.lovable.app";

  const copyActivityEmbed = (activityId: string) => {
    const url = `${PUBLISHED_BASE}/activities/${activityId}`;
    const embed = `<iframe src="${url}" width="100%" height="800" style="border:none;border-radius:12px;" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embed);
    toast({ title: "Embed code copied!", description: "Paste into a Canvas assignment using the HTML editor." });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-white glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Activity Builder" }]} />
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-6 bg-page-green">
        <PageBanner
          greeting="Activity Library"
          subtitle="Browse, create and manage interactive H5P-style activities organized by type"
          compact
        />

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ACTIVITY_TYPES.map(t => (
                <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
            <Button
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grouped")}
              title="Grouped view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Activity
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <Puzzle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {activities.length === 0 ? "No activities yet. Create your first one!" : "No matching activities."}
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-3">
            {filtered.map(a => (
               <ActivityCard
                key={a.id}
                id={a.id}
                title={a.title}
                activityType={a.activity_type}
                updatedAt={a.updated_at}
                standards={standardsMap[a.id]}
                onPlay={() => setPreviewActivity(a)}
                onEdit={() => navigate(`/app/curriculum/activities/${a.id}`)}
                onDuplicate={() => handleDuplicate(a)}
                onDelete={() => setDeleteTarget({ id: a.id, title: a.title })}
                onCopyEmbed={() => copyActivityEmbed(a.id)}
                onPushToCanvas={canvasConfig ? () => setPushTarget(a) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.type}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
                  <Badge variant="secondary" className="text-xs">{group.activities.length}</Badge>
                </div>
                <div className="space-y-2 pl-1">
                  {group.activities.map(a => (
                    <ActivityCard
                      key={a.id}
                      id={a.id}
                      title={a.title}
                      activityType={a.activity_type}
                      updatedAt={a.updated_at}
                      standards={standardsMap[a.id]}
                      onPlay={() => setPreviewActivity(a)}
                      onEdit={() => navigate(`/app/curriculum/activities/${a.id}`)}
                      onDuplicate={() => handleDuplicate(a)}
                      onDelete={() => setDeleteTarget({ id: a.id, title: a.title })}
                      onCopyEmbed={() => copyActivityEmbed(a.id)}
                      onPushToCanvas={canvasConfig ? () => setPushTarget(a) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Title</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="My Activity" className="mt-1.5" />
            </div>
            {useAI ? (
              <div>
                <Label>Activity Types <span className="text-xs text-muted-foreground font-normal">(select one or more)</span></Label>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {ACTIVITY_TYPES.map(t => {
                    const isSelected = selectedTypes.includes(t.type);
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => toggleType(t.type)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/30"
                        }`}
                      >
                        <span className="font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedTypes.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {selectedTypes.length} type{selectedTypes.length !== 1 ? "s" : ""} selected — will generate {selectedTypes.length} activit{selectedTypes.length !== 1 ? "ies" : "y"}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Label>Activity Type</Label>
                <Select value={newType} onValueChange={v => setNewType(v as ActivityType)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="z-[200] max-h-[300px] overflow-y-auto">
                    {ACTIVITY_TYPES.map(t => (
                      <SelectItem key={t.type} value={t.type}>
                        <div>
                          <div className="font-medium">{t.label}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* AI Generation Toggle */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Sparkles className="h-4 w-4 text-primary" /> Generate with AI
                </Label>
                <Switch checked={useAI} onCheckedChange={setUseAI} />
              </div>
              {useAI && (
                <div className="space-y-3">
                  {/* Source mode toggle */}
                  <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border">
                    <button
                      onClick={() => setAiSourceMode("lesson")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        aiSourceMode === "lesson"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                    >
                      <FileText className="h-3 w-3" /> From Lesson
                    </button>
                    <button
                      onClick={() => setAiSourceMode("reading")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        aiSourceMode === "reading"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                    >
                      <Library className="h-3 w-3" /> From Reading
                    </button>
                    <button
                      onClick={() => setAiSourceMode("standard")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        aiSourceMode === "standard"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      }`}
                    >
                      <BookOpen className="h-3 w-3" /> From Standard
                    </button>
                  </div>

                  {aiSourceMode === "lesson" ? (
                    <div>
                      <Label className="text-xs text-muted-foreground">Source lesson plan or curriculum lesson</Label>
                      {!sourcesLoaded ? (
                        <p className="text-xs text-muted-foreground mt-1">Loading sources…</p>
                      ) : sources.filter(s => s.type !== "reading_library").length === 0 ? (
                        <p className="text-xs text-muted-foreground mt-1">No lessons found. Create a lesson plan or curriculum lesson first.</p>
                      ) : (
                        <Select value={selectedSource} onValueChange={setSelectedSource}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select a lesson..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sources.filter(s => s.type !== "reading_library").map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="mr-1.5 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                  {s.type === "lesson_plan" ? "Plan" : "Curriculum"}
                                </span>
                                {s.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : aiSourceMode === "reading" ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Book</Label>
                        {!sourcesLoaded ? (
                          <p className="text-xs text-muted-foreground mt-1">Loading…</p>
                        ) : sources.filter(s => s.type === "reading_library").length === 0 ? (
                          <p className="text-xs text-muted-foreground mt-1">No reading library books found. Generate readings first.</p>
                        ) : (
                          <Select value={selectedBook} onValueChange={v => { setSelectedBook(v); setSelectedReading(""); }}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="Select a book..." />
                            </SelectTrigger>
                            <SelectContent>
                              {sources.filter(s => s.type === "reading_library").map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {selectedBook && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Section</Label>
                          {loadingSections ? (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading sections…</p>
                          ) : bookSections.length === 0 ? (
                            <p className="text-xs text-muted-foreground mt-1">No sections found for this book.</p>
                          ) : (
                            <Select value={selectedReading} onValueChange={setSelectedReading}>
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select a section..." />
                              </SelectTrigger>
                              <SelectContent>
                                {bookSections.map((s, i) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    <span className="text-muted-foreground mr-1">{i + 1}.</span> {s.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Framework</Label>
                      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border">
                        <button
                          onClick={() => setStandardFramework("idaho")}
                          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            standardFramework === "idaho"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          }`}
                        >
                          Idaho
                        </button>
                        <button
                          onClick={() => setStandardFramework("ngss")}
                          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            standardFramework === "ngss"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          }`}
                        >
                          NGSS
                        </button>
                      </div>

                      {standardFramework === "idaho" && (
                        <Select value={idahoFilter} onValueChange={setIdahoFilter}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All subjects" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Subjects & Grades</SelectItem>
                            {ALL_IDAHO_STANDARDS.map(gs => (
                              <SelectItem key={`${gs.subject}|${gs.grade}`} value={`${gs.subject}|${gs.grade}`}>
                                {gs.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Input
                        placeholder="Search standards..."
                        value={standardSearch}
                        onChange={e => setStandardSearch(e.target.value)}
                        className="h-8 text-xs"
                      />

                      <ScrollArea className="h-[180px] border rounded-md">
                        <div className="p-1 space-y-0.5">
                          {filteredStandards.map(s => (
                            <button
                              key={s.code + (s.category || "")}
                              onClick={() => setSelectedStandard({ code: s.code, description: s.description })}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                selectedStandard?.code === s.code
                                  ? "bg-primary/10 border border-primary/30"
                                  : "hover:bg-accent/50"
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold">{s.code}</span>
                                {s.category && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    {IDAHO_CATEGORY_LABELS[s.category] || s.category}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground leading-snug line-clamp-2">{s.description}</p>
                            </button>
                          ))}
                          {filteredStandards.length === 0 && (
                            <p className="text-xs text-muted-foreground p-3 text-center">No matching standards</p>
                          )}
                        </div>
                      </ScrollArea>
                      {selectedStandard && (
                        <div className="mt-2 p-2 rounded-md bg-muted/50 border border-border">
                          <Badge variant="default" className="text-[10px]">{selectedStandard.code}</Badge>
                          <p className="text-[11px] text-muted-foreground mt-1">{selectedStandard.description}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {bulkProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Generating: {bulkProgress.currentLabel}</span>
                  <span>{bulkProgress.current} / {bulkProgress.total}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={generating || (!useAI && !newTitle.trim()) || (useAI && selectedTypes.length === 0) || (useAI && aiSourceMode === "lesson" && !selectedSource) || (useAI && aiSourceMode === "reading" && !selectedReading) || (useAI && aiSourceMode === "standard" && !selectedStandard)}
              className="w-full gap-2"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating {bulkProgress ? `${bulkProgress.current}/${bulkProgress.total}` : "…"}</>
              ) : useAI ? (
                <><Sparkles className="h-4 w-4" /> Generate {selectedTypes.length > 1 ? `${selectedTypes.length} Activities` : "Activity"}</>
              ) : (
                "Create Activity"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewActivity} onOpenChange={() => setPreviewActivity(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewActivity?.title}</DialogTitle>
          </DialogHeader>
          {previewActivity && (
            <ActivityPlayer
              type={previewActivity.activity_type as ActivityType}
              content={previewActivity.content as ActivityContent}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Activity
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canvasConfig && pushTarget && (
        <PushActivityToCanvasDialog
          open={!!pushTarget}
          onOpenChange={(open) => !open && setPushTarget(null)}
          activityId={pushTarget.id}
          activityTitle={pushTarget.title}
          activityType={ACTIVITY_TYPES.find(t => t.type === pushTarget.activity_type)?.label ?? pushTarget.activity_type}
          config={canvasConfig}
        />
      )}
    </div>
  );
}
