import { useRef, useState, useCallback, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, MapPin, ImageIcon } from "lucide-react";
import type { GameMapContent, GameMapStage, ActivityType } from "@/modules/curriculum/lib/h5p-types";
import { ACTIVITY_TYPES, getDefaultContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: GameMapContent; onChange: (c: GameMapContent) => void; }

export function GameMapEditor({ content, onChange }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStageType, setNewStageType] = useState<ActivityType>("multiple_choice");
  const [newStageLabel, setNewStageLabel] = useState("");

  const updateStage = useCallback((id: string, patch: Partial<GameMapStage>) => {
    onChange({ ...content, stages: content.stages.map(s => s.id === id ? { ...s, ...patch } : s) });
  }, [content, onChange]);

  const handlePointerDown = (e: React.PointerEvent, stageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(stageId);
    setSelected(stageId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updateStage(dragging, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }, [dragging, updateStage]);

  const handlePointerUp = useCallback(() => setDragging(null), []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvas) {
      setSelected(null);
    }
  };

  const addStage = () => {
    if (!newStageLabel.trim()) return;
    const stage: GameMapStage = {
      id: crypto.randomUUID(),
      label: newStageLabel.trim(),
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      type: newStageType,
      content: getDefaultContent(newStageType),
    };
    onChange({ ...content, stages: [...content.stages, stage] });
    setNewStageLabel("");
    setShowAddDialog(false);
  };

  const removeStage = (id: string) => {
    onChange({ ...content, stages: content.stages.filter(s => s.id !== id) });
    if (selected === id) setSelected(null);
  };

  const selectedStage = content.stages.find(s => s.id === selected);

  // Draw connections between stages in order
  const lines = content.stages.slice(0, -1).map((s, i) => {
    const next = content.stages[i + 1];
    return { x1: s.x, y1: s.y, x2: next.x, y2: next.y, key: `${s.id}-${next.id}` };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label>Game Title</Label>
          <Input className="mt-1.5" value={content.title} onChange={e => onChange({ ...content, title: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Background Image URL (optional)</Label>
        <Input
          className="mt-1.5"
          value={content.backgroundImage ?? ""}
          onChange={e => onChange({ ...content, backgroundImage: e.target.value })}
          placeholder="https://example.com/map-background.jpg"
        />
      </div>

      {/* Visual Map Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Stage Map
          </Label>
          <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Stage
          </Button>
        </div>

        <div
          ref={canvasRef}
          data-canvas="true"
          className="relative rounded-xl border-2 border-border overflow-hidden select-none touch-none"
          style={{
            height: 400,
            background: content.backgroundImage
              ? `url(${content.backgroundImage}) center/cover no-repeat`
              : undefined,
          }}
          onClick={handleCanvasClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Background fallback */}
          {!content.backgroundImage && (
            <div data-canvas="true" className="absolute inset-0 bg-muted/30 flex items-center justify-center pointer-events-none">
              <div className="text-center opacity-30">
                <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-2">Add a background image above</p>
              </div>
            </div>
          )}

          {/* Path lines between stages */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {lines.map(l => (
              <line
                key={l.key}
                x1={`${l.x1}%`} y1={`${l.y1}%`}
                x2={`${l.x2}%`} y2={`${l.y2}%`}
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                strokeDasharray="8 4"
                strokeOpacity={0.5}
              />
            ))}
          </svg>

          {/* Stage nodes */}
          {content.stages.map((stage, idx) => (
            <div
              key={stage.id}
              className={`absolute flex flex-col items-center cursor-grab active:cursor-grabbing`}
              style={{
                left: `${stage.x}%`,
                top: `${stage.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: dragging === stage.id ? 50 : selected === stage.id ? 40 : 10,
              }}
              onPointerDown={e => handlePointerDown(e, stage.id)}
            >
              {/* Node circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow-lg
                  transition-all duration-150
                  ${selected === stage.id
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 bg-primary text-primary-foreground"
                    : "bg-card border-2 border-primary/60 text-primary hover:scale-105"
                  }
                `}
              >
                {idx + 1}
              </div>
              {/* Label */}
              <span className={`
                mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md max-w-[80px] truncate text-center
                ${selected === stage.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card/90 text-foreground border border-border/60"
                }
              `}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>

        {content.stages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">Click "Add Stage" to place your first stage on the map.</p>
        )}
      </div>

      {/* Selected stage details panel */}
      {selectedStage && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              Stage {content.stages.findIndex(s => s.id === selectedStage.id) + 1} Settings
            </span>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeStage(selectedStage.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input className="mt-1 text-sm" value={selectedStage.label} onChange={e => updateStage(selectedStage.id, { label: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Activity Type</Label>
              <Select value={selectedStage.type} onValueChange={v => updateStage(selectedStage.id, { type: v as ActivityType, content: getDefaultContent(v as ActivityType) })}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(a => (
                    <SelectItem key={a.type} value={a.type}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">X Position (%)</Label>
              <Input type="number" className="mt-1 text-sm" min={0} max={100} value={selectedStage.x} onChange={e => updateStage(selectedStage.id, { x: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs">Y Position (%)</Label>
              <Input type="number" className="mt-1 text-sm" min={0} max={100} value={selectedStage.y} onChange={e => updateStage(selectedStage.id, { y: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </div>
      )}

      {/* Stage list */}
      {content.stages.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Stage Order (drag stages on map to reposition)</Label>
          {content.stages.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                selected === s.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/40"
              }`}
              onClick={() => setSelected(s.id)}
            >
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="flex-1 font-medium truncate">{s.label}</span>
              <span className="text-xs text-muted-foreground">{ACTIVITY_TYPES.find(a => a.type === s.type)?.label}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/70" onClick={e => { e.stopPropagation(); removeStage(s.id); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Stage Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a New Stage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Stage Label</Label>
              <Input className="mt-1.5" placeholder="e.g. Vocabulary Challenge" value={newStageLabel} onChange={e => setNewStageLabel(e.target.value)} />
            </div>
            <div>
              <Label>Activity Type</Label>
              <Select value={newStageType} onValueChange={v => setNewStageType(v as ActivityType)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(a => (
                    <SelectItem key={a.type} value={a.type}>{a.label} — {a.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={addStage} disabled={!newStageLabel.trim()}>Add Stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
