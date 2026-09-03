/**
 * Curriculum Creative Suite — public entry point.
 *
 * Everything the host application needs should be imported from this file.
 * Host wiring (Supabase client, auth, navigation, chrome, optional Canvas
 * adapters) lives in ./config — repoint those shims when reusing the module.
 */

// ---------------------------------------------------------------------------
// Screens (routing-agnostic page components; mount them in your own router)
// ---------------------------------------------------------------------------
export { default as UnitDetailPage } from "./pages/UnitDetail";
export { default as LessonPlannerPage } from "./pages/LessonPlanner";
export { default as LessonPlanEditorPage } from "./pages/LessonPlanEditor";
export { default as LessonsBrowserPage } from "./pages/LessonsBrowser";
export { default as LibraryPage } from "./pages/Library";
export { default as ReadingLibraryPage } from "./pages/ReadingLibrary";
export { default as SharedReadingPage } from "./pages/SharedReading";
export { default as StandardsBrowserPage } from "./pages/StandardsBrowser";
export { default as ActivityBuilderPage } from "./pages/ActivityBuilder";
export { default as ActivityEditorPage } from "./pages/ActivityEditorPage";
export { default as PublicActivityPlayerPage } from "./pages/PublicActivityPlayer";
export { default as QuestionBankPage } from "./pages/QuestionBank";
export { default as QuestionEditorPage } from "./pages/QuestionEditor";
export { default as QuizBuilderPage } from "./pages/QuizBuilder";
export { default as NotesHomePage } from "./pages/NotesHome";
export { default as NotePage } from "./pages/NotePage";
export { default as SharedNotePage } from "./pages/SharedNote";
export { default as ISATExamEditorPage } from "./pages/ISATExamEditor";
export { default as ISATExamPlayerPage } from "./pages/ISATExamPlayer";
export { default as ISATReviewPage } from "./pages/ISATReviewPage";

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------
export { useCurriculumLessons } from "./hooks/useCurriculum";
export type { CurriculumLesson } from "./hooks/useCurriculum";
export { useLessonAssignments } from "./hooks/useLessonAssignments";
export type { LessonAssignment, RubricRow, QuizQuestion } from "./hooks/useLessonAssignments";
export { useActivityStandards } from "./hooks/useActivityStandards";
export type { ActivityStandard } from "./hooks/useActivityStandards";
export { useAiPreferences } from "./hooks/useAiPreferences";
export type { AiPreferences, AvailableModel } from "./hooks/useAiPreferences";
export { useProfileDefaults } from "./hooks/useProfileDefaults";
export { useUndoRedo } from "./hooks/useUndoRedo";
export * from "./hooks/useNotes";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
export { CurriculumEditor } from "./components/CurriculumEditor";
export { CurriculumReadingViewer } from "./components/CurriculumReadingViewer";
export { DisciplineGroupedUnits } from "./components/DisciplineGroupedUnits";
export { RichTextEditor } from "./components/RichTextEditor";
export { ShareDialog } from "./components/ShareDialog";
export { StandardsCoverageGrid } from "./components/StandardsCoverageGrid";

// ---------------------------------------------------------------------------
// Exporters & content generation
// ---------------------------------------------------------------------------
export * from "./lib/content-generator";
export * from "./lib/export-curriculum-docx";
export * from "./lib/export-lesson-docx";
export * from "./lib/export-reading-docx";
export * from "./lib/export-reading-pdf";
export * from "./lib/export-h5p";
export * from "./lib/export-qti";
export * from "./lib/udl-templates";
export * from "./lib/unit-colors";
