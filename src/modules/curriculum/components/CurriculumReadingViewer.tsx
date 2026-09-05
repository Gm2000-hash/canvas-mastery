import { useState, useEffect, useCallback, useRef } from 'react';
import { sanitizeRichHtml } from '@/modules/curriculum/lib/sanitize-rich-html';
import { supabase } from '@/modules/curriculum/config/supabase';
import { useAuth } from '@/modules/curriculum/config/auth';
import { useCanvasConfig } from '@/modules/curriculum/config/canvas-config';
import { getCourses, type Course, type CanvasConfig } from '@/modules/curriculum/config/canvas-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/modules/curriculum/components/RichTextEditor';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ChevronLeft, ChevronRight, BookOpen, Upload, Loader2, CheckCircle, Search, List, Pencil, Save, Undo2, Redo2, Sparkles, Target, Trash2, RotateCcw, FileDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ReadingEditToolbar, ItemToolbar, type EditorAction, type SectionKind } from '@/modules/curriculum/components/ReadingEditToolbar';
import { useUndoRedo } from '@/modules/curriculum/hooks/useUndoRedo';
import { toast } from 'sonner';
import type { CurriculumLesson } from '@/modules/curriculum/hooks/useCurriculum';
import { LessonStandardsPicker } from '@/modules/curriculum/components/LessonStandardsPicker';
import { exportReadingAsPdf, exportTextbookAsPdf } from '@/modules/curriculum/lib/export-reading-pdf';
import { exportReadingAsDocx, type ReadingExportOptions } from '@/modules/curriculum/lib/export-reading-docx';
import { exportReadingToGoogleDoc } from '@/modules/curriculum/lib/google-export';
import { useGoogleConnection } from '@/modules/curriculum/config/google-connection';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReadingResourceInsertDialog } from '@/modules/curriculum/components/ReadingResourceInsertDialog';
import GoogleImportDialog from '@/modules/curriculum/components/GoogleImportDialog';
import { ChapterViewer } from '@/modules/curriculum/components/textbook/ChapterViewer';
import { ChapterEditor } from '@/modules/curriculum/components/textbook/ChapterEditor';
import { useConvertToChapter } from '@/modules/curriculum/components/textbook/useConvertToChapter';
import { chapterToLegacyFields, isChapter, normalizeChapter, validateReadingTemplate, type TextbookChapter } from '@/modules/curriculum/lib/textbook-chapter';
import { TemplateBadge } from '@/modules/curriculum/components/textbook/TemplateBadge';

interface CurriculumReadingViewerProps {
  discipline: string;
  title: string;
  onClose: () => void;
  /** If provided, scroll to this lesson index on open */
  initialLessonIndex?: number;
}

