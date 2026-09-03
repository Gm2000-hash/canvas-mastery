import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MarkTheWordsContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: MarkTheWordsContent; onChange: (c: MarkTheWordsContent) => void; }

export function MarkTheWordsEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Text (wrap correct words with *asterisks*)</Label>
        <Textarea
          className="mt-1.5 min-h-[150px] font-mono text-sm"
          value={content.text}
          onChange={e => onChange({ text: e.target.value })}
          placeholder="The *mitochondria* is the *powerhouse* of the *cell*."
        />
        <p className="text-xs text-muted-foreground mt-1">
          Students will click on words. Words in *asterisks* are the correct ones to select.
        </p>
      </div>
    </div>
  );
}
