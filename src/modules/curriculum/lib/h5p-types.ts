export type ActivityType =
  | "fill_in_blanks" | "drag_the_words" | "accordion" | "timeline"
  | "multiple_choice" | "true_false" | "single_choice_set" | "mark_the_words"
  | "essay" | "summary"
  | "dialog_cards" | "flashcards" | "memory_game"
  | "arithmetic_quiz" | "drag_and_drop" | "question_set" | "personality_quiz" | "game_map"
  | "column" | "course_presentation" | "documentation_tool" | "image_hotspots"
  | "interactive_book" | "interactive_video" | "virtual_tour" | "crossword" | "agamotto";

export interface ActivityTypeInfo {
  type: ActivityType;
  label: string;
  description: string;
  category: "content" | "quiz" | "game";
}

export const ACTIVITY_TYPES: ActivityTypeInfo[] = [
  // Content & Structure
  { type: "accordion", label: "Accordion", description: "Vertically stacked expandable items.", category: "content" },
  { type: "timeline", label: "Timeline", description: "Chronological events with text and media.", category: "content" },
  { type: "column", label: "Column", description: "Group multiple content types into a vertical layout.", category: "content" },
  { type: "course_presentation", label: "Course Presentation", description: "Slide-based presentation with interactive elements.", category: "content" },
  { type: "documentation_tool", label: "Documentation Tool", description: "Form wizard to generate documents from text fields.", category: "content" },
  { type: "image_hotspots", label: "Image Hotspots", description: "Image with interactive hotspots revealing content.", category: "content" },
  { type: "interactive_book", label: "Interactive Book", description: "Book-like structure with chapters and mixed content.", category: "content" },
  { type: "interactive_video", label: "Interactive Video", description: "Videos enriched with interactions and quizzes.", category: "content" },
  { type: "virtual_tour", label: "Virtual Tour (360)", description: "Interactive 360° environments with embedded content.", category: "content" },
  // Quiz types
  { type: "fill_in_blanks", label: "Fill in the Blanks", description: "Text with missing words to type or select.", category: "quiz" },
  { type: "drag_the_words", label: "Drag the Words", description: "Drag words into blanks within sentences.", category: "quiz" },
  { type: "multiple_choice", label: "Multiple Choice", description: "Questions with multiple correct answers possible.", category: "quiz" },
  { type: "true_false", label: "True/False", description: "Simple true or false questions.", category: "quiz" },
  { type: "single_choice_set", label: "Single Choice Set", description: "Quick-fire single-answer questions.", category: "quiz" },
  { type: "mark_the_words", label: "Mark the Words", description: "Highlight correct words in a text.", category: "quiz" },
  { type: "essay", label: "Essay", description: "Essay with keyword-based auto-feedback.", category: "quiz" },
  { type: "summary", label: "Summary", description: "Select key statements to build a summary.", category: "quiz" },
  { type: "arithmetic_quiz", label: "Arithmetic Quiz", description: "Timed math quizzes with auto-generated problems.", category: "quiz" },
  { type: "drag_and_drop", label: "Drag and Drop", description: "Drag items onto designated drop zones.", category: "quiz" },
  { type: "question_set", label: "Question Set", description: "Combine multiple question types into one quiz.", category: "quiz" },
  { type: "crossword", label: "Crossword", description: "Custom crossword puzzles.", category: "quiz" },
  // Games
  { type: "dialog_cards", label: "Dialog Cards", description: "Two-sided turning cards for review.", category: "game" },
  { type: "flashcards", label: "Flashcards", description: "Classic term/definition flashcards.", category: "game" },
  { type: "memory_game", label: "Memory Game", description: "Match pairs of cards.", category: "game" },
  { type: "personality_quiz", label: "Personality Quiz", description: "Map answers to personality profiles.", category: "game" },
  { type: "game_map", label: "Game Map", description: "Stage-based game on a visual map.", category: "game" },
  { type: "agamotto", label: "Agamotto", description: "Image sequence with a slider for gradual transitions.", category: "game" },
];

// ─── Existing content types ─────────────────────────────────────

