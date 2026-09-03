import type { ActivityType, ActivityContent } from "@/modules/curriculum/lib/h5p-types";
import type {
  FillInBlanksContent, DragTheWordsContent, AccordionContent, TimelineContent,
  MultipleChoiceContent, TrueFalseContent, SingleChoiceSetContent, MarkTheWordsContent,
  EssayContent, SummaryContent, DialogCardsContent, FlashcardsContent, MemoryGameContent,
  ArithmeticQuizContent, DragAndDropContent, QuestionSetContent, PersonalityQuizContent, GameMapContent,
  ColumnContent, CoursePresentationContent, DocumentationToolContent, ImageHotspotsContent,
  InteractiveBookContent, InteractiveVideoContent, VirtualTourContent, CrosswordContent, AgamottoContent,
} from "@/modules/curriculum/lib/h5p-types";
import { FillInBlanksPlayer } from "./players/FillInBlanksPlayer";
import { DragTheWordsPlayer } from "./players/DragTheWordsPlayer";
import { AccordionPlayer } from "./players/AccordionPlayer";
import { TimelinePlayer } from "./players/TimelinePlayer";
import { MultipleChoicePlayer } from "./players/MultipleChoicePlayer";
import { TrueFalsePlayer } from "./players/TrueFalsePlayer";
import { SingleChoiceSetPlayer } from "./players/SingleChoiceSetPlayer";
import { MarkTheWordsPlayer } from "./players/MarkTheWordsPlayer";
import { EssayPlayer } from "./players/EssayPlayer";
import { SummaryPlayer } from "./players/SummaryPlayer";
import { DialogCardsPlayer } from "./players/DialogCardsPlayer";
import { FlashcardsPlayer } from "./players/FlashcardsPlayer";
import { MemoryGamePlayer } from "./players/MemoryGamePlayer";
import { ArithmeticQuizPlayer } from "./players/ArithmeticQuizPlayer";
import { DragAndDropPlayer } from "./players/DragAndDropPlayer";
import { QuestionSetPlayer } from "./players/QuestionSetPlayer";
import { PersonalityQuizPlayer } from "./players/PersonalityQuizPlayer";
import { GameMapPlayer } from "./players/GameMapPlayer";
import { ColumnPlayer } from "./players/ColumnPlayer";
import { CoursePresentationPlayer } from "./players/CoursePresentationPlayer";
import { DocumentationToolPlayer } from "./players/DocumentationToolPlayer";
import { ImageHotspotsPlayer } from "./players/ImageHotspotsPlayer";
import { InteractiveBookPlayer } from "./players/InteractiveBookPlayer";
import { InteractiveVideoPlayer } from "./players/InteractiveVideoPlayer";
import { VirtualTourPlayer } from "./players/VirtualTourPlayer";
import { CrosswordPlayer } from "./players/CrosswordPlayer";
import { AgamottoPlayer } from "./players/AgamottoPlayer";

interface Props { type: ActivityType; content: ActivityContent; }

export function ActivityPlayer({ type, content }: Props) {
  switch (type) {
    case "fill_in_blanks": return <FillInBlanksPlayer content={content as FillInBlanksContent} />;
    case "drag_the_words": return <DragTheWordsPlayer content={content as DragTheWordsContent} />;
    case "accordion": return <AccordionPlayer content={content as AccordionContent} />;
    case "timeline": return <TimelinePlayer content={content as TimelineContent} />;
    case "multiple_choice": return <MultipleChoicePlayer content={content as MultipleChoiceContent} />;
    case "true_false": return <TrueFalsePlayer content={content as TrueFalseContent} />;
    case "single_choice_set": return <SingleChoiceSetPlayer content={content as SingleChoiceSetContent} />;
    case "mark_the_words": return <MarkTheWordsPlayer content={content as MarkTheWordsContent} />;
    case "essay": return <EssayPlayer content={content as EssayContent} />;
    case "summary": return <SummaryPlayer content={content as SummaryContent} />;
    case "dialog_cards": return <DialogCardsPlayer content={content as DialogCardsContent} />;
    case "flashcards": return <FlashcardsPlayer content={content as FlashcardsContent} />;
    case "memory_game": return <MemoryGamePlayer content={content as MemoryGameContent} />;
    case "arithmetic_quiz": return <ArithmeticQuizPlayer content={content as ArithmeticQuizContent} />;
    case "drag_and_drop": return <DragAndDropPlayer content={content as DragAndDropContent} />;
    case "question_set": return <QuestionSetPlayer content={content as QuestionSetContent} />;
    case "personality_quiz": return <PersonalityQuizPlayer content={content as PersonalityQuizContent} />;
    case "game_map": return <GameMapPlayer content={content as GameMapContent} />;
    case "column": return <ColumnPlayer content={content as ColumnContent} />;
    case "course_presentation": return <CoursePresentationPlayer content={content as CoursePresentationContent} />;
    case "documentation_tool": return <DocumentationToolPlayer content={content as DocumentationToolContent} />;
    case "image_hotspots": return <ImageHotspotsPlayer content={content as ImageHotspotsContent} />;
    case "interactive_book": return <InteractiveBookPlayer content={content as InteractiveBookContent} />;
    case "interactive_video": return <InteractiveVideoPlayer content={content as InteractiveVideoContent} />;
    case "virtual_tour": return <VirtualTourPlayer content={content as VirtualTourContent} />;
    case "crossword": return <CrosswordPlayer content={content as CrosswordContent} />;
    case "agamotto": return <AgamottoPlayer content={content as AgamottoContent} />;
    default: return <p className="text-sm text-muted-foreground">Unknown activity type.</p>;
  }
}
