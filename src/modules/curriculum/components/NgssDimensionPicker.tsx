import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Beaker, BookOpen, Network, Sparkles } from "lucide-react";
import {
  NGSS_DIMENSIONS,
  type NgssDimension,
  type NgssDimensionType,
} from "@/modules/curriculum/lib/ngss-dimensions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Performance expectation codes whose sub-components are eligible (e.g. ["MS-LS1-1", "MS-LS1-2"]) */
  parentCodes: string[];
  /** Currently selected sub-component codes (e.g. "MS-LS1-1.SEP") */
  selected: string[];
  onSave: (selectedCodes: string[]) => void;
  /** Override the dialog title/description for context-specific copy. */
  title?: string;
  description?: string;
}

const TYPE_META: Record<NgssDimensionType, { label: string; icon: typeof Beaker; tint: string; helper: string }> = {
  SEP: {
    label: "Science & Engineering Practices",
    icon: Beaker,
    tint: "bg-amber-50 border-amber-200 text-amber-900",
    helper: "The doing — what students DO as scientists and engineers.",
  },
  DCI: {
    label: "Disciplinary Core Ideas",
    icon: BookOpen,
    tint: "bg-blue-50 border-blue-200 text-blue-900",
    helper: "The knowing — the foundational content knowledge.",
  },
  CCC: {
    label: "Crosscutting Concepts",
    icon: Network,
    tint: "bg-emerald-50 border-emerald-200 text-emerald-900",
    helper: "The connecting lens — how ideas link across all sciences.",
  },
};

export function NgssDimensionPicker({
  open,
  onOpenChange,
  parentCodes,
  selected,
  onSave,
  title = "Focus on NGSS Sub-Components",
  description = "Pick specific Science Practices, Core Ideas, or Crosscutting Concepts to emphasize in the AI-generated lesson.",
}: Props) {
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selected));
  const [activeTab, setActiveTab] = useState<NgssDimensionType | "all">("all");

  // Refresh local state whenever the dialog opens
  const handleOpenChange = (next: boolean) => {
    if (next) setLocalSelected(new Set(selected));
    onOpenChange(next);
  };

  const groupedByPE = useMemo(() => {
    const result: { code: string; dimensions: NgssDimension[] }[] = [];
    for (const peCode of parentCodes) {
      const dims = NGSS_DIMENSIONS[peCode];
      if (dims?.length) {
        const filtered = activeTab === "all" ? dims : dims.filter(d => d.type === activeTab);
        if (filtered.length) result.push({ code: peCode, dimensions: filtered });
      }
    }
    return result;
  }, [parentCodes, activeTab]);

  const toggle = (code: string) => {
    const next = new Set(localSelected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setLocalSelected(next);
  };

  const selectAllForPE = (peCode: string) => {
    const dims = NGSS_DIMENSIONS[peCode] || [];
    const next = new Set(localSelected);
    dims.forEach(d => next.add(d.code));
    setLocalSelected(next);
  };

  const clearAllForPE = (peCode: string) => {
    const dims = NGSS_DIMENSIONS[peCode] || [];
    const next = new Set(localSelected);
    dims.forEach(d => next.delete(d.code));
    setLocalSelected(next);
  };

  const handleSave = () => {
    onSave(Array.from(localSelected));
    onOpenChange(false);
  };

  const totalAvailable = parentCodes.reduce((sum, c) => sum + (NGSS_DIMENSIONS[c]?.length || 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        {parentCodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Select at least one NGSS performance expectation first to drill into its sub-components.
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="SEP">SEP</TabsTrigger>
                <TabsTrigger value="DCI">DCI</TabsTrigger>
                <TabsTrigger value="CCC">CCC</TabsTrigger>
              </TabsList>
            </Tabs>

            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-4">
                {groupedByPE.map(({ code, dimensions }) => (
                  <div key={code} className="rounded-xl border border-card-foreground/10 bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{code}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => selectAllForPE(code)}>
                          All
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => clearAllForPE(code)}>
                          None
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {dimensions.map(dim => {
                        const meta = TYPE_META[dim.type];
                        const Icon = meta.icon;
                        return (
                          <label
                            key={dim.code}
                            className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer hover:bg-accent/40 transition ${meta.tint}`}
                          >
                            <Checkbox
                              checked={localSelected.has(dim.code)}
                              onCheckedChange={() => toggle(dim.code)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Icon className="h-3 w-3" />
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-background/60">
                                  {dim.type}
                                </Badge>
                                <span className="text-xs font-semibold">{dim.title}</span>
                              </div>
                              <p className="text-[11px] leading-snug mt-0.5 opacity-90">{dim.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {groupedByPE.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No sub-components match this filter.
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {localSelected.size} of {totalAvailable} sub-components selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLocalSelected(new Set())} className="rounded-xl" size="sm">
                  Clear all
                </Button>
                <Button onClick={handleSave} className="rounded-xl" size="sm">
                  Save selection
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
