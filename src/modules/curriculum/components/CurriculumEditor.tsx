import { useState, useEffect, useMemo } from "react";
import { sanitizeRichHtml } from "@/modules/curriculum/lib/sanitize-rich-html";
import { useAuth } from "@/modules/curriculum/config/auth";
import { useCurriculumLessons, type CurriculumLesson } from "@/modules/curriculum/hooks/useCurriculum";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useToast } from "@/modules/curriculum/config/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronRight, GripVertical, Copy,
  BookOpen, Sparkles, Loader2, Eye, RotateCcw, Save, X, FileDown, Library, ExternalLink, Puzzle, Download, Tag,
} from "lucide-react";
import { EmbedActivityPicker, type EmbeddedActivity } from "@/modules/curriculum/components/EmbedActivityPicker";
import { ACTIVITY_TYPES } from "@/modules/curriculum/lib/h5p-types";
import { exportActivityAsH5P } from "@/modules/curriculum/lib/export-h5p";
import type { ActivityType, ActivityContent } from "@/modules/curriculum/lib/h5p-types";
import { useNavigate } from "@/modules/curriculum/config/router";
import { exportCurriculumUnitToDocx, exportCurriculumLessonToDocx } from "@/modules/curriculum/lib/export-curriculum-docx";
import { LessonStandardsPicker } from "@/modules/curriculum/components/LessonStandardsPicker";
import { toast as sonnerToast } from "sonner";
import GenerateContentDialog from "@/modules/curriculum/components/GenerateContentDialog";

/** Convert a string[] (from DB) into a single HTML string for TipTap */
function arrayToHtml(arr: string[]): string {
  if (!arr || arr.length === 0) return "";
  return arr.map(p => {
    // If already contains HTML tags, use as-is
    if (/<[a-z][\s\S]*>/i.test(p)) return p;
    return `<p>${p}</p>`;
  }).join("");
}

/** Convert HTML back to a string[] for DB storage */
function htmlToArray(html: string): string[] {
  if (!html || html === "<p></p>") return [];
  return [html];
}

/** Strip HTML tags for plain-text extraction (AI tagging) */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

interface CurriculumEditorProps {
  units: { id: string; title: string; discipline: string; grade_level: string; description: string }[];
  onRefreshUnits: () => void;
}

export const CurriculumEditor = ({ units, onRefreshUnits }: CurriculumEditorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingLesson, setEditingLesson] = useState<CurriculumLesson | null>(null);
  const [previewingLesson, setPreviewingLesson] = useState<CurriculumLesson | null>(null);
  const [genDialogUnit, setGenDialogUnit] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const SCIENCE_DISCIPLINES = ["Life Science", "Physical Science", "Earth & Space Science"];

  const handleSyncToLibrary = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      for (const discipline of SCIENCE_DISCIPLINES) {
        const disciplineUnits = units.filter(u => u.discipline === discipline);
        if (disciplineUnits.length === 0) continue;

        // Check if a library book already exists for this discipline
        const { data: existing } = await supabase
          .from("library_books")
          .select("id")
          .eq("source_discipline", discipline)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          // Update the existing entry (touch updated_at so it shows as fresh)
          await supabase
            .from("library_books")
            .update({ updated_at: new Date().toISOString(), is_published: true } as any)
            .eq("id", existing.id);
        } else {
          // Create a new library book entry
          await supabase
            .from("library_books")
            .insert({
              user_id: user.id,
              title: `${discipline} Readings`,
              file_path: `curriculum/${discipline.toLowerCase().replace(/\s+/g, "-")}`,
              file_size: 0,
              is_published: true,
              source_discipline: discipline,
            } as any);
        }
      }
      sonnerToast.success("Curriculum readings synced to library!");
    } catch (err: any) {
      sonnerToast.error(err.message || "Failed to sync to library");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 border-r border-border pr-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Curriculum Editor</span>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          disabled={syncing || units.length === 0}
          onClick={handleSyncToLibrary}
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Library className="h-3.5 w-3.5" />}
          {syncing ? "Syncing…" : "Sync to Library"}
        </Button>
        <span className="text-xs text-muted-foreground">{units.length} units</span>
      </div>

      {/* Units */}
      {units.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No units yet. Create a unit from the Units tab to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map((unit, idx) => (
            <UnitSection
              key={unit.id}
              refreshKey={refreshKey}
              unit={unit}
              index={idx}
              isExpanded={expandedUnit === unit.id}
              onToggle={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
              onEditLesson={setEditingLesson}
              onPreviewLesson={setPreviewingLesson}
              onOpenGenerate={() => setGenDialogUnit(unit.id)}
            />
          ))}
        </div>
      )}

      {/* Lesson Editor Dialog */}
      {editingLesson && (
        <LessonEditorDialog
          lesson={editingLesson}
          open={!!editingLesson}
          onOpenChange={(open) => !open && setEditingLesson(null)}
        />
      )}

      {/* Reading Preview Dialog */}
      {previewingLesson && (
        <ReadingPreviewDialog
          lesson={previewingLesson}
          open={!!previewingLesson}
          onOpenChange={(open) => !open && setPreviewingLesson(null)}
        />
      )}

      {/* AI Generate Dialog (unified) */}
      <GenerateContentDialog
        open={!!genDialogUnit}
        onOpenChange={(open) => !open && setGenDialogUnit(null)}
        onComplete={() => {
          setGenDialogUnit(null);
          setRefreshKey(k => k + 1);
        }}
        defaultContentType="reading"
        unitId={genDialogUnit || undefined}
      />
    </div>
  );
};

