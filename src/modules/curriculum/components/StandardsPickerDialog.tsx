import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Atom, Leaf, Globe, Check } from "lucide-react";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";

interface StandardsPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStandards: Set<string>;
  onSelectionChange: (standards: Set<string>) => void;
}

const DISCIPLINES = [
  { id: "physical", label: "Physical Science", icon: Atom, groups: ["MS-PS1", "MS-PS2", "MS-PS3", "MS-PS4"], color: "text-blue-600", bgColor: "bg-blue-50" },
  { id: "life", label: "Life Science", icon: Leaf, groups: ["MS-LS1", "MS-LS2", "MS-LS3", "MS-LS4"], color: "text-green-600", bgColor: "bg-green-50" },
  { id: "earth", label: "Earth & Space Science", icon: Globe, groups: ["MS-ESS1", "MS-ESS2", "MS-ESS3"], color: "text-amber-600", bgColor: "bg-amber-50" },
];

export function StandardsPickerDialog({ open, onOpenChange, selectedStandards, onSelectionChange }: StandardsPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selectedStandards));

  // Sync when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setLocalSelected(new Set(selectedStandards));
    onOpenChange(v);
  };

  const allStandards = useMemo(() =>
    Object.entries(ALL_SUBSTANDARDS).flatMap(([group, subs]) =>
      subs.map(s => ({ ...s, group }))
    ), []
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return allStandards;
    const q = search.toLowerCase();
    return allStandards.filter(s =>
      s.code.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q)
    );
  }, [allStandards, search]);

  const toggleStandard = (code: string) => {
    const next = new Set(localSelected);
    if (next.has(code)) next.delete(code); else next.add(code);
    setLocalSelected(next);
  };

  const toggleGroup = (group: string) => {
    const codes = (ALL_SUBSTANDARDS[group] || []).map(s => s.code);
    const next = new Set(localSelected);
    const allSelected = codes.every(c => next.has(c));
    codes.forEach(c => allSelected ? next.delete(c) : next.add(c));
    setLocalSelected(next);
  };

  const toggleDiscipline = (disc: typeof DISCIPLINES[number]) => {
    const codes = disc.groups.flatMap(g => (ALL_SUBSTANDARDS[g] || []).map(s => s.code));
    const next = new Set(localSelected);
    const allSelected = codes.every(c => next.has(c));
    codes.forEach(c => allSelected ? next.delete(c) : next.add(c));
    setLocalSelected(next);
  };

  const selectAll = () => {
    const all = new Set<string>();
    allStandards.forEach(s => all.add(s.code));
    setLocalSelected(all);
  };

  const clearAll = () => setLocalSelected(new Set());

  const handleConfirm = () => {
    onSelectionChange(localSelected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Select Standards</DialogTitle>
          <DialogDescription>
            Choose NGSS standards to include in the exam. Use search to find specific standards.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 pb-3 space-y-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search standards by code, description, or discipline..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {DISCIPLINES.map(disc => {
                const Icon = disc.icon;
                const codes = disc.groups.flatMap(g => (ALL_SUBSTANDARDS[g] || []).map(s => s.code));
                const count = codes.filter(c => localSelected.has(c)).length;
                return (
                  <Button
                    key={disc.id}
                    variant={count > 0 ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => toggleDiscipline(disc)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {disc.label} {count > 0 && `(${count})`}
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{localSelected.size} selected</Badge>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>All</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>Clear</Button>
            </div>
          </div>
        </div>

        {/* Standards list */}
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-1 py-3">
            {DISCIPLINES.map(disc => {
              const discStandards = disc.groups.flatMap(g =>
                (ALL_SUBSTANDARDS[g] || []).map(s => ({ ...s, group: g }))
              ).filter(s => {
                if (!search.trim()) return true;
                const q = search.toLowerCase();
                return s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.group.toLowerCase().includes(q);
              });

              if (discStandards.length === 0) return null;

              const Icon = disc.icon;
              const discCodes = discStandards.map(s => s.code);
              const allDiscSelected = discCodes.every(c => localSelected.has(c));
              const someDiscSelected = discCodes.some(c => localSelected.has(c));

              return (
                <div key={disc.id} className="mb-4">
                  {/* Discipline header */}
                  <div
                    className={`flex items-center gap-2 p-2.5 rounded-lg ${disc.bgColor} cursor-pointer mb-1`}
                    onClick={() => toggleDiscipline(disc)}
                  >
                    <Checkbox
                      checked={allDiscSelected}
                      className={someDiscSelected && !allDiscSelected ? "data-[state=unchecked]:bg-primary/30 data-[state=unchecked]:border-primary" : ""}
                      onCheckedChange={() => toggleDiscipline(disc)}
                    />
                    <Icon className={`h-4 w-4 ${disc.color}`} />
                    <span className="text-sm font-semibold flex-1">{disc.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {discCodes.filter(c => localSelected.has(c)).length}/{discCodes.length}
                    </span>
                  </div>

                  {/* Groups */}
                  {disc.groups.map(group => {
                    const subs = (ALL_SUBSTANDARDS[group] || []).filter(s => {
                      if (!search.trim()) return true;
                      const q = search.toLowerCase();
                      return s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || group.toLowerCase().includes(q);
                    });
                    if (subs.length === 0) return null;
                    const groupCodes = subs.map(s => s.code);
                    const allGroupSelected = groupCodes.every(c => localSelected.has(c));
                    const someGroupSelected = groupCodes.some(c => localSelected.has(c));

                    return (
                      <div key={group} className="ml-3 mb-2">
                        <div
                          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleGroup(group)}
                        >
                          <Checkbox
                            checked={allGroupSelected}
                            className={someGroupSelected && !allGroupSelected ? "data-[state=unchecked]:bg-primary/30 data-[state=unchecked]:border-primary" : ""}
                            onCheckedChange={() => toggleGroup(group)}
                          />
                          <span className="text-sm font-medium">{group}</span>
                          <span className="text-xs text-muted-foreground">
                            ({groupCodes.filter(c => localSelected.has(c)).length}/{subs.length})
                          </span>
                        </div>
                        <div className="ml-6 space-y-0.5">
                          {subs.map(sub => (
                            <div
                              key={sub.code}
                              className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-muted/30 cursor-pointer"
                              onClick={() => toggleStandard(sub.code)}
                            >
                              <Checkbox
                                checked={localSelected.has(sub.code)}
                                onCheckedChange={() => toggleStandard(sub.code)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-mono font-semibold text-primary">{sub.code}</span>
                                <p className="text-xs text-muted-foreground leading-snug">{sub.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {localSelected.size} standard{localSelected.size !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} className="gap-1.5">
              <Check className="h-4 w-4" />
              Confirm Selection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
