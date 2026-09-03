/** Optional Canvas LMS adapter. Not wired up in this project — safe no-op stubs. */
export type CanvasConfig = {
  canvasUrl?: string;
  apiToken?: string;
  [key: string]: unknown;
} | null;

export type Course = {
  id: number;
  name: string;
  course_code?: string;
  workflow_state?: string;
  term?: { name?: string; start_at?: string; end_at?: string };
  [key: string]: unknown;
};

export type Quiz = {
  id: number;
  title: string;
  question_count?: number;
  points_possible?: number;
  [key: string]: unknown;
};

export type QuizAnswer = {
  id?: number;
  text?: string;
  html?: string;
  weight: number;
  [key: string]: unknown;
};

export type QuizQuestion = {
  id: number;
  question_text: string;
  question_type: string;
  points_possible: number;
  answers?: QuizAnswer[];
  [key: string]: unknown;
};

const unavailable = () => Promise.reject(new Error("Canvas integration is not configured"));

export const getCourses = (_config?: CanvasConfig): Promise<Course[]> => Promise.resolve([]);
export const getAllCourses = (_config?: CanvasConfig): Promise<Course[]> => Promise.resolve([]);
export const getQuizzes = (_config?: CanvasConfig, _courseId?: number): Promise<Quiz[]> => Promise.resolve([]);
export const getQuiz = (_config?: CanvasConfig, _courseId?: number, _quizId?: number): Promise<Quiz> => unavailable() as Promise<Quiz>;
export const getQuizQuestions = (
  _config?: CanvasConfig,
  _courseId?: number,
  _quizId?: number,
): Promise<QuizQuestion[]> => Promise.resolve([]);
export const buildTaggerText = (q: QuizQuestion): string => String(q?.question_text ?? "");
export const createCanvasAssignment = (
  _config?: CanvasConfig,
  _courseId?: number,
  _assignment?: unknown,
): Promise<{ id: number; html_url: string }> => unavailable() as Promise<{ id: number; html_url: string }>;
