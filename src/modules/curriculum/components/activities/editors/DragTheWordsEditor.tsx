import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { DragTheWordsContent } from "@/modules/curriculum/lib/h5p-types";

interface Props {
  content: DragTheWordsContent;
  onChange: (c: DragTheWordsContent) => void;
}

export function DragTheWordsEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Text (wrap draggable words with *asterisks*)</Label>
        <Textarea
          className="mt-1.5 min-h-[120px] font-mono text-sm"
          value={content.text}
          onChange={e => onChange({ ...content, text: e.target.value })}
          placeholder="The *sun* rises in the *east* and sets in the *west*."
        />
        <p className="text-xs text-muted-foreground mt-1">
          Words in *asterisks* are removed and become draggable chips.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={content.showInstantFeedback}
          onCheckedChange={v => onChange({ ...content, showInstantFeedback: v })}
        />
        <Label className="text-sm">Show instant feedback on drop</Label>
      </div>
    </div>
  );
}
