import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getCourses, getQuizzes, getQuiz, getQuizQuestions, getAllCourses, buildTaggerText, type CanvasConfig, type Course, type Quiz, type QuizQuestion } from '@/modules/curriculum/config/canvas-api';
import { tagQuestionsWithStandards, type StandardMatch } from '@/modules/curriculum/lib/standards-api';
import { useProfileDefaults } from '@/modules/curriculum/hooks/useProfileDefaults';
import { exportQuizToDocx } from '@/modules/curriculum/lib/export-docx';
import { saveQuestionsToBank } from '@/modules/curriculum/lib/question-bank';
import { toast } from 'sonner';
import { BookOpen, FileText, Download, Loader2, ArrowLeft, ChevronRight, FlaskConical, Sparkles, Palette, GripVertical, Pin, PinOff, Search, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface QuizBrowserProps {
  config: CanvasConfig;
}

const COURSE_COLORS = [
  'bg-primary',
  'bg-[hsl(210,70%,50%)]',
  'bg-[hsl(340,65%,47%)]',
  'bg-[hsl(262,60%,50%)]',
  'bg-[hsl(25,85%,55%)]',
  'bg-[hsl(190,70%,42%)]',
];

const ALL_COLORS = [
  { label: 'Blue', class: 'bg-primary', swatch: 'hsl(211,100%,50%)' },
  { label: 'Sky', class: 'bg-[hsl(210,70%,50%)]', swatch: 'hsl(210,70%,50%)' },
  { label: 'Rose', class: 'bg-[hsl(340,65%,47%)]', swatch: 'hsl(340,65%,47%)' },
  { label: 'Purple', class: 'bg-[hsl(262,60%,50%)]', swatch: 'hsl(262,60%,50%)' },
  { label: 'Orange', class: 'bg-[hsl(25,85%,55%)]', swatch: 'hsl(25,85%,55%)' },
  { label: 'Teal', class: 'bg-[hsl(190,70%,42%)]', swatch: 'hsl(190,70%,42%)' },
  { label: 'Green', class: 'bg-[hsl(142,60%,40%)]', swatch: 'hsl(142,60%,40%)' },
  { label: 'Amber', class: 'bg-[hsl(45,90%,48%)]', swatch: 'hsl(45,90%,48%)' },
  { label: 'Indigo', class: 'bg-[hsl(230,65%,52%)]', swatch: 'hsl(230,65%,52%)' },
  { label: 'Slate', class: 'bg-[hsl(215,20%,40%)]', swatch: 'hsl(215,20%,40%)' },
  { label: 'Fuchsia', class: 'bg-[hsl(292,60%,50%)]', swatch: 'hsl(292,60%,50%)' },
  { label: 'Red', class: 'bg-[hsl(0,70%,50%)]', swatch: 'hsl(0,70%,50%)' },
];

function loadCourseColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem('course-tile-colors') || '{}'); } catch { return {}; }
}
function saveCourseColors(map: Record<string, string>) {
  localStorage.setItem('course-tile-colors', JSON.stringify(map));
}
function loadPinnedCourses(): number[] {
  try { return JSON.parse(localStorage.getItem('course-pinned') || '[]'); } catch { return []; }
}
function savePinnedCourses(ids: number[]) {
  localStorage.setItem('course-pinned', JSON.stringify(ids));
}
function loadCourseOrder(): number[] {
  try { return JSON.parse(localStorage.getItem('course-tile-order') || '[]'); } catch { return []; }
}
function saveCourseOrder(order: number[]) {
  localStorage.setItem('course-tile-order', JSON.stringify(order));
}
function loadAddedCourses(): Course[] {
  try { return JSON.parse(localStorage.getItem('course-added-manual') || '[]'); } catch { return []; }
}
function saveAddedCourses(courses: Course[]) {
  localStorage.setItem('course-added-manual', JSON.stringify(courses));
}
function applyStoredOrder(courses: Course[]): Course[] {
  const order = loadCourseOrder();
  if (order.length === 0) return courses;
  const map = new Map(courses.map(c => [c.id, c]));
  const ordered: Course[] = [];
  for (const id of order) { const c = map.get(id); if (c) { ordered.push(c); map.delete(id); } }
  for (const c of map.values()) ordered.push(c);
  return ordered;
}

function isActiveCourse(course: Course): boolean {
  if (course.workflow_state === 'completed' || course.workflow_state === 'deleted') return false;
  if (course.term?.end_at) {
    return new Date(course.term.end_at) >= new Date();
  }
  return course.workflow_state === 'available' || !course.workflow_state;
}

