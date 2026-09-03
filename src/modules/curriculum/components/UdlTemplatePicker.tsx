import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Check } from "lucide-react";
import { UDL_TEMPLATES, applyTemplate, hasUdlContent, type UdlSupportsShape } from "@/modules/curriculum/lib/udl-templates";

interface UdlTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: UdlSupportsShape | undefined;
  topic: string;
  onApply: (next: UdlSupportsShape) => void;
}

export function UdlTemplatePicker({ open, onOpenChange, current, topic, onApply }: UdlTemplatePickerProps) {
  const [selectedId, setSelectedId] = useState<string>(UDL_TEMPLATES[0]?.id ?? "");
  const hasExisting = hasUdlContent(current);
  const [mode, setMode] = useState<"overwrite" | "fill_empty">(hasExisting ? "fill_empty" : "overwrite");

  const selected = UDL_TEMPLATES.find((t) => t.id === selectedId) ?? UDL_TEMPLATES[0];

  const handleApply = () => {
    if (!selected) return;
    const built = selected.build(topic);
    const merged = applyTemplate(current, built, mode);
    onApply(merged);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> UDL Supports Templates
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick a starting structure tuned to your lesson type. Placeholders use your lesson title — you'll edit details after.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Template list */}
          <ScrollArea className="w-1/2 border-r">
            <div className="p-3 space-y-2">
              {UDL_TEMPLATES.map((tpl) => {
                const active = tpl.id === selectedId;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedId(tpl.id)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      active
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm text-foreground">{tpl.name}</div>
                      {active && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                    </div>
                    <p className="text-xs text-muted-foreground italic mt-0.5">{tpl.tagline}</p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Selected template preview */}
          <ScrollArea className="w-1/2">
            {selected && (
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-base text-foreground">{selected.name}</h3>
                  <p className="text-xs text-muted-foreground italic">{selected.tagline}</p>
                </div>

                <p className="text-sm text-foreground/80">{selected.description}</p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/70">Best for</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.bestFor.map((b) => (
                      <Badge key={b} variant="secondary" className="text-[10px]">
                        {b}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold text-foreground/70">Includes</Label>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li><span className="text-amber-700 font-medium">Engagement:</span> hook, student choice, collaboration, sustain effort, self-regulation</li>
                    <li><span className="text-blue-700 font-medium">Representation:</span> visual, auditory, text supports, vocabulary scaffolds, big idea, background</li>
                    <li><span className="text-green-700 font-medium">Action & Expression:</span> response modes, physical action, planning, checkpoint, assessment</li>
                    <li><span className="text-purple-700 font-medium">Reflection:</span> closing metacognitive prompt</li>
                  </ul>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {hasExisting ? (
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "overwrite" | "fill_empty")}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fill_empty" id="udl-mode-fill" />
                <Label htmlFor="udl-mode-fill" className="text-xs cursor-pointer">
                  Fill empty fields only
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="overwrite" id="udl-mode-overwrite" />
                <Label htmlFor="udl-mode-overwrite" className="text-xs cursor-pointer">
                  Overwrite all fields
                </Label>
              </div>
            </RadioGroup>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              No existing UDL content — template will fill the card.
            </span>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Apply Template
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
