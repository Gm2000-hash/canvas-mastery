import { useState, useEffect, useRef, useCallback } from "react";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { useNavigate, useSearchParams } from "@/modules/curriculum/config/router";
import { useAuth } from "@/modules/curriculum/config/auth";
import { useProfileDefaults } from "@/modules/curriculum/hooks/useProfileDefaults";
import { useProfile } from "@/modules/curriculum/config/profile";
import { supabase } from "@/modules/curriculum/config/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Layers, Sparkles, Library, Download, Upload, BookOpen } from "lucide-react";
import GenerateContentDialog from "@/modules/curriculum/components/GenerateContentDialog";
import PrepopulateStandardsDialog from "@/modules/curriculum/components/PrepopulateStandardsDialog";
import { CurriculumEditor } from "@/modules/curriculum/components/CurriculumEditor";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { WeeklyDashboard } from "@/modules/curriculum/config/chrome-weekly-dashboard";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { BentoHero } from "@/modules/curriculum/config/chrome-bento-hero";
import { useToast } from "@/modules/curriculum/config/toast";
import { DisciplineGroupedUnits } from "@/modules/curriculum/components/DisciplineGroupedUnits";
import { ImportNextStepsDialog } from "@/modules/curriculum/components/ImportNextStepsDialog";
import { UniversalImportDialog } from "@/modules/curriculum/components/UniversalImportDialog";

interface Unit {
  id: string;
  title: string;
  description: string;
  grade_level: string;
  discipline: string;
  date_start: string | null;
  date_end: string | null;
  created_at: string;
  lesson_count?: number;
}

const DISCIPLINES = [
  "Life Science", "Physical Science", "Earth & Space Science", "Engineering", "Careers"
];

const GRADE_LEVELS = [
  "6th Grade", "7th Grade", "8th Grade", "6th-8th Grade"
];

