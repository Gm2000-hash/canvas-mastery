import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Puzzle, Plus } from "lucide-react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "@/modules/curriculum/config/auth";
import { ACTIVITY_TYPES } from "@/modules/curriculum/lib/h5p-types";

export interface EmbeddedActivity {
  id: string;
  title: string;
  activity_type: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (activity: EmbeddedActivity) => void;
  excludeIds?: string[];
}

export function EmbedActivityPicker({ open, onOpenChange, onSelect, excludeIds = [] }: Props) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<EmbeddedActivity[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("h5p_activities")
      .select("id, title, activity_type")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setActivities((data as EmbeddedActivity[]) || []);
        setLoading(false);
      });
  }, [open, user]);

  const filtered = activities
    .filter(a => !excludeIds.includes(a.id))
    .filter(a => !search || a.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-primary" /> Embed Activity
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {activities.length === 0 ? "No activities yet. Create one in the Activity Builder first." : "No matching activities."}
            </p>
          ) : filtered.map(a => {
            const typeInfo = ACTIVITY_TYPES.find(t => t.type === a.activity_type);
            return (
              <button
                key={a.id}
                onClick={() => { onSelect(a); onOpenChange(false); }}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Puzzle className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">{typeInfo?.label ?? a.activity_type}</Badge>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
