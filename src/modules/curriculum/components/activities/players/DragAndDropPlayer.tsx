import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import type { DragAndDropContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: DragAndDropContent; }

export function DragAndDropPlayer({ content }: Props) {
  const [placements, setPlacements] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    content.zones.forEach(z => m[z.id] = []);
    return m;
  });
  const [bank, setBank] = useState<string[]>(content.items.map(i => i.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const getItemLabel = (id: string) => content.items.find(i => i.id === id)?.label ?? id;

  const handleDrop = useCallback((zoneId: string) => {
    if (!dragging) return;
    setBank(b => b.filter(id => id !== dragging));
    setPlacements(prev => {
      const next = { ...prev };
      // Remove from any other zone
      Object.keys(next).forEach(k => { next[k] = next[k].filter(id => id !== dragging); });
      next[zoneId] = [...(next[zoneId] || []), dragging];
      return next;
    });
    setDragging(null);
    setChecked(false);
  }, [dragging]);

  const removeFromZone = (zoneId: string, itemId: string) => {
    setPlacements(prev => ({ ...prev, [zoneId]: prev[zoneId].filter(id => id !== itemId) }));
    setBank(b => [...b, itemId]);
    setChecked(false);
  };

  const score = useMemo(() => {
    if (!checked) return null;
    let correct = 0; let total = 0;
    content.zones.forEach(z => {
      const placed = placements[z.id] || [];
      placed.forEach(id => {
        total++;
        if (z.correctItemIds.includes(id)) correct++;
      });
    });
    return { correct, total: content.items.length };
  }, [checked, placements, content]);

  return (
    <div className="space-y-4">
      {/* Bank */}
      <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-dashed border-border bg-muted/30 min-h-[40px]">
        {bank.length === 0 && <span className="text-xs text-muted-foreground italic">All items placed</span>}
        {bank.map(id => (
          <Badge key={id} draggable onDragStart={() => setDragging(id)} className="cursor-grab active:cursor-grabbing bg-primary/10 text-primary border-primary/20">
            {getItemLabel(id)}
          </Badge>
        ))}
      </div>

      {/* Zones */}
      <div className="grid gap-3">
        {content.zones.map(zone => {
          const items = placements[zone.id] || [];
          return (
            <div
              key={zone.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(zone.id)}
              className="rounded-xl border-2 border-dashed border-border p-4 min-h-[60px] transition-colors hover:border-primary/30"
            >
              <p className="text-xs font-semibold text-muted-foreground mb-2">{zone.label}</p>
              <div className="flex flex-wrap gap-2">
                {items.map(id => {
                  const isCorrect = checked ? zone.correctItemIds.includes(id) : null;
                  return (
                    <Badge
                      key={id}
                      onClick={() => !checked && removeFromZone(zone.id, id)}
                      className={`cursor-pointer ${
                        isCorrect === true ? "bg-green-100 text-green-700 border-green-200" :
                        isCorrect === false ? "bg-destructive/10 text-destructive border-destructive/20" :
                        "bg-primary/10 text-primary border-primary/20"
                      }`}
                    >
                      {getItemLabel(id)}
                      {isCorrect === true && <CheckCircle2 className="h-3 w-3 ml-1" />}
                      {isCorrect === false && <XCircle className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={checked || bank.length > 0}>Check</Button>
        {checked && score && (
          <>
            <Button variant="outline" onClick={() => {
              setPlacements(() => { const m: Record<string, string[]> = {}; content.zones.forEach(z => m[z.id] = []); return m; });
              setBank(content.items.map(i => i.id)); setChecked(false);
            }}>Retry</Button>
            <span className="text-sm font-medium text-muted-foreground">{score.correct}/{score.total} correct</span>
          </>
        )}
      </div>
    </div>
  );
}
