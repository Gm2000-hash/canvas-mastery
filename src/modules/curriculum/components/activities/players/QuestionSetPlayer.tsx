import type { QuestionSetContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: QuestionSetContent; }

export function QuestionSetPlayer({ content }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <p className="text-sm text-muted-foreground">Question Set player coming soon.</p>
      <p className="text-xs text-muted-foreground mt-1">{content.questions.length} questions • Pass: {content.passPercentage}%</p>
    </div>
  );
}
