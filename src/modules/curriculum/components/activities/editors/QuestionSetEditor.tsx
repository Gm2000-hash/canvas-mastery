import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuestionSetContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: QuestionSetContent; onChange: (c: QuestionSetContent) => void; }

export function QuestionSetEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Pass Percentage</Label>
        <Input type="number" className="mt-1.5 w-32" value={content.passPercentage} onChange={e => onChange({ ...content, passPercentage: parseInt(e.target.value) || 70 })} min={0} max={100} />
      </div>
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">Question Set editor — combine sub-activities coming soon.</p>
        <p className="text-xs text-muted-foreground mt-1">Questions: {content.questions.length}</p>
      </div>
    </div>
  );
}