export function CurriculumReadingViewer({ discipline, title, onClose, initialLessonIndex }: CurriculumReadingViewerProps) {
  const { user } = useAuth();
  const { config } = useCanvasConfig();
  const [lessons, setLessons] = useState<CurriculumLesson[]>([]);
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentLesson, setCurrentLesson] = useState<number | null>(initialLessonIndex ?? null);
  const [pushOpen, setPushOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { state: editData, set: setEditData, undo: undoEdit, redo: redoEdit, reset: resetEditData, canUndo, canRedo } = useUndoRedo<Partial<CurriculumLesson>>(null);
  const [editFont, setEditFont] = useState('font-sans');
  const [editFontSize, setEditFontSize] = useState('text-sm');
  const [editLineSpacing, setEditLineSpacing] = useState('leading-relaxed');
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [lessonStandards, setLessonStandards] = useState<{ id: string; ngss_code: string; ngss_description: string; matched_terms: string[] }[]>([]);
  const [aiTagging, setAiTagging] = useState(false);
  const [standardsPickerOpen, setStandardsPickerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docxOptions, setDocxOptions] = useState<Required<ReadingExportOptions>>({
    includeObjectives: true,
    includeKeyTerms: true,
    includeIntro: true,
    includeExplanation: true,
    includeClosingUdl: true,
    includeSourcesPage: true,
  });
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingGdoc, setExportingGdoc] = useState(false);
  const [googleImportOpen, setGoogleImportOpen] = useState(false);
  const { status: googleStatus } = useGoogleConnection();
  const { convert: convertToChapter, converting } = useConvertToChapter();
  const [bulkConverting, setBulkConverting] = useState<string | null>(null);

  /** AI-restructure the current reading into the textbook chapter format and open it for review. */
  const handleConvertCurrent = async () => {
    if (!lesson) return;
    const ch = await convertToChapter({
      title: lesson.title,
      lesson: { title: lesson.title, objectives: lesson.objectives, intro: lesson.intro, explanation: lesson.explanation, key_terms: lesson.key_terms, reading_title: lesson.reading_title, reading_paragraphs: lesson.reading_paragraphs },
      standards: lessonStandards.map(s => ({ code: s.ngss_code, description: s.ngss_description })),
    });
    if (!ch) return;
    resetEditData({ ...chapterToLegacyFields(ch), chapter: ch } as any);
    setEditing(true);
  };

  /** Convert every unconverted reading in a unit, one after another, saving each. */
  const handleConvertUnit = async (unitId: string) => {
    if (!user) return;
    const targets = lessons.filter(l => l.unit_id === unitId && !isChapter(l.chapter));
    if (!targets.length) { toast.info('Every reading in this unit is already a chapter'); return; }
    setBulkConverting(unitId);
    let done = 0;
    const tId = toast.loading(`Converting 0 / ${targets.length} readings…`);
    try {
      for (const l of targets) {
        const { data: stds } = await (supabase.from('curriculum_lesson_standards' as any) as any).select('ngss_code, ngss_description').eq('lesson_id', l.id);
        const { data, error } = await supabase.functions.invoke('convert-reading-to-chapter', {
          body: { title: l.title, lesson: { title: l.title, objectives: l.objectives, intro: l.intro, explanation: l.explanation, key_terms: l.key_terms, reading_title: l.reading_title, reading_paragraphs: l.reading_paragraphs }, standards: (stds || []).map((s: any) => ({ code: s.ngss_code, description: s.ngss_description })) },
        });
        if (error || data?.error) throw new Error(data?.error || (error as any)?.message || 'Conversion failed');
        const ch = normalizeChapter(data.chapter, l.title);
        const legacy = chapterToLegacyFields(ch);
        const { error: uErr } = await supabase.from('curriculum_lessons').update({ ...legacy, chapter: ch, updated_at: new Date().toISOString() } as any).eq('id', l.id).eq('user_id', user.id);
        if (uErr) throw uErr;
        setLessons(prev => prev.map(x => x.id === l.id ? { ...x, ...legacy, chapter: ch } as CurriculumLesson : x));
        done++;
        toast.loading(`Converting ${done} / ${targets.length} readings…`, { id: tId });
      }
      toast.success(`Converted ${done} reading${done === 1 ? '' : 's'} to textbook chapters`, { id: tId });
    } catch (err: any) {
      toast.error(`${err?.message || 'Conversion failed'} (${done} of ${targets.length} done)`, { id: tId });
    } finally {
      setBulkConverting(null);
    }
  };

  const handleDeleteReading = async (lessonId: string) => {
    setDeletingId(lessonId);
    try {
      // Delete associated standards first
      await (supabase.from('curriculum_lesson_standards' as any) as any).delete().eq('lesson_id', lessonId);
      // Delete the lesson
      const { error } = await supabase.from('curriculum_lessons').delete().eq('id', lessonId);
      if (error) throw error;
      // Update local state
      const deletedIdx = lessons.findIndex(l => l.id === lessonId);
      const newLessons = lessons.filter(l => l.id !== lessonId);
      setLessons(newLessons);
      if (currentLesson !== null) {
        if (deletedIdx === currentLesson) {
          setCurrentLesson(null);
        } else if (deletedIdx < currentLesson) {
          setCurrentLesson(currentLesson - 1);
        }
      }
      toast.success('Reading deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete reading');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredIndices = lessons.reduce<number[]>((acc, lesson, i) => {
    if (!searchQuery.trim()) { acc.push(i); return acc; }
    const q = searchQuery.toLowerCase();
    const titleMatch = lesson.title.toLowerCase().includes(q);
    const termsMatch = (lesson.key_terms as { term: string; definition: string }[])?.some(
      kt => kt.term.toLowerCase().includes(q) || kt.definition.toLowerCase().includes(q)
    );
    const readingMatch = lesson.reading_title?.toLowerCase().includes(q);
    const textMatch = (lesson.reading_paragraphs as string[])?.some(p => p.toLowerCase().includes(q));
    if (titleMatch || termsMatch || readingMatch || textMatch) acc.push(i);
    return acc;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: units } = await supabase
        .from('units')
        .select('id, title, sort_order')
        .eq('user_id', user.id)
        .eq('discipline', discipline)
        .order('sort_order');

      if (!units?.length) {
        setLessons([]);
        setLoading(false);
        return;
      }

      const uMap: Record<string, string> = {};
      units.forEach(u => { uMap[u.id] = u.title; });
      setUnitMap(uMap);

      const unitIds = units.map(u => u.id);
      const [lessonRes, planRes] = await Promise.all([
        supabase
          .from('curriculum_lessons')
          .select('*')
          .eq('user_id', user.id)
          .in('unit_id', unitIds)
          .order('sort_order'),
        supabase
          .from('lesson_plans')
          .select('id, unit_id, title, objectives')
          .eq('user_id', user.id)
          .in('unit_id', unitIds),
      ]);

      const rawLessons = (lessonRes.data || []) as unknown as CurriculumLesson[];

      // Build a map of lesson plans by unit_id for matching
      const plansByUnit: Record<string, { title: string; objectives: string }[]> = {};
      (planRes.data || []).forEach((p: any) => {
        if (!plansByUnit[p.unit_id]) plansByUnit[p.unit_id] = [];
        plansByUnit[p.unit_id].push({ title: p.title, objectives: p.objectives || '' });
      });

      // Merge lesson plan objectives into curriculum lessons
      const enriched = rawLessons.map(lesson => {
        const plans = plansByUnit[lesson.unit_id] || [];
        // Find matching plan by similar title (case-insensitive substring match)
        const match = plans.find(p => {
          const pTitle = p.title.toLowerCase().trim();
          const lTitle = lesson.title.toLowerCase().trim();
          return pTitle === lTitle || pTitle.includes(lTitle) || lTitle.includes(pTitle);
        });
        if (match && match.objectives) {
          // Parse objectives from the lesson plan (stored as text, one per line)
          const planObjectives = match.objectives
            .split('\n')
            .map((o: string) => o.replace(/^[-•*]\s*/, '').trim())
            .filter((o: string) => o.length > 0);
          const existingObjectives = (lesson.objectives as string[]) || [];
          // Add plan objectives that aren't already present
          const newObjectives = planObjectives.filter(
            (po: string) => !existingObjectives.some(eo => eo.toLowerCase() === po.toLowerCase())
          );
          if (newObjectives.length > 0) {
            return { ...lesson, objectives: [...existingObjectives, ...newObjectives] };
          }
        }
        return lesson;
      });

      setLessons(enriched);
      setLoading(false);
    })();
  }, [user, discipline]);

  useEffect(() => {
    if (initialLessonIndex != null && initialLessonIndex >= 0) {
      setCurrentLesson(initialLessonIndex);
    }
  }, [initialLessonIndex]);

  const lesson = currentLesson !== null ? lessons[currentLesson] : undefined;

  // Load standards for current lesson
  useEffect(() => {
    if (!lesson) { setLessonStandards([]); return; }
    supabase
      .from('curriculum_lesson_standards' as any)
      .select('*')
      .eq('lesson_id', lesson.id)
      .then(({ data }: any) => setLessonStandards(data || []));
  }, [lesson?.id]);

  // Auto-enable edit mode when a lesson loads
  useEffect(() => {
    if (lesson && !editing) {
      resetEditData({
        title: lesson.title,
        objectives: [...(lesson.objectives as string[])],
        key_terms: [...(lesson.key_terms as { term: string; definition: string }[])].map(kt => ({ ...kt })),
        intro: [...(lesson.intro as string[])],
        explanation: [...(lesson.explanation as string[])],
        reading_title: lesson.reading_title,
        reading_paragraphs: [...(lesson.reading_paragraphs as string[] || [])],
        chapter: isChapter(lesson.chapter) ? normalizeChapter(lesson.chapter, lesson.title) : null,
      });
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  const handleAiTagReading = async () => {
    if (!lesson) return;
    setAiTagging(true);
    try {
      const objectives = ((lesson.objectives as string[]) || []).join('. ');
      const terms = ((lesson.key_terms as { term: string }[]) || []).map(k => k.term).join(', ');
      const intro = ((lesson.intro as string[]) || []).join(' ');
      const explanation = ((lesson.explanation as string[]) || []).join(' ');
      const reading = ((lesson.reading_paragraphs as string[]) || []).join(' ');
      const text = `${lesson.title}\n\nObjectives: ${objectives}\n\nKey Terms: ${terms}\n\n${intro}\n\n${explanation}\n\n${reading}`.substring(0, 4000);

      const { data, error } = await supabase.functions.invoke('standards-tagger', {
        body: { questions: [{ id: 1, question_text: text }], framework: 'ngss' },
      });
      if (error) throw error;
      const tags = data?.tags?.[0]?.standards || [];
      if (tags.length === 0) {
        toast.info('No matching NGSS standards found for this reading.');
        setAiTagging(false);
        return;
      }
      await (supabase.from('curriculum_lesson_standards' as any) as any).delete().eq('lesson_id', lesson.id);
      const inserts = tags.map((t: any) => ({
        lesson_id: lesson.id, ngss_code: t.code, ngss_description: t.description, matched_terms: t.matched_terms || [],
      }));
      await (supabase.from('curriculum_lesson_standards' as any) as any).insert(inserts);
      const { data: refreshed } = await (supabase.from('curriculum_lesson_standards' as any) as any).select('*').eq('lesson_id', lesson.id);
      setLessonStandards(refreshed || []);
      toast.success(`Tagged with ${tags.length} NGSS standard${tags.length !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err?.message || 'AI tagging failed');
    } finally {
      setAiTagging(false);
    }
  };

  const handleManualStandardsSave = async (selected: { code: string; description: string }[]) => {
    if (!lesson) return;
    try {
      await (supabase.from('curriculum_lesson_standards' as any) as any).delete().eq('lesson_id', lesson.id);
      if (selected.length > 0) {
        const inserts = selected.map(s => ({
          lesson_id: lesson.id, ngss_code: s.code, ngss_description: s.description, matched_terms: [],
        }));
        await (supabase.from('curriculum_lesson_standards' as any) as any).insert(inserts);
      }
      const { data: refreshed } = await (supabase.from('curriculum_lesson_standards' as any) as any).select('*').eq('lesson_id', lesson.id);
      setLessonStandards(refreshed || []);
      toast.success('Standards updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update standards');
    }
  };

  const handleRemoveStandard = async (standardId: string) => {
    try {
      await (supabase.from('curriculum_lesson_standards' as any) as any).delete().eq('id', standardId);
      setLessonStandards(prev => prev.filter(s => s.id !== standardId));
      toast.success('Standard removed');
    } catch (err: any) {
      toast.error('Failed to remove standard');
    }
  };

  // Enter edit mode
  const startEditing = () => {
    if (!lesson) return;
    resetEditData({
      title: lesson.title,
      objectives: [...(lesson.objectives as string[])],
      key_terms: [...(lesson.key_terms as { term: string; definition: string }[])].map(kt => ({ ...kt })),
      intro: [...(lesson.intro as string[])],
      explanation: [...(lesson.explanation as string[])],
      reading_title: lesson.reading_title,
      reading_paragraphs: [...(lesson.reading_paragraphs as string[] || [])],
      chapter: isChapter(lesson.chapter) ? normalizeChapter(lesson.chapter, lesson.title) : null,
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    resetEditData(null);
  };

  const saveEdits = async () => {
    if (!lesson || !editData || !user) return;
    setSaving(true);
    try {
      const ch = isChapter(editData.chapter) ? editData.chapter : null;
      const payload = ch
        ? { ...chapterToLegacyFields(ch), chapter: ch }
        : {
          title: editData.title,
          objectives: editData.objectives,
          key_terms: editData.key_terms,
          intro: editData.intro,
          explanation: editData.explanation,
          reading_title: editData.reading_title,
          reading_paragraphs: editData.reading_paragraphs,
          chapter: null,
        };
      if (ch) Object.assign(editData, payload);
      const { error } = await supabase
        .from('curriculum_lessons')
        .update({ ...(payload as any), updated_at: new Date().toISOString() })
        .eq('id', lesson.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      const updated = [...lessons];
      updated[currentLesson as number] = { ...lesson, ...editData } as CurriculumLesson;
      setLessons(updated);
      setEditing(false);
      resetEditData(null);
      toast.success('Reading saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Helper to update editData arrays
  const updateEditArray = (field: keyof CurriculumLesson, index: number, value: string) => {
    if (!editData) return;
    const arr = [...(editData[field] as string[])];
    arr[index] = value;
    setEditData({ ...editData, [field]: arr });
  };

  const updateEditKeyTerm = (index: number, key: 'term' | 'definition', value: string) => {
    if (!editData) return;
    const terms = [...(editData.key_terms as { term: string; definition: string }[])];
    terms[index] = { ...terms[index], [key]: value };
    setEditData({ ...editData, key_terms: terms });
  };

  // Generic array helpers
  const moveItem = (field: string, index: number, dir: 'up' | 'down') => {
    if (!editData) return;
    const arr = [...(editData[field as keyof typeof editData] as any[])];
    const swap = dir === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[index], arr[swap]] = [arr[swap], arr[index]];
    setEditData({ ...editData, [field]: arr });
  };

  const deleteItem = (field: string, index: number) => {
    if (!editData) return;
    const arr = [...(editData[field as keyof typeof editData] as any[])];
    arr.splice(index, 1);
    setEditData({ ...editData, [field]: arr });
  };

  const addItem = (field: string, defaultValue: any) => {
    if (!editData) return;
    const arr = [...((editData[field as keyof typeof editData] as any[]) || []), defaultValue];
    setEditData({ ...editData, [field]: arr });
  };

  const handleEditorAction = (action: EditorAction) => {
    if (!editData) return;
    const fieldMap: Record<SectionKind, string> = {
      objectives: 'objectives',
      key_terms: 'key_terms',
      intro: 'intro',
      explanation: 'explanation',
      reading: 'reading_paragraphs',
    };

    switch (action.type) {
      case 'move':
        if (action.section && action.index != null && action.direction) {
          moveItem(fieldMap[action.section], action.index, action.direction);
        }
        break;
      case 'delete':
        if (action.section && action.index != null) {
          deleteItem(fieldMap[action.section], action.index);
        }
        break;
      case 'add':
        if (action.section === 'key_terms') {
          addItem('key_terms', { term: '', definition: '' });
        } else if (action.section === 'objectives') {
          addItem('objectives', '');
        } else if (action.section === 'intro') {
          addItem('intro', '');
        } else if (action.section === 'explanation') {
          addItem('explanation', '');
        } else if (action.section === 'reading') {
          addItem('reading_paragraphs', '');
          if (!editData.reading_title) {
            setEditData(prev => prev ? { ...prev, reading_title: 'Reading' } : prev);
          }
        }
        break;
      case 'insert-video':
        setVideoDialogOpen(true);
        break;
      case 'insert-activity':
        setResourceDialogOpen(true);
        break;
      case 'set-font':
        if (action.value) setEditFont(action.value);
        break;
      case 'set-size':
        if (action.value) setEditFontSize(action.value);
        break;
      case 'set-spacing':
        if (action.value) setEditLineSpacing(action.value);
        break;
      case 'ai-generate':
        if (action.aiKind) handleAiGenerate(action.aiKind, action.aiSection);
        break;
      case 'ai-undo':
        handleAiUndo();
        break;
      case 'ai-regenerate':
        handleAiRegenerate();
        break;
    }
  };

  const aiHistoryRef = useRef<any[]>([]);
  const lastAiOpRef = useRef<
    | { kind: 'paragraph' | 'objective' | 'key_term' | 'activity' | 'video'; section?: 'intro' | 'explanation' | 'reading' }
    | null
  >(null);

  const pushAiSnapshot = () => {
    if (!editData) return;
    aiHistoryRef.current.push(JSON.parse(JSON.stringify(editData)));
    if (aiHistoryRef.current.length > 20) aiHistoryRef.current.shift();
  };

  const handleAiUndo = () => {
    const prev = aiHistoryRef.current.pop();
    if (!prev) {
      toast.info('Nothing to undo');
      return;
    }
    setEditData(prev);
    toast.success('Reverted last AI insertion');
  };

  const handleAiRegenerate = () => {
    const op = lastAiOpRef.current;
    if (!op) {
      toast.info('No previous AI action to regenerate');
      return;
    }
    handleAiGenerate(op.kind, op.section);
  };

  const [aiGenerating, setAiGenerating] = useState(false);
  const handleAiGenerate = async (
    kind: 'paragraph' | 'objective' | 'key_term' | 'activity' | 'video',
    section?: 'intro' | 'explanation' | 'reading',
  ) => {
    if (!editData || !lesson) return;
    setAiGenerating(true);
    pushAiSnapshot();
    lastAiOpRef.current = { kind, section };
    const tId = toast.loading(`AI generating ${kind.replace('_', ' ')}…`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-reading-insert', {
        body: {
          kind,
          section,
          lesson: {
            title: editData.title,
            objectives: editData.objectives,
            key_terms: editData.key_terms,
            intro: editData.intro,
            explanation: editData.explanation,
            reading_paragraphs: editData.reading_paragraphs,
            reading_title: editData.reading_title,
          },
          standards: lessonStandards.map(s => ({ code: s.ngss_code, description: s.ngss_description })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data?.data || {};

      if (kind === 'paragraph') {
        const targetField =
          section === 'intro' ? 'intro' :
          section === 'explanation' ? 'explanation' : 'reading_paragraphs';
        const html = result.html || result.text || '';
        if (!html) throw new Error('No paragraph returned');
        const arr = [...((editData[targetField as keyof typeof editData] as string[]) || []), html];
        const next: any = { ...editData, [targetField]: arr };
        if (targetField === 'reading_paragraphs' && !editData.reading_title) {
          next.reading_title = 'Reading';
        }
        setEditData(next);
      } else if (kind === 'objective') {
        if (!result.text) throw new Error('No objective returned');
        setEditData({ ...editData, objectives: [...((editData.objectives as string[]) || []), result.text] });
      } else if (kind === 'key_term') {
        if (!result.term) throw new Error('No key term returned');
        setEditData({
          ...editData,
          key_terms: [...((editData.key_terms as any[]) || []), { term: result.term, definition: result.definition || '' }],
        });
      } else if (kind === 'activity') {
        const html = result.html || '';
        if (!html) throw new Error('No activity returned');
        const arr = [...((editData.reading_paragraphs as string[]) || []), html];
        const next: any = { ...editData, reading_paragraphs: arr };
        if (!editData.reading_title) next.reading_title = 'Reading';
        setEditData(next);
      } else if (kind === 'video') {
        const title = result.title || 'Suggested video';
        const source = result.source || '';
        const rationale = result.rationale || '';
        const searchUrl = result.search_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(result.youtube_search || title)}`;
        const block = `<div style="border:1px solid #fecaca;background:#fff1f2;padding:14px 16px;border-radius:12px;margin:8px 0;"><strong>🎬 Recommended Video:</strong> ${title}${source ? ` <span style="color:#6b7280">(${source})</span>` : ''}<p style="margin:6px 0 8px;">${rationale}</p><a href="${searchUrl}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;">Find on YouTube →</a><p style="font-size:12px;color:#6b7280;margin-top:6px;">Preview the video, then paste its embed URL via the Video button to inline it.</p></div>`;
        const arr = [...((editData.reading_paragraphs as string[]) || []), block];
        const next: any = { ...editData, reading_paragraphs: arr };
        if (!editData.reading_title) next.reading_title = 'Reading';
        setEditData(next);
      }
      toast.success(`Added AI ${kind.replace('_', ' ')}`, { id: tId });
    } catch (err: any) {
      toast.error(err?.message || 'AI generation failed', { id: tId });
    } finally {
      setAiGenerating(false);
    }
  };

  const insertVideoEmbed = () => {
    if (!videoUrl.trim() || !editData) return;
    // Convert YouTube URLs to embed format
    let embedUrl = videoUrl.trim();
    const ytMatch = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    const embedHtml = `<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" allowfullscreen style="border-radius:12px;"></iframe>`;
    addItem('reading_paragraphs', embedHtml);
    if (!editData.reading_title) {
      setEditData(prev => prev ? { ...prev, reading_title: 'Reading' } : prev);
    }
    setVideoUrl('');
    setVideoDialogOpen(false);
    toast.success('Video embed added to reading section');
  };
  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80">
        <div className="flex items-center gap-3 min-w-0">
          <BookOpen className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
            {lesson && (
              <p className="text-xs text-muted-foreground">
                Lesson {(currentLesson ?? 0) + 1} of {lessons.length}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lessons.length > 1 && currentLesson !== null && (
            <span /> /* TOC button moved to bottom nav */
          )}
          {/* Edit / Save toggle */}
          {lesson && !editing && (
            <>
              <TemplateBadge report={validateReadingTemplate({ chapter: lesson.chapter, legacy: lesson as any })} onFix={handleConvertCurrent} fixing={converting} />
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setStandardsPickerOpen(true)}>
                <Target className="h-3.5 w-3.5" /> Edit Standards
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleAiTagReading} disabled={aiTagging}>
                {aiTagging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiTagging ? 'Tagging…' : 'AI Tag'}
              </Button>
              {!isChapter(lesson.chapter) && (
                <Button variant="outline" size="sm" className="gap-2 border-primary/40 text-primary" onClick={handleConvertCurrent} disabled={converting} title="Restructure this reading into the textbook chapter format">
                  {converting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {converting ? 'Converting…' : 'Convert to chapter'}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => lesson && currentLesson !== null && exportReadingAsPdf(lesson, currentLesson)}>
                <FileDown className="h-3.5 w-3.5" /> Export PDF
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={exportingDocx}>
                    {exportingDocx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                    Export Word
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 z-[200]" align="end">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Include in Word doc</p>
                      <p className="text-xs text-muted-foreground">The 5-act reading is always included.</p>
                    </div>
                    <div className="space-y-2">
                      {([
                        ['includeObjectives', 'Learning objectives'],
                        ['includeKeyTerms', 'Key terms'],
                        ['includeIntro', 'Introduction'],
                        ['includeExplanation', 'Explanation'],
                        ['includeClosingUdl', 'Closing & UDL prompts'],
                        ['includeSourcesPage', 'Sources & citations page'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={docxOptions[key]}
                            onCheckedChange={(v) =>
                              setDocxOptions(prev => ({ ...prev, [key]: v === true }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      disabled={exportingDocx}
                      onClick={async () => {
                        if (!lesson) return;
                        setExportingDocx(true);
                        try {
                          await exportReadingAsDocx(lesson, lessonStandards, docxOptions);
                          toast.success('Word document exported');
                        } catch (err: any) {
                          toast.error(err?.message || 'Failed to export Word doc');
                        } finally {
                          setExportingDocx(false);
                        }
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Export Word
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={exportingGdoc || !lesson}
                title={googleStatus?.connected ? 'Export to Google Doc in your Drive' : 'Connect Google in Settings → Google'}
                onClick={async () => {
                  if (!lesson) return;
                  if (!googleStatus?.connected) {
                    toast.error('Connect your Google account first (Settings → Google).');
                    return;
                  }
                  setExportingGdoc(true);
                  try {
                    const res = await exportReadingToGoogleDoc(lesson);
                    toast.success('Exported to Google Doc', {
                      action: { label: 'Open', onClick: () => window.open(res.url, '_blank') },
                    });
                  } catch (err: any) {
                    toast.error(err?.message || 'Google Doc export failed');
                  } finally {
                    setExportingGdoc(false);
                  }
                }}
              >
                {exportingGdoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                Export to Google Doc
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!lesson}
                title={googleStatus?.connected ? 'Import a Google Doc into this reading' : 'Connect Google in Settings → Google'}
                onClick={() => setGoogleImportOpen(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                Import from Google Doc
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportTextbookAsPdf(lessons, unitMap, title)}>
                <FileDown className="h-3.5 w-3.5" /> Export Textbook
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" disabled={deletingId === lesson?.id}>
                    {deletingId === lesson?.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="z-[200]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Reading</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{lesson?.title}"? This will permanently remove the reading, its key terms, and associated standards. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => lesson && handleDeleteReading(lesson.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {editing && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undoEdit} disabled={!canUndo || saving} title="Undo">
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redoEdit} disabled={!canRedo || saving} title="Redo">
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>Cancel</Button>
              <Button size="sm" className="gap-2" onClick={saveEdits} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
            </>
          )}
          {config && lessons.length > 0 && !editing && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setPushOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Push to Canvas
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Slide-out TOC sidebar */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-[110] w-72 bg-card border-r border-border shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          showToc ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <List className="h-4 w-4 text-primary" /> Table of Contents
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowToc(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 pb-4 space-y-1">
            {(() => {
              const unitOrder = Object.keys(unitMap);
              const grouped: { unitId: string; unitTitle: string; items: { index: number; lesson: CurriculumLesson }[] }[] = [];
              const groupMap = new Map<string, typeof grouped[0]>();

              filteredIndices.forEach(idx => {
                const l = lessons[idx];
                if (!groupMap.has(l.unit_id)) {
                  const group = { unitId: l.unit_id, unitTitle: unitMap[l.unit_id] || 'Unknown Unit', items: [] as { index: number; lesson: CurriculumLesson }[] };
                  groupMap.set(l.unit_id, group);
                  grouped.push(group);
                }
                groupMap.get(l.unit_id)!.items.push({ index: idx, lesson: l });
              });

              grouped.sort((a, b) => unitOrder.indexOf(a.unitId) - unitOrder.indexOf(b.unitId));

              if (filteredIndices.length === 0) {
                return <p className="text-xs text-muted-foreground py-4 text-center">No lessons match "{searchQuery}"</p>;
              }

              return grouped.map((group, gi) => (
                <div key={group.unitId} className="space-y-0.5">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wider px-2 pt-3 pb-1">
                    {group.unitTitle}
                  </p>
                  {group.items.map(({ index, lesson: l }) => (
                    <button
                      key={l.id}
                      onClick={() => { setCurrentLesson(index); setShowToc(false); if (editing) cancelEditing(); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        index === currentLesson
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-xs text-muted-foreground mr-1.5">{index + 1}.</span>
                      {l.title}
                    </button>
                  ))}
                </div>
              ));
            })()}
          </div>
        </ScrollArea>
        <div className="border-t border-border px-4 py-2">
          <p className="text-[10px] text-muted-foreground text-center">{lessons.length} lessons · {Object.keys(unitMap).length} units</p>
        </div>
      </div>
      {/* TOC overlay backdrop */}
      {showToc && (
        <div className="fixed inset-0 z-[105] bg-black/20" onClick={() => setShowToc(false)} />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : lessons.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-semibold text-foreground">No curriculum readings yet</p>
            <p className="text-sm text-muted-foreground mt-1">Generate readings in the Curriculum Editor first</p>
          </div>
        </div>
      ) : currentLesson === null ? (
        /* ─── TABLE OF CONTENTS LANDING ─── */
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
              <div className="text-center space-y-2 pb-6 border-b border-border">
                <BookOpen className="h-10 w-10 mx-auto text-primary/60" />
                <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                <p className="text-sm text-muted-foreground">Table of Contents</p>
              </div>

              {(() => {
                // Group lessons by unit
                const unitOrder = Object.keys(unitMap);
                const grouped: { unitId: string; unitTitle: string; lessons: { index: number; lesson: CurriculumLesson }[] }[] = [];
                const groupMap = new Map<string, { unitId: string; unitTitle: string; lessons: { index: number; lesson: CurriculumLesson }[] }>();

                lessons.forEach((l, i) => {
                  if (!groupMap.has(l.unit_id)) {
                    const group = { unitId: l.unit_id, unitTitle: unitMap[l.unit_id] || 'Unknown Unit', lessons: [] as { index: number; lesson: CurriculumLesson }[] };
                    groupMap.set(l.unit_id, group);
                    grouped.push(group);
                  }
                  groupMap.get(l.unit_id)!.lessons.push({ index: i, lesson: l });
                });

                // Sort groups by the unit order from the database
                grouped.sort((a, b) => unitOrder.indexOf(a.unitId) - unitOrder.indexOf(b.unitId));

                return grouped.map((group, gi) => (
                  <div key={group.unitId} className="space-y-2">
                    <h2 className="text-sm font-semibold text-primary uppercase tracking-wide flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                        {gi + 1}
                      </span>
                      {group.unitTitle}
                      {group.lessons.some(({ lesson: l }) => !isChapter(l.chapter)) && (
                        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs gap-1 normal-case tracking-normal text-primary" disabled={!!bulkConverting} onClick={() => handleConvertUnit(group.unitId)}>
                          {bulkConverting === group.unitId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Convert all to chapters
                        </Button>
                      )}
                    </h2>
                    <div className="ml-8 space-y-0.5">
                      {group.lessons.map(({ index, lesson: l }) => (
                        <div key={l.id} className="flex items-center gap-1 group/item">
                          <button
                            onClick={() => setCurrentLesson(index)}
                            className="flex-1 text-left px-3 py-2 rounded-lg text-sm hover:bg-primary/5 transition-colors group flex items-center gap-3 min-w-0"
                          >
                            <span className="text-xs text-muted-foreground/60 w-6 shrink-0 text-right">{index + 1}.</span>
                            <div className="min-w-0 flex-1">
                              <span className="text-foreground group-hover:text-primary transition-colors">{l.title}</span>
                              <TemplateBadge compact className="ml-2 align-middle" report={validateReadingTemplate({ chapter: l.chapter, legacy: l as any })} />
                              {l.reading_title && (
                                <span className="block text-[11px] text-muted-foreground mt-0.5">📖 {l.reading_title}</span>
                              )}
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}

              <div className="text-center pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">{lessons.length} lessons across {Object.keys(unitMap).length} units</p>
              </div>
            </div>
          </ScrollArea>
        </div>
      ) : lesson ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div
              className="max-w-2xl mx-auto px-6 py-8 space-y-6 prose-links"
              onClick={(e) => {
                if (editing) return;
                const target = e.target as HTMLElement;
                if (target.tagName === 'A') {
                  e.preventDefault();
                  const href = (target as HTMLAnchorElement).href;
                  if (href) window.open(href, '_blank', 'noopener');
                }
              }}
            >
              {editing && editData && isChapter(editData.chapter) ? (
                /* ─── EDIT MODE (textbook chapter) ─── */
                <ChapterEditor
                  chapter={editData.chapter}
                  onChange={(c: TextbookChapter) => setEditData({ ...editData, chapter: c, title: c.title })}
                  standards={lessonStandards.map(s => ({ code: s.ngss_code, description: s.ngss_description }))}
                />
              ) : editing && editData ? (
                /* ─── EDIT MODE ─── */
                <div className={`${editFont} ${editFontSize} ${editLineSpacing}`}>
                  <ReadingEditToolbar
                    onAction={handleEditorAction}
                    activeFont={editFont}
                    activeFontSize={editFontSize}
                    activeLineSpacing={editLineSpacing}
                  />

                  {/* Video embed dialog */}
                  <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Insert Video</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Label>Video URL (YouTube, Vimeo, or direct embed)</Label>
                        <Input
                          value={videoUrl}
                          onChange={e => setVideoUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setVideoDialogOpen(false)}>Cancel</Button>
                        <Button onClick={insertVideoEmbed} disabled={!videoUrl.trim()}>Insert</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <ReadingResourceInsertDialog
                    open={resourceDialogOpen}
                    onOpenChange={setResourceDialogOpen}
                    lesson={editData as any}
                    lessonId={lesson?.id}
                    standards={lessonStandards.map(s => ({ code: s.ngss_code, description: s.ngss_description }))}
                    onInsert={({ html }) => {
                      pushAiSnapshot();
                      const arr = [...((editData.reading_paragraphs as string[]) || []), html];
                      const next: any = { ...editData, reading_paragraphs: arr };
                      if (!editData.reading_title) next.reading_title = 'Reading';
                      setEditData(next);
                    }}
                  />

                  {/* Title */}
                  <div className="text-center space-y-2 pb-4 border-b border-border">
                    <Input
                      value={editData.title || ''}
                      onChange={e => setEditData({ ...editData, title: e.target.value })}
                      className="text-2xl font-bold text-center border-dashed"
                    />
                  </div>

                  {/* Objectives */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Objectives</Label>
                    {((editData.objectives as string[]) || []).map((obj, i) => (
                      <div key={i} className="flex items-start gap-1 group">
                        <div className="flex-1">
                          <RichTextEditor
                            content={obj}
                            onChange={v => updateEditArray('objectives', i, v)}
                            placeholder="Objective..."
                            minimal
                          />
                        </div>
                        <ItemToolbar
                          section="objectives"
                          index={i}
                          total={(editData.objectives as string[]).length}
                          onAction={handleEditorAction}
                        />
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => handleEditorAction({ type: 'add', section: 'objectives' })}>
                      + Add Objective
                    </Button>
                  </div>

                  {/* Key Terms */}
                  <div className="space-y-3">
                    <Label className="text-[11px] font-semibold text-primary uppercase tracking-wider">Key Terms</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {((editData.key_terms as { term: string; definition: string }[]) || []).map((kt, i) => (
                        <div key={i} className="rounded-2xl border border-primary/15 bg-primary/5 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <Input
                              value={kt.term}
                              onChange={e => updateEditKeyTerm(i, 'term', e.target.value)}
                              className="font-bold border-dashed h-8 text-sm"
                              placeholder="Term"
                            />
                            <ItemToolbar
                              section="key_terms"
                              index={i}
                              total={(editData.key_terms as any[]).length}
                              onAction={handleEditorAction}
                            />
                          </div>
                          <RichTextEditor
                            content={kt.definition}
                            onChange={v => updateEditKeyTerm(i, 'definition', v)}
                            placeholder="Definition"
                            minimal
                          />
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => handleEditorAction({ type: 'add', section: 'key_terms' })}>
                      + Add Key Term
                    </Button>
                  </div>

                  {/* Introduction */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Introduction</Label>
                    {((editData.intro as string[]) || []).map((p, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <RichTextEditor
                          content={p}
                          onChange={v => updateEditArray('intro', i, v)}
                          placeholder="Introduction paragraph..."
                          compact
                        />
                        <ItemToolbar
                          section="intro"
                          index={i}
                          total={(editData.intro as string[]).length}
                          onAction={handleEditorAction}
                        />
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => handleEditorAction({ type: 'add', section: 'intro' })}>
                      + Add Paragraph
                    </Button>
                  </div>

                  {/* Explanation */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Explanation</Label>
                    {((editData.explanation as string[]) || []).map((p, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <RichTextEditor
                          content={p}
                          onChange={v => updateEditArray('explanation', i, v)}
                          placeholder="Explanation paragraph..."
                          compact
                        />
                        <ItemToolbar
                          section="explanation"
                          index={i}
                          total={(editData.explanation as string[]).length}
                          onAction={handleEditorAction}
                        />
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => handleEditorAction({ type: 'add', section: 'explanation' })}>
                      + Add Paragraph
                    </Button>
                  </div>

                  {/* Reading Passage */}
                  <div className="space-y-2 border-t border-border pt-6">
                    <div className="flex items-center gap-2">
                      <span>📖</span>
                      <Input
                        value={editData.reading_title || ''}
                        onChange={e => setEditData({ ...editData, reading_title: e.target.value })}
                        className="text-lg font-semibold border-dashed flex-1"
                        placeholder="Reading title"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1 text-xs"
                        title="Reset to lesson title"
                        onClick={() => setEditData({ ...editData, reading_title: editData.title })}
                      >
                        <RotateCcw className="h-3 w-3" /> Reset
                      </Button>
                    </div>
                    {((editData.reading_paragraphs as string[]) || []).map((p, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <RichTextEditor
                          content={p}
                          onChange={v => updateEditArray('reading_paragraphs', i, v)}
                          placeholder="Reading paragraph..."
                        />
                        <ItemToolbar
                          section="reading"
                          index={i}
                          total={(editData.reading_paragraphs as string[]).length}
                          onAction={handleEditorAction}
                        />
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => handleEditorAction({ type: 'add', section: 'reading' })}>
                      + Add Paragraph
                    </Button>
                  </div>

                </div>
              ) : isChapter(lesson.chapter) ? (
                /* ─── READ MODE (textbook chapter) ─── */
                <ChapterViewer
                  chapter={normalizeChapter(lesson.chapter, lesson.title)}
                  teacherMode={!!user}
                  showToc={false}
                  standards={lessonStandards.map(s => ({ code: s.ngss_code, description: s.ngss_description }))}
                />
              ) : (
                /* ─── READ MODE ─── */
                <>
                  {/* Lesson Title */}
                   <div className="text-center space-y-3 pb-4 border-b border-border">
                    <h1 className="text-2xl font-bold text-foreground">{lesson.title}</h1>
                    {(() => {
                      const raw = (lesson.objectives as string[]) || [];
                      const seen = new Set<string>();
                      const unique = raw.filter(o => {
                        const key = o.toLowerCase().trim();
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                      });
                      return unique.length > 0 ? (
                        <div className="text-sm text-muted-foreground leading-relaxed">
                          {unique.map((obj, i) => (
                            <p key={i} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(`• ${obj}`) }} />
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {/* NGSS Standards — inside the same box */}
                    {lessonStandards.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-border/50">
                        <Target className="h-4 w-4 text-primary shrink-0" />
                        {lessonStandards.map(s => (
                          <Badge key={s.id} variant="secondary" className="text-xs gap-1 pr-1" title={s.ngss_description}>
                            {s.ngss_code}
                            <button
                              onClick={() => handleRemoveStandard(s.id)}
                              className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                              title="Remove standard"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Key Terms */}
                  {(lesson.key_terms as any[])?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Key Terms</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(lesson.key_terms as { term: string; definition: string }[]).map((kt, i) => (
                          <div key={i} className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                            <p className="text-sm font-bold text-foreground mb-1">{kt.term}</p>
                            <p className="text-sm leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(kt.definition) }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Introduction */}
                  {(lesson.intro as string[])?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">Introduction</h3>
                      {(lesson.intro as string[]).map((p, i) => (
                        <div key={i} className="text-sm leading-relaxed text-foreground/90" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(p) }} />
                      ))}
                    </div>
                  )}

                  {/* Explanation */}
                  {(lesson.explanation as string[])?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">Explanation</h3>
                      {(lesson.explanation as string[]).map((p, i) => (
                        <div key={i} className="text-sm leading-relaxed text-foreground/90" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(p) }} />
                      ))}
                    </div>
                  )}

                  {/* Reading Passage */}
                  {lesson.reading_title && (
                    <div className="space-y-3 border-t border-border pt-6">
                      <h3 className="text-lg font-semibold text-foreground">📖 {lesson.reading_title}</h3>
                      {(lesson.reading_paragraphs as string[])?.map((p, i) => (
                        <div key={i} className="text-sm leading-relaxed text-foreground/90 [&>p]:indent-8" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(p) }} />
                      ))}
                    </div>
                  )}

                </>
              )}
            </div>
          </ScrollArea>

          {/* Navigation */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card/80">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowToc(true)}
                title="Table of Contents"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={editing}
                onClick={() => {
                  if (currentLesson === 0 || currentLesson === null) {
                    setCurrentLesson(null);
                  } else {
                    setCurrentLesson(c => (c ?? 1) - 1);
                  }
                  if (editing) cancelEditing();
                }}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" /> {currentLesson === 0 ? 'Contents' : 'Previous'}
            </Button>
            </div>
            <button
              onClick={() => { setCurrentLesson(null); if (editing) cancelEditing(); }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {currentLesson !== null ? `${currentLesson + 1} / ${lessons.length}` : 'Table of Contents'}
            </button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentLesson !== null && currentLesson >= lessons.length - 1 || editing}
              onClick={() => {
                if (currentLesson === null) {
                  setCurrentLesson(0);
                } else {
                  setCurrentLesson(c => (c ?? -1) + 1);
                }
                if (editing) cancelEditing();
              }}
              className="gap-2"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Push to Canvas Dialog */}
      {config && (
        <PushReadingsToCanvasDialog
          open={pushOpen}
          onOpenChange={setPushOpen}
          config={config}
          lessons={lessons}
          bookTitle={title}
        />
      )}

      <LessonStandardsPicker
        open={standardsPickerOpen}
        onOpenChange={setStandardsPickerOpen}
        selected={lessonStandards.map(s => ({ code: s.ngss_code, description: s.ngss_description }))}
        onSave={handleManualStandardsSave}
      />

      <GoogleImportDialog
        open={googleImportOpen}
        onOpenChange={setGoogleImportOpen}
        title="Import a Google Doc into this reading"
        description="Paste a Google Doc link. Its content will be appended as a new paragraph in this reading."
        onImported={async ({ title: importedTitle, html }) => {
          if (!lesson || currentLesson === null || !user) return;
          const existing = (lesson.reading_paragraphs || []) as string[];
          const block = `<h3>Imported from "${importedTitle}"</h3>\n${html}`;
          const nextParas = [...existing, block];
          const { error } = await supabase
            .from('curriculum_lessons')
            .update({ reading_paragraphs: nextParas as any, updated_at: new Date().toISOString() })
            .eq('id', lesson.id)
            .eq('user_id', user.id);
          if (error) { toast.error(error.message); return; }
          const updated = [...lessons];
          updated[currentLesson] = { ...lesson, reading_paragraphs: nextParas } as CurriculumLesson;
          setLessons(updated);
        }}
      />
    </div>
  );
}

/* ─── Push to Canvas Dialog ─── */
function PushReadingsToCanvasDialog({
  open,
  onOpenChange,
  config,
  lessons,
  bookTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: CanvasConfig;
  lessons: CurriculumLesson[];
  bookTitle: string;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [pageTitle, setPageTitle] = useState(bookTitle);
  const [pushing, setPushing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open && courses.length === 0) {
      setLoadingCourses(true);
      getCourses(config)
        .then(setCourses)
        .catch(() => toast.error('Failed to load Canvas courses'))
        .finally(() => setLoadingCourses(false));
    }
    if (open) {
      setDone(false);
      setProgress(0);
      setPageTitle(bookTitle);
    }
  }, [open, config, bookTitle]);

  const buildHtml = (lesson: CurriculumLesson) => {
    const parts: string[] = [];
    parts.push(`<h2>${lesson.title}</h2>`);

    const objectives = lesson.objectives as string[];
    if (objectives?.length) {
      parts.push('<h3>Learning Objectives</h3><ul>');
      objectives.forEach(o => parts.push(`<li>${o}</li>`));
      parts.push('</ul>');
    }

    const keyTerms = lesson.key_terms as { term: string; definition: string }[];
    if (keyTerms?.length) {
      parts.push('<h3>Key Terms</h3><ul>');
      keyTerms.forEach(kt => parts.push(`<li><strong>${kt.term}</strong> — ${kt.definition}</li>`));
      parts.push('</ul>');
    }

    const intro = lesson.intro as string[];
    if (intro?.length) {
      parts.push('<h3>Introduction</h3>');
      intro.forEach(p => parts.push(`<p>${p}</p>`));
    }

    const explanation = lesson.explanation as string[];
    if (explanation?.length) {
      parts.push('<h3>Explanation</h3>');
      explanation.forEach(p => parts.push(`<p>${p}</p>`));
    }

    if (lesson.reading_title) {
      parts.push(`<h3>Reading: ${lesson.reading_title}</h3>`);
      (lesson.reading_paragraphs as string[])?.forEach(p => parts.push(`<p>${p}</p>`));

    }

    return parts.join('\n');
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalWork = lessons.length * selectedCourseIds.size;

  const handlePush = async () => {
    if (selectedCourseIds.size === 0) {
      toast.error('Please select at least one course');
      return;
    }
    setPushing(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Please sign in');

      let completed = 0;
      const courseIds = Array.from(selectedCourseIds);

      for (const courseId of courseIds) {
        for (let i = 0; i < lessons.length; i++) {
          const lesson = lessons[i];
          const html = buildHtml(lesson);
          const lessonTitle = `${pageTitle} - Lesson ${i + 1}: ${lesson.title}`;

          const { data, error } = await supabase.functions.invoke('canvas-proxy', {
            body: {
              action: 'create_page',
              canvasUrl: config?.canvasUrl,
              apiToken: config?.apiToken,
              courseId: Number(courseId),
              pageData: {
                title: lessonTitle,
                body: html,
                published: false,
              },
            },
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (error) throw new Error(error.message || 'Failed to create page');
          if (data?.error) throw new Error(data.error);
          completed++;
          setProgress(completed);
        }
      }

      setDone(true);
      toast.success(`${lessons.length} reading pages pushed to ${courseIds.length} course${courseIds.length > 1 ? 's' : ''}!`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to push to Canvas');
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Push Readings to Canvas</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="h-12 w-12 text-primary" />
            <p className="text-sm font-medium text-foreground">
              {lessons.length} pages created in {selectedCourseIds.size} course{selectedCourseIds.size > 1 ? 's' : ''}!
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Pages are saved as drafts. Publish them in Canvas when ready.
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-2">Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Canvas Courses ({selectedCourseIds.size} selected)</Label>
                {loadingCourses ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading courses...
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border">
                    {courses.map(c => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selectedCourseIds.has(String(c.id))}
                          onCheckedChange={() => toggleCourse(String(c.id))}
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Page Title Prefix</Label>
                <Input value={pageTitle} onChange={e => setPageTitle(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Each lesson becomes a Canvas Page: "{pageTitle} - Lesson 1: ..."
                </p>
              </div>
            </div>

            {pushing && (
              <div className="space-y-1.5">
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${totalWork > 0 ? (progress / totalWork) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Creating page {progress} of {totalWork}...
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pushing}>Cancel</Button>
              <Button onClick={handlePush} disabled={pushing || selectedCourseIds.size === 0} className="gap-2">
                {pushing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Pushing...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Push to Canvas</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