const LessonPlanner = () => {
  usePageTitle("Lesson Planner");
  const { user, signOut } = useAuth();
  const { defaultGradeLevel, defaultDiscipline } = useProfileDefaults();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "curriculum" ? "curriculum" : "units";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [prepopulateOpen, setPrepopulateOpen] = useState(false);
  const [importNextStepsOpen, setImportNextStepsOpen] = useState(false);
  const [universalImportOpen, setUniversalImportOpen] = useState(false);
  const { profile } = useProfile();
  const [newUnit, setNewUnit] = useState({ title: "", description: "", grade_level: defaultGradeLevel, discipline: defaultDiscipline, date_start: "", date_end: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  // Sync defaults when profile loads
  useEffect(() => {
    setNewUnit(prev => ({
      ...prev,
      grade_level: prev.grade_level || defaultGradeLevel,
      discipline: prev.discipline || defaultDiscipline,
    }));
  }, [defaultGradeLevel, defaultDiscipline]);

  const handleUnitDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    dragNode.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => { if (dragNode.current) dragNode.current.style.opacity = "0.4"; });
  }, []);

  const handleUnitDragEnd = useCallback(async () => {
    if (dragNode.current) dragNode.current.style.opacity = "1";
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const reordered = [...units];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(overIdx, 0, moved);
      setUnits(reordered);
      await Promise.all(reordered.map((u, i) =>
        supabase.from("units").update({ sort_order: i } as any).eq("id", u.id)
      ));
    }
    setDragIdx(null);
    setOverIdx(null);
    dragNode.current = null;
  }, [dragIdx, overIdx, units]);

  const handleUnitDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const fetchUnits = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error loading units", description: error.message, variant: "destructive" });
      return;
    }

    // Get lesson counts
    const { data: lessons } = await supabase
      .from("lesson_plans")
      .select("unit_id")
      .eq("user_id", user.id);

    const counts: Record<string, number> = {};
    lessons?.forEach(l => { if (l.unit_id) counts[l.unit_id] = (counts[l.unit_id] || 0) + 1; });

    setUnits((data || []).map(u => ({ ...u, lesson_count: counts[u.id] || 0 })) as any);
    setLoading(false);
  };

  useEffect(() => { fetchUnits(); }, [user]);

  const handleCreate = async () => {
    if (!user || !newUnit.title.trim()) return;
    const { error } = await supabase.from("units").insert({
      user_id: user.id,
      title: newUnit.title.trim(),
      description: newUnit.description.trim(),
      grade_level: newUnit.grade_level,
      discipline: newUnit.discipline,
      date_start: newUnit.date_start || null,
      date_end: newUnit.date_end || null,
    });
    if (error) {
      toast({ title: "Error creating unit", description: error.message, variant: "destructive" });
      return;
    }
    setCreateOpen(false);
    setNewUnit({ title: "", description: "", grade_level: defaultGradeLevel, discipline: defaultDiscipline, date_start: "", date_end: "" });
    fetchUnits();
    toast({ title: "Unit created" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("units").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting unit", description: error.message, variant: "destructive" });
      return;
    }
    setDeleteTarget(null);
    fetchUnits();
    toast({ title: "Unit deleted" });
  };

  const handleDuplicate = async (unit: Unit) => {
    if (!user) return;
    // Duplicate the unit
    const { data: newUnit, error } = await supabase.from("units").insert({
      user_id: user.id,
      title: `${unit.title} (Copy)`,
      description: unit.description,
      grade_level: unit.grade_level,
      discipline: unit.discipline,
      date_start: unit.date_start,
      date_end: unit.date_end,
    }).select().single();

    if (error || !newUnit) {
      toast({ title: "Error duplicating unit", description: error?.message, variant: "destructive" });
      return;
    }

    // Duplicate all lessons in the unit
    const { data: lessons } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("unit_id", unit.id)
      .eq("user_id", user.id);

    if (lessons && lessons.length > 0) {
      const newLessons = lessons.map(l => ({
        user_id: user.id,
        unit_id: newUnit.id,
        title: l.title,
        lesson_date: l.lesson_date,
        duration_minutes: l.duration_minutes,
        objectives: l.objectives,
        activities: l.activities,
        materials: l.materials,
        assessment: l.assessment,
        differentiation: l.differentiation,
        notes: l.notes,
        vocabulary: l.vocabulary,
        resources: l.resources,
        sort_order: l.sort_order,
      }));
      await supabase.from("lesson_plans").insert(newLessons);
    }

    fetchUnits();
    toast({ title: "Unit duplicated" });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-white glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Lesson Planner" }]} />
      </header>

      <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-6 bg-page-green">
        <BentoHero
          eyebrow="Curriculum"
          title={<>Plan units that<br/>build on each other.</>}
          subtitle="Organize lessons, generate AI plans, and export pacing guides — all in one workspace."
          stats={[
            { label: "Units", value: units.length },
            { label: "Disciplines", value: new Set(units.map(u => u.discipline).filter(Boolean)).size },
          ]}
          primaryAction={{
            label: "New Unit",
            icon: Plus,
            onClick: () => setCreateOpen(true),
            variant: "ink",
          }}
          secondaryActions={[
            { label: "Prepopulate", icon: Library, onClick: () => setPrepopulateOpen(true) },
            { label: "Import File", icon: Upload, onClick: () => setUniversalImportOpen(true) },
          ]}
          sideTiles={[
            {
              variant: "coral",
              eyebrow: "AI",
              title: "Generate Curriculum",
              body: "Build a full unit's worth of readings & lessons from one prompt.",
              action: { label: "Open AI", icon: Sparkles, onClick: () => setGenerateOpen(true) },
            },
            {
              variant: "peach",
              eyebrow: "Browse",
              title: "All Lessons",
              body: "Search every lesson by subject, grade, theme, or activities.",
              action: { label: "Open Lessons", icon: BookOpen, onClick: () => navigate("/app/curriculum/lessons") },
            },
            {
              variant: "sky",
              eyebrow: "Imports",
              title: "NextSteps",
              body: "Pull career lessons from the NextSteps library.",
              action: { label: "Browse", icon: Download, onClick: () => setImportNextStepsOpen(true) },
            },
          ]}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="units" className="gap-2">
              <Layers className="h-4 w-4" /> Units
            </TabsTrigger>
            <TabsTrigger value="curriculum" className="gap-2">
              <Sparkles className="h-4 w-4" /> Curriculum
            </TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="space-y-6 mt-4">
            {/* Calendar Overview */}
            <WeeklyDashboard />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Units</h2>
                <p className="text-sm text-muted-foreground mt-0.5 shadow-none">Organize lesson plans into units with pacing guides</p>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible [&>*]:flex-shrink-0">

                <Button variant="outline" className="gap-2 rounded-xl border-2 border-card-foreground" onClick={() => setUniversalImportOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Import File
                </Button>
                <Button variant="outline" className="gap-2 rounded-xl border-2 border-card-foreground" onClick={() => setImportNextStepsOpen(true)}>
                  <Download className="h-4 w-4" />
                  Import NextSteps
                </Button>
                <Button variant="outline" className="gap-2 rounded-xl border-2 border-card-foreground" onClick={() => setPrepopulateOpen(true)}>
                  <Library className="h-4 w-4" />
                  Prepopulate from Standards
                </Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-xl border-2 border-card-foreground bg-primary-foreground text-card-foreground">
                    <Plus className="h-4 w-4" />
                    New Unit
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Unit</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Unit Title</Label>
                      <Input placeholder="e.g. Ecosystems & Biodiversity" value={newUnit.title} onChange={e => setNewUnit(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea placeholder="Brief overview of the unit..." value={newUnit.description} onChange={e => setNewUnit(p => ({ ...p, description: e.target.value }))} rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Discipline</Label>
                        <Select value={newUnit.discipline} onValueChange={v => setNewUnit(p => ({ ...p, discipline: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Grade Level</Label>
                        <Select value={newUnit.grade_level} onValueChange={v => setNewUnit(p => ({ ...p, grade_level: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input type="date" value={newUnit.date_start} onChange={e => setNewUnit(p => ({ ...p, date_start: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input type="date" value={newUnit.date_end} onChange={e => setNewUnit(p => ({ ...p, date_end: e.target.value }))} />
                      </div>
                    </div>
                    <Button onClick={handleCreate} className="w-full rounded-xl" disabled={!newUnit.title.trim()}>Create Unit</Button>
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : units.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Layers className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No units yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Create your first unit to start organizing lesson plans</p>
                  <Button onClick={() => setCreateOpen(true)} className="gap-2 rounded-xl">
                    <Plus className="h-4 w-4" /> Create First Unit
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <DisciplineGroupedUnits
                units={units}
                navigate={navigate}
                onDuplicate={handleDuplicate}
                onDelete={(id, title) => setDeleteTarget({ id, title })}
                dragIdx={dragIdx}
                overIdx={overIdx}
                onDragStart={handleUnitDragStart}
                onDragEnd={handleUnitDragEnd}
                onDragOver={handleUnitDragOver}
              />
            )}
          </TabsContent>

          <TabsContent value="curriculum" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setGenerateOpen(true)} className="gap-2 rounded-xl" size="sm">
                <Sparkles className="h-4 w-4" />
                AI Generate
              </Button>
            </div>
            <CurriculumEditor
              units={units.map(u => ({ id: u.id, title: u.title, discipline: u.discipline, grade_level: u.grade_level, description: u.description }))}
              onRefreshUnits={fetchUnits}
            />
          </TabsContent>
        </Tabs>
      </main>

      <GenerateContentDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onComplete={fetchUnits}
        defaultContentType="reading"
      />
      <PrepopulateStandardsDialog
        open={prepopulateOpen}
        onOpenChange={setPrepopulateOpen}
        onComplete={fetchUnits}
        teacherSubjects={profile?.subjects ?? []}
      />
      <ImportNextStepsDialog
        open={importNextStepsOpen}
        onOpenChange={setImportNextStepsOpen}
        units={units}
        onImported={fetchUnits}
      />
      <UniversalImportDialog
        open={universalImportOpen}
        onOpenChange={setUniversalImportOpen}
        units={units}
        onImported={fetchUnits}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong> and all its lessons? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LessonPlanner;
