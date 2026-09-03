import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { TrueFalseContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: TrueFalseContent; onChange: (c: TrueFalseContent) => void; }

export function TrueFalseEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Statement</Label>
        <Textarea className="mt-1.5" value={content.statement} onChange={e => onChange({ ...content, statement: e.target.value })} placeholder="The Earth is flat." />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={content.correctAnswer} onCheckedChange={v => onChange({ ...content, correctAnswer: v })} />
        <Label className="text-sm">Correct answer is <strong>{content.correctAnswer ? "True" : "False"}</strong></Label>
      </div>
      <div>
        <Label>Feedback (optional)</Label>
        <Input className="mt-1.5" value={content.feedback ?? ""} onChange={e => onChange({ ...content, feedback: e.target.value })} placeholder="Explanation shown after answering" />
      </div>
    </div>
  );
}
