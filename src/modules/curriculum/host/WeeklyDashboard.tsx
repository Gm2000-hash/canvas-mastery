import { CalendarDays } from "lucide-react";

export function WeeklyDashboard() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">This week</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {days.map((d) => (
          <div key={d} className="rounded-lg bg-muted px-2 py-3 text-center text-xs text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}