export interface FillInBlanksContent { text: string; acceptAlternatives: boolean; }
export interface DragTheWordsContent { text: string; showInstantFeedback: boolean; }
export interface MediaEmbed {
  url: string;
  type: 'audio' | 'video' | 'image' | 'h5p';
  /** When type === 'h5p', references an h5p_activities row to mount inline. */
  activity_id?: string;
  /** When type === 'h5p', cached activity_type (e.g. 'drag_and_drop', 'image_hotspots') for fast routing. */
  activity_type?: string;
}
export interface AccordionPanel { id: string; title: string; content: string; media?: MediaEmbed; }
export interface AccordionContent { panels: AccordionPanel[]; }
export interface TimelineEvent { id: string; date: string; title: string; description: string; imageUrl?: string; media?: MediaEmbed; }
export interface TimelineContent { headline: string; events: TimelineEvent[]; }
export interface MCOption { id: string; text: string; correct: boolean; }
export interface MultipleChoiceContent { question: string; options: MCOption[]; multiAnswer: boolean; }
export interface TrueFalseContent { statement: string; correctAnswer: boolean; feedback?: string; }
export interface SCQuestion { id: string; question: string; options: string[]; correctIndex: number; }
export interface SingleChoiceSetContent { questions: SCQuestion[]; }
export interface MarkTheWordsContent { text: string; }
export interface EssayKeyword { text: string; caseSensitive: boolean; }
export interface EssayContent { question: string; keywords: EssayKeyword[]; maxWords?: number; }
export interface SummaryGroup { id: string; statements: string[]; correctIndex: number; }
export interface SummaryContent { intro: string; groups: SummaryGroup[]; }
export interface DialogCard { id: string; front: string; back: string; media?: MediaEmbed; }
export interface DialogCardsContent { cards: DialogCard[]; }
export interface Flashcard { id: string; term: string; definition: string; imageUrl?: string; media?: MediaEmbed; }
export interface FlashcardsContent { cards: Flashcard[]; }
export interface MemoryPair { id: string; cardA: string; cardB: string; }
export interface MemoryGameContent { pairs: MemoryPair[]; }
export interface ArithmeticQuizContent { operations: ("add" | "subtract" | "multiply" | "divide")[]; maxNumber: number; questionCount: number; timeLimit: number; }
export interface DnDItem { id: string; label: string; }
export interface DnDZone { id: string; label: string; correctItemIds: string[]; }
export interface DragAndDropContent { items: DnDItem[]; zones: DnDZone[]; }
export interface QuestionSetItem { id: string; type: ActivityType; content: any; }
export interface QuestionSetContent { questions: QuestionSetItem[]; passPercentage: number; }
export interface PersonalityProfile { id: string; name: string; description: string; }
export interface PQOption { text: string; profileScores: Record<string, number>; }
export interface PQQuestion { id: string; question: string; options: PQOption[]; }
export interface PersonalityQuizContent { profiles: PersonalityProfile[]; questions: PQQuestion[]; }
export interface GameMapStage { id: string; label: string; x: number; y: number; type: ActivityType; content: any; }
export interface GameMapContent { title: string; backgroundImage?: string; stages: GameMapStage[]; }

// ─── New content types ─────────────────────────────────────

// Column
export interface ColumnSection { id: string; title: string; content: string; media?: MediaEmbed; }
export interface ColumnContent { sections: ColumnSection[]; }

// Course Presentation
export interface PresentationSlide { id: string; title: string; content: string; notes?: string; media?: MediaEmbed; }
export interface CoursePresentationContent { slides: PresentationSlide[]; }

// Documentation Tool
export interface DocField { id: string; label: string; type: "text" | "textarea" | "number"; required: boolean; }
export interface DocumentationToolContent { title: string; fields: DocField[]; }

// Image Hotspots
export interface Hotspot { id: string; x: number; y: number; title: string; content: string; media?: MediaEmbed; }
export interface ImageHotspotsContent { imageUrl: string; hotspots: Hotspot[]; }

// Interactive Book
export interface BookChapter { id: string; title: string; content: string; media?: MediaEmbed; }
export interface InteractiveBookContent { title: string; chapters: BookChapter[]; }

// Interactive Video
export interface VideoInteraction { id: string; timestamp: number; type: "label" | "question" | "link"; content: string; }
export interface InteractiveVideoContent { videoUrl: string; interactions: VideoInteraction[]; }

// Virtual Tour
export interface TourScene { id: string; title: string; description: string; imageUrl?: string; media?: MediaEmbed; }
export interface VirtualTourContent { title: string; scenes: TourScene[]; }

// Crossword
export interface CrosswordWord { id: string; word: string; clue: string; direction: "across" | "down"; }
export interface CrosswordContent { title: string; words: CrosswordWord[]; }

// Agamotto
export interface AgamottoImage { id: string; imageUrl: string; label: string; description?: string; }
export interface AgamottoContent { images: AgamottoImage[]; }

