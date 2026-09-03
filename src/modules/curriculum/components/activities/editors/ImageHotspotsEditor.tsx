import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, MousePointerClick } from "lucide-react";
import { ReorderControls, moveItem } from "./ReorderControls";
import { MediaInsert } from "./MediaInsert";
import { RichTextEditor } from "@/modules/curriculum/components/RichTextEditor";
import type { ImageHotspotsContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: ImageHotspotsContent; onChange: (c: ImageHotspotsContent) => void; }

export function ImageHotspotsEditor({ content, onChange }: Props) {
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);
  const [placingMode, setPlacingMode] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    if (placingMode) {
      // Add a new hotspot at clicked position
      const newId = crypto.randomUUID();
      onChange({ ...content, hotspots: [...content.hotspots, { id: newId, x, y, title: "", content: "" }] });
      setSelectedHotspot(newId);
      setPlacingMode(false);
    } else if (selectedHotspot) {
      // Move selected hotspot to clicked position
      onChange({
        ...content,
        hotspots: content.hotspots.map(h => h.id === selectedHotspot ? { ...h, x, y } : h),
      });
    }
  }, [content, onChange, placingMode, selectedHotspot]);

  return (
    <div className="space-y-4">
      <div>
        <Label>Image URL</Label>
        <Input className="mt-1.5" value={content.imageUrl} onChange={e => onChange({ ...content, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" />
      </div>

      {/* Visual preview */}
      {content.imageUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Visual Preview</Label>
            <Button
              size="sm"
              variant={placingMode ? "default" : "outline"}
              onClick={() => { setPlacingMode(!placingMode); setSelectedHotspot(null); }}
              className="text-xs h-7"
            >
              <MousePointerClick className="h-3.5 w-3.5 mr-1" />
              {placingMode ? "Click image to place…" : "Click to place hotspot"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {placingMode
              ? "Click anywhere on the image to add a new hotspot."
              : selectedHotspot
                ? "Click on the image to move the selected hotspot, or click a dot to select a different one."
                : "Click a hotspot dot to select it, then click the image to reposition it."}
          </p>
          <div
            ref={imgRef}
            className="relative border border-border rounded-lg overflow-hidden cursor-crosshair bg-muted/30"
            style={{ maxHeight: 400 }}
            onClick={handleImageClick}
          >
            <img
              src={content.imageUrl}
              alt="Hotspot background"
              className="w-full h-auto block"
              style={{ maxHeight: 400, objectFit: "contain" }}
              draggable={false}
            />
            {content.hotspots.map((h, i) => (
              <button
                key={h.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                  selectedHotspot === h.id
                    ? "w-7 h-7 bg-primary text-primary-foreground border-primary shadow-lg scale-110 z-10"
                    : "w-5 h-5 bg-background text-foreground border-primary/60 hover:scale-110 z-0"
                }`}
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedHotspot(selectedHotspot === h.id ? null : h.id);
                  setPlacingMode(false);
                }}
                title={h.title || `Hotspot ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      <Label className="text-sm font-medium">Hotspots</Label>
      <p className="text-xs text-muted-foreground">Position hotspots using the visual preview above or X/Y percentages (0–100).</p>
      {content.hotspots.map((h, i) => (
        <div
          key={h.id}
          className={`border rounded-xl p-4 space-y-3 transition-colors ${
            selectedHotspot === h.id ? "border-primary bg-primary/5" : "border-border/60"
          }`}
          onClick={() => setSelectedHotspot(h.id)}
        >
          <div className="flex items-center gap-2">
            <ReorderControls index={i} total={content.hotspots.length} label={`Hotspot ${i + 1}`} onMove={(offset) => onChange({ ...content, hotspots: moveItem(content.hotspots, i, offset) })} />
            <div className="flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); if (selectedHotspot === h.id) setSelectedHotspot(null); onChange({ ...content, hotspots: content.hotspots.filter(x => x.id !== h.id) }); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Title" value={h.title} onChange={e => onChange({ ...content, hotspots: content.hotspots.map(x => x.id === h.id ? { ...x, title: e.target.value } : x) })} />
            <Input type="number" placeholder="X %" value={h.x} onChange={e => onChange({ ...content, hotspots: content.hotspots.map(x => x.id === h.id ? { ...x, x: parseFloat(e.target.value) || 0 } : x) })} />
            <Input type="number" placeholder="Y %" value={h.y} onChange={e => onChange({ ...content, hotspots: content.hotspots.map(x => x.id === h.id ? { ...x, y: parseFloat(e.target.value) || 0 } : x) })} />
          </div>
          <RichTextEditor
            content={h.content}
            onChange={html => onChange({ ...content, hotspots: content.hotspots.map(x => x.id === h.id ? { ...x, content: html } : x) })}
            placeholder="Hotspot content..."
            compact
          />
          <MediaInsert
            media={h.media}
            onChange={media => onChange({ ...content, hotspots: content.hotspots.map(x => x.id === h.id ? { ...x, media } : x) })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => { const id = crypto.randomUUID(); onChange({ ...content, hotspots: [...content.hotspots, { id, x: 50, y: 50, title: "", content: "" }] }); setSelectedHotspot(id); }}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Hotspot
      </Button>
    </div>
  );
}
