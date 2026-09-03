import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { ArithmeticQuizContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: ArithmeticQuizContent; onChange: (c: ArithmeticQuizContent) => void; }

const OPS = [
  { value: "add" as const, label: "Addition (+)" },
  { value: "subtract" as const, label: "Subtraction (−)" },
  { value: "multiply" as const, label: "Multiplication (×)" },
  { value: "divide" as const, label: "Division (÷)" },
];

export function ArithmeticQuizEditor({ content, onChange }: Props) {
  const toggleOp = (op: typeof content.operations[number]) => {
    const has = content.operations.includes(op);
    const next = has ? content.operations.filter(o => o !== op) : [...content.operations, op];
    if (next.length > 0) onChange({ ...content, operations: next });
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Operations</Label>
      <div className="flex flex-wrap gap-4">
        {OPS.map(op => (
          <label key={op.value} className="flex items-center gap-2 text-sm">
            <Checkbox checked={content.operations.includes(op.value)} onCheckedChange={() => toggleOp(op.value)} />
            {op.label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Max Number</Label>
          <Input type="number" className="mt-1.5" value={content.maxNumber} onChange={e => onChange({ ...content, maxNumber: parseInt(e.target.value) || 10 })} />
        </div>
        <div>
          <Label>Questions</Label>
          <Input type="number" className="mt-1.5" value={content.questionCount} onChange={e => onChange({ ...content, questionCount: parseInt(e.target.value) || 5 })} />
        </div>
        <div>
          <Label>Time Limit (sec)</Label>
          <Input type="number" className="mt-1.5" value={content.timeLimit} onChange={e => onChange({ ...content, timeLimit: parseInt(e.target.value) || 60 })} />
        </div>
      </div>
    </div>
  );
}