export function QuizBrowser({ config }: QuizBrowserProps) {
  const { defaultGradeLevel } = useProfileDefaults();
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [includeNGSS, setIncludeNGSS] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [courseColors, setCourseColors] = useState<Record<string, string>>(loadCourseColors);
  const [pinnedIds, setPinnedIds] = useState<number[]>(loadPinnedCourses);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragSection, setDragSection] = useState<'active' | 'other' | null>(null);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [allCanvasCourses, setAllCanvasCourses] = useState<Course[]>([]);
  const [loadingAllCourses, setLoadingAllCourses] = useState(false);
  const [addCourseFilter, setAddCourseFilter] = useState('');

  const getColorForCourse = useCallback((courseId: number, idx: number) => {
    return courseColors[String(courseId)] || COURSE_COLORS[idx % COURSE_COLORS.length];
  }, [courseColors]);

  const setCourseColor = useCallback((courseId: number, colorClass: string) => {
    setCourseColors(prev => {
      const next = { ...prev, [String(courseId)]: colorClass };
      saveCourseColors(next);
      return next;
    });
  }, []);

  const togglePin = useCallback((courseId: number) => {
    setPinnedIds(prev => {
      const next = prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId];
      savePinnedCourses(next);
      return next;
    });
  }, []);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [ngssTags, setNgssTags] = useState<Map<number, StandardMatch[]>>(new Map());
  const [loadingNGSS, setLoadingNGSS] = useState(false);
  const [ngssLoaded, setNgssLoaded] = useState(false);

  useEffect(() => {
    setLoadingCourses(true);
    getCourses(config)
      .then(c => {
        const added = loadAddedCourses();
        const existingIds = new Set(c.map(x => x.id));
        const merged = [...c, ...added.filter(a => !existingIds.has(a.id))];
        setCourses(applyStoredOrder(merged));
      })
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoadingCourses(false));
  }, [config]);

  const { activeCourses, otherCourses } = useMemo(() => {
    const pinned = courses.filter(c => pinnedIds.includes(c.id));
    const unpinned = courses.filter(c => !pinnedIds.includes(c.id));
    const active = unpinned.filter(c => isActiveCourse(c));
    const other = unpinned.filter(c => !isActiveCourse(c));
    return { activeCourses: [...pinned, ...active], otherCourses: other };
  }, [courses, pinnedIds]);

  const handleDragStart = (idx: number, section: 'active' | 'other') => {
    setDragIdx(idx);
    setDragSection(section);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number, section: 'active' | 'other') => {
    if (dragIdx === null || dragSection !== section || dragIdx === idx) {
      setDragIdx(null); setDragOverIdx(null); setDragSection(null);
      return;
    }
    const list = section === 'active' ? [...activeCourses] : [...otherCourses];
    const [moved] = list.splice(dragIdx, 1);
    list.splice(idx, 0, moved);
    const activeList = section === 'active' ? list : activeCourses;
    const otherList = section === 'other' ? list : otherCourses;
    const fullOrder = [...activeList, ...otherList];
    setCourses(fullOrder);
    saveCourseOrder(fullOrder.map(c => c.id));
    setDragIdx(null); setDragOverIdx(null); setDragSection(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null); setDragOverIdx(null); setDragSection(null);
  };

  const handleOpenAddCourse = async () => {
    setShowAddCourse(true);
    if (allCanvasCourses.length === 0) {
      setLoadingAllCourses(true);
      try {
        const all = await getAllCourses(config);
        setAllCanvasCourses(all);
      } catch {
        toast.error('Failed to load all courses from Canvas');
      } finally {
        setLoadingAllCourses(false);
      }
    }
  };

  const addCourseFromList = (course: Course) => {
    setCourses(prev => {
      const next = [...prev, course];
      saveCourseOrder(next.map(c => c.id));
      return next;
    });
    // Persist manually added courses
    const added = loadAddedCourses();
    added.push(course);
    saveAddedCourses(added);
    toast.success(`Added "${course.name}" to your courses`);
  };

  const availableToAdd = useMemo(() => {
    const existingIds = new Set(courses.map(c => c.id));
    const filtered = allCanvasCourses.filter(c => !existingIds.has(c.id));
    if (!addCourseFilter.trim()) return filtered;
    const q = addCourseFilter.toLowerCase();
    return filtered.filter(c => c.name.toLowerCase().includes(q) || (c.course_code || '').toLowerCase().includes(q));
  }, [allCanvasCourses, courses, addCourseFilter]);

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    setSelectedQuizId('');
    setQuestions([]);
    setNgssTags(new Map());
    setNgssLoaded(false);
    setLoadingQuizzes(true);
    getQuizzes(config, course.id)
      .then(setQuizzes)
      .catch(() => toast.error('Failed to load quizzes'))
      .finally(() => setLoadingQuizzes(false));
  };

  const handleBack = () => {
    setSelectedCourse(null);
    setQuizzes([]);
    setSelectedQuizId('');
    setQuestions([]);
    setNgssTags(new Map());
    setNgssLoaded(false);
  };

  const handleSelectQuiz = async (quizId: string) => {
    setSelectedQuizId(quizId);
    setNgssTags(new Map());
    setNgssLoaded(false);
    if (!selectedCourse) return;
    setLoadingNGSS(true);
    try {
      const qs = await getQuizQuestions(config, selectedCourse.id, Number(quizId));
      setQuestions(qs);
      const filtered = qs.filter(q => q.question_type !== 'text_only_question');
      if (filtered.length > 0) {
        // Pull a numeric grade like "7" out of "7th Grade" for the tagger context.
        const gradeMatch = defaultGradeLevel.match(/(\d+)/);
        const grade = gradeMatch ? gradeMatch[1] : undefined;
        const tags = await tagQuestionsWithStandards(
          filtered.map(q => ({ id: q.id, question_text: buildTaggerText(q) })),
          'ngss',
          'Science',
          grade,
        );
        setNgssTags(tags);
      }
      setNgssLoaded(true);
    } catch (err) {
      console.error('NGSS tagging error:', err);
      toast.error('Failed to analyze NGSS standards. You can still export without them.');
      setNgssLoaded(true);
    } finally {
      setLoadingNGSS(false);
    }
  };

  const handleExport = async () => {
    if (!selectedCourse || !selectedQuizId) { toast.error('Please select a quiz'); return; }
    setExporting(true);
    try {
      const quiz = await getQuiz(config, selectedCourse.id, Number(selectedQuizId));
      const qs = questions.length > 0 ? questions : await getQuizQuestions(config, selectedCourse.id, Number(selectedQuizId));
      await exportQuizToDocx(quiz, qs, selectedCourse.name, includeAnswerKey, includeNGSS ? ngssTags : undefined);
      try { await saveQuestionsToBank(qs, ngssTags, selectedCourse.name, quiz.title); } catch (err) { console.warn('Question bank save skipped:', err); }
      toast.success(includeAnswerKey ? 'Quiz and answer key downloaded!' : 'Quiz downloaded!');
    } catch (err) {
      toast.error('Failed to export quiz. Please try again.');
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  if (loadingCourses) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Quiz detail view
  if (selectedCourse) {
    const colorIdx = courses.indexOf(selectedCourse);
    const colorClass = getColorForCourse(selectedCourse.id, colorIdx);
    const filteredQuestions = questions.filter(q => q.question_type !== 'text_only_question');

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={handleBack} className="flex items-center gap-1 text-primary font-medium text-sm hover:opacity-70 transition-opacity -mb-2">
          <ArrowLeft className="h-4 w-4" />
          All Courses
        </button>

        <div className={`${colorClass} rounded-2xl p-6 text-primary-foreground relative overflow-hidden`}>
          <h2 className="text-2xl font-bold">{selectedCourse.name}</h2>
          {selectedCourse.course_code && <p className="text-sm opacity-80 mt-1">{selectedCourse.course_code}</p>}
          {selectedCourse.term?.name && (
            <Badge variant="secondary" className="mt-2 bg-primary-foreground/20 text-primary-foreground border-0 text-xs">{selectedCourse.term.name}</Badge>
          )}
        </div>

        {selectedQuizId && (
          <>
            {loadingNGSS ? (
              <Card className="border-accent/30">
                <CardContent className="flex items-center gap-3 p-4 text-muted-foreground">
                  <Sparkles className="h-5 w-5 animate-pulse text-accent-foreground" />
                  <span className="text-sm">Analyzing questions for NGSS standards...</span>
                  <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                </CardContent>
              </Card>
            ) : ngssLoaded && filteredQuestions.length > 0 ? (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-foreground text-sm">NGSS Standards Alignment</h4>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredQuestions.map((q, idx) => {
                      const standards = ngssTags.get(q.id) || [];
                      return (
                        <div key={q.id} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground font-mono shrink-0 w-6 text-right">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            {standards.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {standards.map((s) => (
                                  <Badge key={s.code} variant="secondary" className="text-xs cursor-help" title={s.description}>{s.code}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">No matching standard</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-primary/20 bg-card">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="answerKey" checked={includeAnswerKey} onCheckedChange={(c) => setIncludeAnswerKey(c === true)} />
                    <Label htmlFor="answerKey" className="text-sm">Include Answer Key</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="includeNGSS" checked={includeNGSS} onCheckedChange={(c) => setIncludeNGSS(c === true)} disabled={ngssTags.size === 0} />
                    <Label htmlFor="includeNGSS" className="text-sm">Include NGSS Standards</Label>
                  </div>
                </div>
                <div className="sm:ml-auto">
                  <Button onClick={handleExport} disabled={exporting || loadingNGSS} size="lg" className="gap-2">
                    {exporting ? (<><Loader2 className="h-4 w-4 animate-spin" />Generating...</>) : (<><Download className="h-4 w-4" />Export as Word</>)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Quizzes</h3>
          {loadingQuizzes ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />Loading quizzes...
            </div>
          ) : quizzes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No quizzes found in this course.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {quizzes.map((quiz) => {
                const isSelected = selectedQuizId === String(quiz.id);
                return (
                  <Card
                    key={quiz.id}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => handleSelectQuiz(String(quiz.id))}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{quiz.title}</p>
                        <p className="text-xs text-muted-foreground">{quiz.question_count} questions</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Course Grid with Active / Other split ──
  const renderCourseCard = (course: Course, idx: number, section: 'active' | 'other') => {
    const globalIdx = courses.indexOf(course);
    const colorClass = getColorForCourse(course.id, globalIdx);
    const isPinned = pinnedIds.includes(course.id);

    return (
      <Card
        key={course.id}
        draggable
        onDragStart={() => handleDragStart(idx, section)}
        onDragOver={(e) => handleDragOver(e, idx)}
        onDrop={() => handleDrop(idx, section)}
        onDragEnd={handleDragEnd}
        className={`overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 group relative ${
          dragIdx === idx && dragSection === section ? 'opacity-50 scale-95' : ''
        } ${dragOverIdx === idx && dragSection === section && dragIdx !== idx ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        onClick={() => handleSelectCourse(course)}
      >
        <div className={`${colorClass} p-5 pb-12 text-primary-foreground relative`}>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-3 left-3 h-7 w-7 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/40 flex items-center justify-center transition-colors backdrop-blur-sm cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5 text-primary-foreground" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); togglePin(course.id); }}
            className={`absolute top-3 right-12 h-7 w-7 rounded-lg flex items-center justify-center transition-colors backdrop-blur-sm ${
              isPinned ? 'bg-primary-foreground/40' : 'bg-primary-foreground/20 hover:bg-primary-foreground/40 opacity-0 group-hover:opacity-100'
            }`}
            title={isPinned ? 'Unpin course' : 'Pin to top'}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5 text-primary-foreground" /> : <Pin className="h-3.5 w-3.5 text-primary-foreground" />}
          </button>

          <h3 className="text-lg font-bold leading-tight line-clamp-2 pr-20 pl-8">{course.name}</h3>
          {course.course_code && <p className="text-sm opacity-80 mt-1 pl-8">{course.course_code}</p>}
          {course.term?.name && <p className="text-xs opacity-60 mt-0.5 pl-8">{course.term.name}</p>}

          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3 right-3 h-7 w-7 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/40 flex items-center justify-center transition-colors backdrop-blur-sm"
                title="Change tile color"
              >
                <Palette className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="end" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tile Color</p>
              <div className="grid grid-cols-4 gap-2">
                {ALL_COLORS.map((c) => (
                  <button
                    key={c.label}
                    title={c.label}
                    onClick={(e) => { e.stopPropagation(); setCourseColor(course.id, c.class); }}
                    className={`h-8 w-8 rounded-lg transition-all duration-150 hover:scale-110 ring-offset-2 ring-offset-background ${
                      colorClass === c.class ? 'ring-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: c.swatch }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <CardContent className="p-4 flex items-center justify-between -mt-6 relative">
          <div className="h-12 w-12 rounded-full bg-card border-2 border-background shadow flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            {isPinned && <Pin className="h-3 w-3 text-primary" />}
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">View quizzes →</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Add Course dropdown */}
      <div className="flex items-center gap-2">
        {showAddCourse ? (
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter courses..."
                  value={addCourseFilter}
                  onChange={e => setAddCourseFilter(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddCourse(false); setAddCourseFilter(''); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {loadingAllCourses ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading all Canvas courses...
              </div>
            ) : availableToAdd.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {allCanvasCourses.length > 0 ? 'No additional courses found.' : 'No courses loaded.'}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {availableToAdd.map(course => (
                  <div key={course.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{course.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {course.course_code && <span>{course.course_code}</span>}
                        {course.term?.name && <span>• {course.term.name}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addCourseFromList(course)} className="gap-1 shrink-0">
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={handleOpenAddCourse} className="gap-1.5 ml-auto">
            <Plus className="h-4 w-4" /> Add a Course
          </Button>
        )}
      </div>

      {activeCourses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Active Courses
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeCourses.map((course, idx) => renderCourseCard(course, idx, 'active'))}
          </div>
        </div>
      )}

      {activeCourses.length > 0 && otherCourses.length > 0 && (
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Past Courses</span>
          <Separator className="flex-1" />
        </div>
      )}

      {otherCourses.length > 0 && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {otherCourses.map((course, idx) => renderCourseCard(course, idx, 'other'))}
          </div>
        </div>
      )}

      {courses.length === 0 && !loadingCourses && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No courses found in your Canvas account.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