/* ─── Unit Section ─── */
function UnitSection({
  unit,
  index,
  isExpanded,
  onToggle,
  onEditLesson,
  onPreviewLesson,
  onOpenGenerate,
  refreshKey,
}: {
  unit: { id: string; title: string; discipline: string; grade_level: string };
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEditLesson: (lesson: CurriculumLesson) => void;
  onPreviewLesson: (lesson: CurriculumLesson) => void;
  onOpenGenerate: () => void;
  refreshKey: number;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lessons, loading, createLesson, deleteLesson, reorderLessons } = useCurriculumLessons(isExpanded ? unit.id : undefined, refreshKey);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<{ id: string; title: string } | null>(null);

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const fromIdx = lessons.findIndex(l => l.id === dragId);
    const toIdx = lessons.findIndex(l => l.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...lessons];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await reorderLessons(reordered);
    sonnerToast.success("Lessons reordered");
    setDragId(null);
    setDragOverId(null);
  };

  const [addingLesson, setAddingLesson] = useState(false);

  const handleAddLesson = async () => {
    if (!user || addingLesson) return;
    setAddingLesson(true);

    // 1. Always create the curriculum_lessons row (reading container).
    const created = await createLesson({
      unit_id: unit.id,
      title: "New Lesson",
      sort_order: lessons.length,
    });
    if (!created) {
      setAddingLesson(false);
      return;
    }

    // 2. Also generate a UDL lesson_plans row tied to the same unit so the
    //    LessonPlanEditor opens with a fully scripted, UDL-aligned plan.
    sonnerToast.loading("Generating UDL lesson plan… (~10–20s)", { id: "udl-gen" });
    try {
      const { createUdlLessonPlan } = await import("@/modules/curriculum/lib/create-udl-lesson");

      // Pull existing lesson_plans count for sort_order
      const { count } = await supabase
        .from("lesson_plans")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", unit.id);

      // Pull standards already tagged anywhere in this unit so the AI has an anchor.
      const { data: stdRows } = await supabase
        .from("lesson_plan_standards")
        .select("ngss_code, ngss_description, lesson_plan_id, lesson_plans!inner(unit_id)")
        .eq("lesson_plans.unit_id", unit.id);
      const seen = new Set<string>();
      const standards = (stdRows || [])
        .filter((s: any) => {
          if (seen.has(s.ngss_code)) return false;
          seen.add(s.ngss_code);
          return true;
        })
        .map((s: any) => ({ ngss_code: s.ngss_code, ngss_description: s.ngss_description }));

      await createUdlLessonPlan({
        userId: user.id,
        unitId: unit.id,
        unitTitle: unit.title,
        discipline: unit.discipline,
        gradeLevel: unit.grade_level,
        title: "New Lesson",
        standards,
        sortOrder: count || 0,
      });
      sonnerToast.success("UDL lesson plan generated", { id: "udl-gen" });
    } catch (err: any) {
      console.error("UDL generation failed", err);
      sonnerToast.error(`Lesson created, but UDL generation failed: ${err.message || "Unknown error"}`, { id: "udl-gen" });
    } finally {
      setAddingLesson(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary"
        >
          {index + 1}
        </div>
        <button onClick={onToggle} className="flex flex-1 items-center gap-2 text-left min-w-0">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground">{unit.title}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {unit.discipline && <span>{unit.discipline}</span>}
              {unit.grade_level && <><span>·</span><span>{unit.grade_level}</span></>}
            </div>
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          disabled={lessons.length === 0}
          onClick={async () => {
            try {
              await exportCurriculumUnitToDocx(unit, lessons);
              sonnerToast.success("Unit exported to Word!");
            } catch (err: any) {
              sonnerToast.error(err.message || "Export failed");
            }
          }}
        >
          <FileDown className="h-3.5 w-3.5" /> Export
        </Button>
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={onOpenGenerate}>
          <Sparkles className="h-3.5 w-3.5" /> AI Generate
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t border-border">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground bg-muted/20 border-b border-border/50">
            <BookOpen className="h-3 w-3" />
            <span>Curriculum</span>
            <ChevronRight className="h-3 w-3" />
            <button
              onClick={() => navigate(`/app/curriculum/units/${unit.id}`)}
              className="font-medium text-primary hover:underline transition-colors"
            >
              {unit.title}
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {lessons.map((lesson, lessonIdx) => (
                <div
                  key={lesson.id}
                  draggable
                  onDragStart={() => setDragId(lesson.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(lesson.id); }}
                  onDrop={() => handleDrop(lesson.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  className={`group flex items-center gap-3 px-4 py-3 transition-all hover:bg-muted/30 ${
                    dragOverId === lesson.id && dragId !== lesson.id ? "ring-2 ring-inset ring-primary" : ""
                  } ${dragId === lesson.id ? "opacity-50" : ""}`}
                >
                  <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground/30 active:cursor-grabbing" />
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                    {String(lessonIdx + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{(lesson.objectives as any[])?.length || 0} objectives</span>
                      {lesson.reading_title && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Reading</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onPreviewLesson(lesson)}
                      title="Preview Reading"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-primary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => navigate(`/app/curriculum/units/${unit.id}`)}
                      title="View Lesson Plans"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await exportCurriculumLessonToDocx(lesson);
                          sonnerToast.success("Lesson exported!");
                        } catch (err: any) {
                          sonnerToast.error(err.message || "Export failed");
                        }
                      }}
                      title="Export to Word"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onEditLesson(lesson)} title="Edit" className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        await createLesson({
                          unit_id: unit.id,
                          title: `${lesson.title} (Copy)`,
                          sort_order: lessons.length,
                          objectives: lesson.objectives,
                          intro: lesson.intro,
                          explanation: lesson.explanation,
                          key_terms: lesson.key_terms,
                          reading_title: lesson.reading_title,
                          reading_paragraphs: lesson.reading_paragraphs,
                          interactive_activities: lesson.interactive_activities as any,
                          image_url: lesson.image_url,
                        });
                        sonnerToast.success("Lesson duplicated");
                      }}
                      title="Duplicate"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingLesson({ id: lesson.id, title: lesson.title })}
                      title="Delete"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="p-4">
                <button
                  onClick={handleAddLesson}
                  disabled={addingLesson}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addingLesson ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating UDL lesson…</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Add Lesson (UDL)</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deletingLesson} onOpenChange={(open) => !open && setDeletingLesson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{deletingLesson?.title}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletingLesson) {
                  await deleteLesson(deletingLesson.id);
                  setDeletingLesson(null);
                  sonnerToast.success("Lesson deleted");
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


/* ─── Lesson Editor Dialog ─── */
function LessonEditorDialog({
  lesson,
  open,
  onOpenChange,
}: {
  lesson: CurriculumLesson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [objectives, setObjectives] = useState<string[]>(lesson.objectives || []);
  const [keyTerms, setKeyTerms] = useState<{ term: string; definition: string }[]>(lesson.key_terms || []);
  const [introHtml, setIntroHtml] = useState(() => arrayToHtml(lesson.intro || []));
  const [explanationHtml, setExplanationHtml] = useState(() => arrayToHtml(lesson.explanation || []));
  const [readingTitle, setReadingTitle] = useState(lesson.reading_title || "");
  const [readingHtml, setReadingHtml] = useState(() => arrayToHtml(lesson.reading_paragraphs || []));
  const [interactiveActivities, setInteractiveActivities] = useState<{ activity_id: string; title: string; activity_type: string }[]>(
    (lesson.interactive_activities as any[]) || []
  );
  const [embedPickerOpen, setEmbedPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Standards state
  const [standards, setStandards] = useState<{ id: string; ngss_code: string; ngss_description: string; matched_terms: string[] }[]>([]);
  const [standardsPickerOpen, setStandardsPickerOpen] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);

  // Load existing standards
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("curriculum_lesson_standards")
        .select("*")
        .eq("lesson_id", lesson.id);
      if (data) setStandards(data);
    };
    load();
  }, [lesson.id]);

  const handleRemoveStandard = async (stdId: string) => {
    await supabase.from("curriculum_lesson_standards").delete().eq("id", stdId);
    setStandards(s => s.filter(x => x.id !== stdId));
  };

  const handlePickerSave = async (selected: { code: string; description: string }[]) => {
    // Delete all existing, re-insert
    await supabase.from("curriculum_lesson_standards").delete().eq("lesson_id", lesson.id);
    if (selected.length > 0) {
      const rows = selected.map(s => ({
        lesson_id: lesson.id,
        ngss_code: s.code,
        ngss_description: s.description,
        matched_terms: [],
      }));
      await supabase.from("curriculum_lesson_standards").insert(rows);
    }
    // Reload
    const { data } = await supabase
      .from("curriculum_lesson_standards")
      .select("*")
      .eq("lesson_id", lesson.id);
    if (data) setStandards(data);
    sonnerToast.success("Standards updated");
  };

  const handleAutoTag = async () => {
    // Build a text blob from lesson content
    const parts: string[] = [title];
    objectives.forEach(o => parts.push(o));
    keyTerms.forEach(kt => { parts.push(kt.term); parts.push(kt.definition); });
    parts.push(stripHtml(introHtml));
    parts.push(stripHtml(explanationHtml));
    parts.push(stripHtml(readingHtml));
    const text = parts.filter(Boolean).join(" ").substring(0, 4000);
    if (text.length < 20) {
      sonnerToast.error("Not enough content to auto-tag");
      return;
    }

    setAutoTagging(true);
    try {
      const { data, error } = await supabase.functions.invoke("standards-tagger", {
        body: {
          questions: [{ id: 1, question_text: text }],
          framework: "ngss",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const tags = data?.tags?.[0]?.standards || [];
      if (tags.length === 0) {
        sonnerToast.info("No standards matched this content");
        setAutoTagging(false);
        return;
      }

      // Merge with existing (avoid duplicates)
      const existingCodes = new Set(standards.map(s => s.ngss_code));
      const newTags = tags.filter((t: any) => !existingCodes.has(t.code));

      if (newTags.length > 0) {
        const rows = newTags.map((t: any) => ({
          lesson_id: lesson.id,
          ngss_code: t.code,
          ngss_description: t.description,
          matched_terms: t.matched_terms || [],
        }));
        await supabase.from("curriculum_lesson_standards").insert(rows);
        // Reload
        const { data: refreshed } = await supabase
          .from("curriculum_lesson_standards")
          .select("*")
          .eq("lesson_id", lesson.id);
        if (refreshed) setStandards(refreshed);
      }
      sonnerToast.success(`${newTags.length} new standard(s) tagged`);
    } catch (err: any) {
      sonnerToast.error(err.message || "Auto-tagging failed");
    } finally {
      setAutoTagging(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("curriculum_lessons")
      .update({
        title,
        objectives: objectives as any,
        key_terms: keyTerms as any,
        intro: htmlToArray(introHtml) as any,
        explanation: htmlToArray(explanationHtml) as any,
        reading_title: readingTitle || null,
        reading_paragraphs: htmlToArray(readingHtml) as any,
        interactive_activities: interactiveActivities as any,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", lesson.id);
    setSaving(false);
    if (error) {
      sonnerToast.error(error.message);
    } else {
      sonnerToast.success("Lesson saved!");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lesson</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Standards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" /> Standards
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={handleAutoTag}
                  disabled={autoTagging}
                >
                  {autoTagging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI Tag
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={() => setStandardsPickerOpen(true)}
                >
                  <Plus className="h-3 w-3" /> Browse
                </Button>
              </div>
            </div>
            {standards.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {standards.map(s => (
                  <Badge key={s.id} variant="secondary" className="gap-1 text-xs pr-1">
                    <span className="font-semibold">{s.ngss_code}</span>
                    <button
                      onClick={() => handleRemoveStandard(s.id)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No standards tagged yet. Use AI Tag or Browse to add.</p>
            )}
            {standards.some(s => s.matched_terms?.length > 0) && (
              <div className="text-[11px] text-muted-foreground italic">
                Matched: {standards.flatMap(s => s.matched_terms).filter(Boolean).slice(0, 8).join(", ")}
              </div>
            )}
            <LessonStandardsPicker
              open={standardsPickerOpen}
              onOpenChange={setStandardsPickerOpen}
              selected={standards.map(s => ({ code: s.ngss_code, description: s.ngss_description }))}
              onSave={handlePickerSave}
            />
          </div>

          {/* Objectives */}
          <div className="space-y-2">
            <Label>Objectives</Label>
            {objectives.map((obj, i) => (
              <div key={i} className="flex gap-2">
                <Input value={obj} onChange={(e) => { const n = [...objectives]; n[i] = e.target.value; setObjectives(n); }} />
                <Button variant="ghost" size="icon" onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setObjectives([...objectives, ""])} className="gap-1">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>

          {/* Key Terms */}
          <div className="space-y-2">
            <Label>Key Terms</Label>
            {keyTerms.map((kt, i) => (
              <div key={i} className="flex gap-2">
                <Input value={kt.term} placeholder="Term" onChange={(e) => { const n = [...keyTerms]; n[i] = { ...n[i], term: e.target.value }; setKeyTerms(n); }} className="w-1/3" />
                <Input value={kt.definition} placeholder="Definition" onChange={(e) => { const n = [...keyTerms]; n[i] = { ...n[i], definition: e.target.value }; setKeyTerms(n); }} />
                <Button variant="ghost" size="icon" onClick={() => setKeyTerms(keyTerms.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setKeyTerms([...keyTerms, { term: "", definition: "" }])} className="gap-1">
              <Plus className="h-3 w-3" /> Add Term
            </Button>
          </div>

          {/* Reading */}
          <div className="space-y-2">
            <Label>Reading Title</Label>
            <div className="flex gap-2">
              <Input value={readingTitle} onChange={(e) => setReadingTitle(e.target.value)} placeholder="Reading passage title" className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1 text-xs"
                title="Reset to lesson title"
                onClick={() => setReadingTitle(title)}
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reading Content</Label>
            <RichTextEditor
              content={readingHtml}
              onChange={setReadingHtml}
              placeholder="Write the reading passage content..."
              compact
            />
          </div>

          {/* Interactive Activities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Puzzle className="h-3.5 w-3.5 text-primary" /> Interactive Activities</Label>
              <span className="text-xs text-muted-foreground">{interactiveActivities.length} embedded</span>
            </div>
            {interactiveActivities.map((ea, idx) => {
              const typeInfo = ACTIVITY_TYPES.find(t => t.type === ea.activity_type);
              return (
                <div key={ea.activity_id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50">
                  <Puzzle className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm flex-1 truncate">{ea.title}</span>
                  <span className="text-[10px] text-muted-foreground">{typeInfo?.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Export H5P"
                    onClick={async () => {
                      const { data } = await supabase.from("h5p_activities").select("content, activity_type, title").eq("id", ea.activity_id).single();
                      if (data) {
                        await exportActivityAsH5P((data as any).title, (data as any).activity_type as ActivityType, (data as any).content as ActivityContent);
                        sonnerToast.success("H5P file downloaded");
                      }
                    }}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70" onClick={() => setInteractiveActivities(interactiveActivities.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setEmbedPickerOpen(true)}>
              <Plus className="h-3 w-3" /> Embed Activity
            </Button>
            <EmbedActivityPicker
              open={embedPickerOpen}
              onOpenChange={setEmbedPickerOpen}
              excludeIds={interactiveActivities.map(e => e.activity_id)}
              onSelect={(a) => setInteractiveActivities([...interactiveActivities, { activity_id: a.id, title: a.title, activity_type: a.activity_type }])}
            />
          </div>

          {/* Introduction */}
          <div className="space-y-2">
            <Label>Introduction</Label>
            <RichTextEditor
              content={introHtml}
              onChange={setIntroHtml}
              placeholder="Write the lesson introduction..."
              compact
            />
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <Label>Explanation</Label>
            <RichTextEditor
              content={explanationHtml}
              onChange={setExplanationHtml}
              placeholder="Write the lesson explanation..."
              compact
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2 rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Lesson"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reading Preview Dialog ─── */
function ReadingPreviewDialog({
  lesson,
  open,
  onOpenChange,
}: {
  lesson: CurriculumLesson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const readingHtml = arrayToHtml(lesson.reading_paragraphs || []);
  const introHtml = arrayToHtml(lesson.intro || []);
  const explanationHtml = arrayToHtml(lesson.explanation || []);
  const hasReading = readingHtml && readingHtml !== "<p></p>";
  const hasIntro = introHtml && introHtml !== "<p></p>";
  const hasExplanation = explanationHtml && explanationHtml !== "<p></p>";
  const hasContent = hasReading || hasIntro || hasExplanation || (lesson.objectives as any[])?.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Reading Preview
          </DialogTitle>
        </DialogHeader>

        {!hasContent ? (
          <div className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No reading content yet. Edit the lesson to add content.</p>
          </div>
        ) : (
          <article className="prose prose-sm max-w-none space-y-6 pt-2">
            {/* Title */}
            <div className="border-b border-border pb-4">
              <h1 className="text-xl font-bold text-foreground mb-1">{lesson.reading_title || lesson.title}</h1>
              {(lesson.objectives as any[])?.length > 0 && (
                <div className="mt-3 rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <p className="text-xs font-semibold text-primary mb-1.5">Learning Objectives</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(lesson.objectives as string[]).map((obj, i) => (
                      <li key={i} className="text-xs text-foreground/80">{obj}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Key Terms */}
            {(lesson.key_terms as any[])?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {(lesson.key_terms as { term: string; definition: string }[]).map((kt, i) => (
                  <div key={i} className="rounded-lg bg-accent/50 p-2.5">
                    <span className="text-xs font-bold text-foreground">{kt.term}</span>
                    <span className="text-xs text-muted-foreground"> — {kt.definition}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Introduction */}
            {hasIntro && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary" /> Introduction
                </h2>
                <div className="text-sm text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(introHtml) }} />
              </section>
            )}

            {/* Explanation */}
            {hasExplanation && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary" /> Explanation
                </h2>
                <div className="text-sm text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(explanationHtml) }} />
              </section>
            )}

            {/* Reading */}
            {hasReading && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary" /> Reading
                </h2>
                <div className="text-sm text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(readingHtml) }} />
              </section>
            )}
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}