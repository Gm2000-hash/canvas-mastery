// Toggle that lets a teacher widen any "current roster" view to include
// archived (completed school year) courses/students. Logs each open to
// historical_access_log so the audit trail captures when archived data is
// surfaced — same audit pattern as identity_reveals.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Archive } from "lucide-react";

type Props = {
  value: boolean;
  onChange: (v: boolean) => void;
  reason: string; // short label of where the toggle is being used (e.g. "Mastery", "Analytics", "Student history")
};

export function HistoricalToggle({ value, onChange, reason }: Props) {
  const [archivedCount, setArchivedCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .not("archived_at", "is", null)
      .then(({ count }) => {
        if (!cancelled) setArchivedCount(count ?? 0);
      });
    return () => { cancelled = true; };
  }, []);

  async function handleChange(next: boolean) {
    onChange(next);
    if (next) {
      // Audit: log the opening of historical scope
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("historical_access_log").insert({
          teacher_id: u.user.id,
          reason: `${reason}: opened historical scope`,
        });
      }
    }
  }

  if (archivedCount === 0) return null; // nothing archived yet — don't clutter the UI

  return (
    <div className="flex items-center gap-2">
      <Switch id="show-historical" checked={value} onCheckedChange={handleChange} />
      <Label htmlFor="show-historical" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5">
        <Archive className="h-3.5 w-3.5" />
        Show historical
        {archivedCount != null && archivedCount > 0 && (
          <span className="text-xs">({archivedCount} archived)</span>
        )}
      </Label>
    </div>
  );
}