export type ActivityContent =
  | FillInBlanksContent | DragTheWordsContent | AccordionContent | TimelineContent
  | MultipleChoiceContent | TrueFalseContent | SingleChoiceSetContent | MarkTheWordsContent
  | EssayContent | SummaryContent
  | DialogCardsContent | FlashcardsContent | MemoryGameContent
  | ArithmeticQuizContent | DragAndDropContent | QuestionSetContent | PersonalityQuizContent | GameMapContent
  | ColumnContent | CoursePresentationContent | DocumentationToolContent | ImageHotspotsContent
  | InteractiveBookContent | InteractiveVideoContent | VirtualTourContent | CrosswordContent | AgamottoContent;

export function getDefaultContent(type: ActivityType): ActivityContent {
  switch (type) {
    case "fill_in_blanks": return { text: "The *sun* rises in the *east*.", acceptAlternatives: true };
    case "drag_the_words": return { text: "The *sun* rises in the *east* and sets in the *west*.", showInstantFeedback: true };
    case "accordion": return { panels: [{ id: crypto.randomUUID(), title: "Section 1", content: "Content goes here..." }] };
    case "timeline": return { headline: "My Timeline", events: [{ id: crypto.randomUUID(), date: "2024", title: "Event 1", description: "Description..." }] };
    case "multiple_choice": return { question: "What is 2 + 2?", options: [{ id: crypto.randomUUID(), text: "3", correct: false }, { id: crypto.randomUUID(), text: "4", correct: true }, { id: crypto.randomUUID(), text: "5", correct: false }], multiAnswer: false };
    case "true_false": return { statement: "The Earth orbits the Sun.", correctAnswer: true, feedback: "" };
    case "single_choice_set": return { questions: [{ id: crypto.randomUUID(), question: "What color is the sky?", options: ["Red", "Blue", "Green"], correctIndex: 1 }] };
    case "mark_the_words": return { text: "The *mitochondria* is the *powerhouse* of the *cell*." };
    case "essay": return { question: "Explain photosynthesis.", keywords: [{ text: "sunlight", caseSensitive: false }, { text: "chlorophyll", caseSensitive: false }], maxWords: 200 };
    case "summary": return { intro: "Select the correct statement in each group.", groups: [{ id: crypto.randomUUID(), statements: ["Correct statement", "Wrong statement A", "Wrong statement B"], correctIndex: 0 }] };
    case "dialog_cards": return { cards: [{ id: crypto.randomUUID(), front: "Term", back: "Definition" }] };
    case "flashcards": return { cards: [{ id: crypto.randomUUID(), term: "Photosynthesis", definition: "The process by which plants convert sunlight into energy." }] };
    case "memory_game": return { pairs: [{ id: crypto.randomUUID(), cardA: "H₂O", cardB: "Water" }, { id: crypto.randomUUID(), cardA: "NaCl", cardB: "Salt" }] };
    case "arithmetic_quiz": return { operations: ["add", "subtract"], maxNumber: 20, questionCount: 10, timeLimit: 60 };
    case "drag_and_drop": return { items: [{ id: crypto.randomUUID(), label: "Item 1" }], zones: [{ id: crypto.randomUUID(), label: "Zone A", correctItemIds: [] }] };
    case "question_set": return { questions: [], passPercentage: 70 };
    case "personality_quiz": return { profiles: [{ id: crypto.randomUUID(), name: "Type A", description: "Description..." }], questions: [{ id: crypto.randomUUID(), question: "Question?", options: [] }] };
    case "game_map": return { title: "My Game", stages: [] };
    case "column": return { sections: [{ id: crypto.randomUUID(), title: "Section 1", content: "Content..." }] };
    case "course_presentation": return { slides: [{ id: crypto.randomUUID(), title: "Slide 1", content: "Welcome!", notes: "" }] };
    case "documentation_tool": return { title: "My Document", fields: [{ id: crypto.randomUUID(), label: "Name", type: "text", required: true }] };
    case "image_hotspots": return { imageUrl: "", hotspots: [] };
    case "interactive_book": return { title: "My Book", chapters: [{ id: crypto.randomUUID(), title: "Chapter 1", content: "Once upon a time..." }] };
    case "interactive_video": return { videoUrl: "", interactions: [] };
    case "virtual_tour": return { title: "My Tour", scenes: [{ id: crypto.randomUUID(), title: "Scene 1", description: "Welcome..." }] };
    case "crossword": return { title: "My Crossword", words: [{ id: crypto.randomUUID(), word: "CELL", clue: "Basic unit of life", direction: "across" }] };
    case "agamotto": return { images: [{ id: crypto.randomUUID(), imageUrl: "", label: "Image 1" }] };
  }
}
