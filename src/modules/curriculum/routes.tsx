/**
 * React Router mounts for the Curriculum Suite inside Canvas Mastery.
 *
 * - Authenticated screens live under /app/curriculum/* (rendered inside AppLayout).
 * - Public share/play screens live under /curriculum/* (no auth).
 *
 * Every page is lazy-loaded so the (large) suite does not weigh down the
 * rest of the app's initial bundle.
 */
import { lazy, Suspense } from "react";
import { Navigate, Route } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const L = (loader: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(loader);
  return () => (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <C />
    </Suspense>
  );
};

const LessonPlanner = L(() => import("./pages/LessonPlanner"));
const UnitDetail = L(() => import("./pages/UnitDetail"));
const LessonPlanEditor = L(() => import("./pages/LessonPlanEditor"));
const LessonsBrowser = L(() => import("./pages/LessonsBrowser"));
const ReadingLibrary = L(() => import("./pages/ReadingLibrary"));
const StandardsBrowser = L(() => import("./pages/StandardsBrowser"));
const ActivityBuilder = L(() => import("./pages/ActivityBuilder"));
const ActivityEditor = L(() => import("./pages/ActivityEditorPage"));
const QuestionBank = L(() => import("./pages/QuestionBank"));
const QuestionEditor = L(() => import("./pages/QuestionEditor"));
const QuizBuilder = L(() => import("./pages/QuizBuilder"));
const NotesHome = L(() => import("./pages/NotesHome"));
const NotePage = L(() => import("./pages/NotePage"));
const ISATExamEditor = L(() => import("./pages/ISATExamEditor"));
const ISATReview = L(() => import("./pages/ISATReviewPage"));

const SharedNote = L(() => import("./pages/SharedNote"));
const SharedReading = L(() => import("./pages/SharedReading"));
const PublicActivityPlayer = L(() => import("./pages/PublicActivityPlayer"));
const ISATExamPlayer = L(() => import("./pages/ISATExamPlayer"));

/** Mount inside the authenticated /app layout. */
export function curriculumAppRoutes() {
  return (
    <>
      <Route path="curriculum" element={<Navigate to="/app/curriculum/lesson-planner" replace />} />
      <Route path="curriculum/lesson-planner" element={<LessonPlanner />} />
      <Route path="curriculum/units/:id" element={<UnitDetail />} />
      <Route path="curriculum/lesson-plans/:id" element={<LessonPlanEditor />} />
      <Route path="curriculum/lessons" element={<LessonsBrowser />} />
      <Route path="curriculum/lessons/:id" element={<UnitDetail />} />
      <Route path="curriculum/library" element={<Navigate to="/app/curriculum/reading-library" replace />} />
      <Route path="curriculum/reading-library" element={<ReadingLibrary />} />
      <Route path="curriculum/standards" element={<StandardsBrowser />} />
      <Route path="curriculum/activities" element={<ActivityBuilder />} />
      <Route path="curriculum/activities/:id" element={<ActivityEditor />} />
      <Route path="curriculum/activities/:id/play" element={<PublicActivityPlayer />} />
      <Route path="curriculum/question-bank" element={<QuestionBank />} />
      <Route path="curriculum/create-question" element={<QuestionEditor />} />
      <Route path="curriculum/quiz-builder" element={<QuizBuilder />} />
      <Route path="curriculum/quiz-builder/:id" element={<QuizBuilder />} />
      <Route path="curriculum/notes" element={<NotesHome />} />
      <Route path="curriculum/notes/:id" element={<NotePage />} />
      <Route path="curriculum/isat-exams/:id" element={<ISATExamEditor />} />
      <Route path="curriculum/isat-exams/:id/edit" element={<ISATExamEditor />} />
      <Route path="curriculum/isat-exams/:id/review" element={<ISATReview />} />
      <Route path="curriculum/isat-exams/:id/play" element={<ISATExamPlayer />} />
    </>
  );
}

/** Mount at the router root (public, no auth). */
export function curriculumPublicRoutes() {
  return (
    <>
      <Route path="/curriculum/share/:token" element={<SharedNote />} />
      <Route path="/curriculum/shared-reading/:token" element={<SharedReading />} />
      <Route path="/curriculum/activities/:id/play" element={<PublicActivityPlayer />} />
      <Route path="/curriculum/isat-exams/:id/play" element={<ISATExamPlayer />} />
    </>
  );
}
