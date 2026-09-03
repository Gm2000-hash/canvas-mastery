import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { FillInBlanksContent } from "@/modules/curriculum/lib/h5p-types";

interface Props {
  content: FillInBlanksContent;
  onChange: (c: FillInBlanksContent) => void;
}

export function FillInBlanksEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Text (wrap blanks with *asterisks*)</Label>
        <Textarea
          className="mt-1.5 min-h-[120px] font-mono text-sm"
          value={content.text}
          onChange={e => onChange({ ...content, text: e.target.value })}
          placeholder="The *sun* rises in the *east*."
        />
        <p className="text-xs text-muted-foreground mt-1">
          Words wrapped in *asterisks* become blanks students must fill in.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={content.acceptAlternatives}
          onCheckedChange={v => onChange({ ...content, acceptAlternatives: v })}
        />
        <Label className="text-sm">Accept alternative spellings</Label>
      </div>
    </div>
  );
}
