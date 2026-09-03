import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from "lucide-react";
import type { LessonAssignment, RubricRow } from "@/modules/curriculum/hooks/useLessonAssignments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: LessonAssignment | null;
  onSave: (patch: Partial<LessonAssignment>) => Promise<void>;
}

const TYPES = ["worksheet", "project", "lab", "essay", "discussion", "exit-ticket", "rubric", "other"];

export default function AssignmentEditorDialog({ open, onOpenChange, assignment, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("worksheet");
  const [points, setPoints] = useState(100);
  const [instructions, setInstructions] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);
  const [rubric, setRubric] = useState<RubricRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (assignment) {
      setTitle(assignment.title);
      setType(assignment.assignment_type);
      setPoints(Number(assignment.points_possible) || 0);
      setInstructions(assignment.instructions || "");
      setMaterials(assignment.materials || []);
      setRubric(assignment.rubric || []);
    }
  }, [assignment]);

  if (!assignment) return null;

  const save = async () => {
    setSaving(true);
    await onSave({ title, assignment_type: type, points_possible: points, instructions, materials, rubric });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit assignment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_120px] gap-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Points</Label>
              <Input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Instructions (student-facing)</Label>
            <RichTextEditor content={instructions} onChange={setInstructions} placeholder="Write instructions, or paste from AI…" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Materials</Label>
              <Button variant="ghost" size="sm" onClick={() => setMaterials([...materials, ""])}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
            </div>
            {materials.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input value={m} onChange={e => setMaterials(materials.map((x, j) => j === i ? e.target.value : x))} placeholder="e.g. Chromebook, ruler, etc." />
                <Button variant="ghost" size="icon" onClick={() => setMaterials(materials.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Rubric</Label>
              <Button variant="ghost" size="sm" onClick={() => setRubric([...rubric, { criterion: "", exemplary: "", proficient: "", developing: "", beginning: "" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add row
              </Button>
            </div>
            <div className="space-y-3">
              {rubric.map((r, i) => (
                <div key={i} className="rounded-md border border-border/60 p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input value={r.criterion} onChange={e => setRubric(rubric.map((x, j) => j === i ? { ...x, criterion: e.target.value } : x))} placeholder="Criterion (e.g. Use of evidence)" />
                    <Button variant="ghost" size="icon" onClick={() => setRubric(rubric.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(["exemplary", "proficient", "developing", "beginning"] as const).map(lvl => (
                      <Textarea key={lvl} value={(r as any)[lvl] || ""} onChange={e => setRubric(rubric.map((x, j) => j === i ? { ...x, [lvl]: e.target.value } : x))} placeholder={lvl} rows={2} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
