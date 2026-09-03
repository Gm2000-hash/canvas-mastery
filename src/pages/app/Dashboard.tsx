import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { GraduationCap, ListChecks, BookMarked, Sparkles, RefreshCw, CalendarClock, CalendarCheck, ArrowRight } from "lucide-react";
import { useSync } from "@/contexts/SyncContext";
import { useProfile } from "@/contexts/ProfileContext";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { cn } from "@/lib/utils";

type AssignmentItem = {
  id: string;
  name: string;
  kind: string;
  due_at: string | null;
  course_id: string;
  course: { name: string; hidden: boolean; archived_at: string | null } | null;
};

export default function Dashboard() {
  const [stats, setStats] = useState({ courses: 0, students: 0, assignments: 0, taggedAssignments: 0, standards: 0 });
  const [canvasConnected, setCanvasConnected] = useState<boolean | null>(null);
  const [upcoming, setUpcoming] = useState<AssignmentItem[] | null>(null);
  const [recent, setRecent] = useState<AssignmentItem[] | null>(null);
  const { syncing, runCanvasSync } = useSync();
  const { preferredName } = useProfile();

  async function load() {
    const nowIso = new Date().toISOString();

    const { data: visibleCourses } = await supabase
      .from("courses").select("id").eq("hidden", false).is("archived_at", null);
    const visibleIds = (visibleCourses ?? []).map((c) => c.id);
    const hasVisible = visibleIds.length > 0;

    const studentsQ = hasVisible
      ? supabase.from("students").select("id", { count: "exact", head: true }).in("course_id", visibleIds).is("archived_at", null).is("merged_into", null)
      : Promise.resolve({ count: 0 } as any);
    const assignmentsQ = hasVisible
      ? supabase.from("assignments").select("id", { count: "exact", head: true }).in("course_id", visibleIds)
      : Promise.resolve({ count: 0 } as any);
    const taggedQ = hasVisible
      ? supabase
          .from("assignment_standards")
          .select("assignment_id, assignments!inner(course_id)", { count: "exact", head: true })
          .eq("confirmed", true)
          .in("assignments.course_id", visibleIds)
      : Promise.resolve({ count: 0 } as any);

    const [
      { count: students },
      { count: assignments },
      { count: tagged },
      { count: standards },
      { data: ccRows },
      { data: up },
      { data: rc },
    ] = await Promise.all([
      studentsQ,
      assignmentsQ,
      taggedQ,
      supabase.from("standards").select("id", { count: "exact", head: true }),
      supabase.rpc("get_canvas_connection_status"),
      supabase
        .from("assignments")
        .select("id, name, kind, due_at, course_id, course:courses!inner(name, hidden, archived_at)")
        .gte("due_at", nowIso)
        .order("due_at", { ascending: true })
        .limit(20),
      supabase
        .from("assignments")
        .select("id, name, kind, due_at, course_id, course:courses!inner(name, hidden, archived_at)")
        .lt("due_at", nowIso)
        .order("due_at", { ascending: false })
        .limit(20),
    ]);
    setStats({
      courses: visibleIds.length,
      students: students ?? 0,
      assignments: assignments ?? 0,
      taggedAssignments: tagged ?? 0,
      standards: standards ?? 0,
    });
    const cc = Array.isArray(ccRows) ? ccRows[0] : null;
    setCanvasConnected(!!cc?.connected);

    const filterVisible = (rows: any[] | null) =>
      ((rows ?? []) as AssignmentItem[]).filter((a) => a.course && !a.course.hidden && !a.course.archived_at).slice(0, 5);
    setUpcoming(filterVisible(up));
    setRecent(filterVisible(rc));
  }

  useEffect(() => {
    load();
    const onDone = () => load();
    const onFocus = () => load();
    window.addEventListener("canvas-sync:done", onDone);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("canvas-sync:done", onDone);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="space-y-12">
      {/* Editorial header */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-accent mb-3">
            Your classroom, at a glance
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-primary leading-[0.98] tracking-tight">
            {preferredName ? <>Welcome back,<br />{preferredName}.</> : <>Welcome back.</>}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-md">
            Here's how your students are progressing across every standard you teach.
          </p>
        </div>
        <button
          type="button"
          onClick={() => runCanvasSync()}
          disabled={syncing || !canvasConnected}
          className={cn(
            "inline-flex items-center gap-2 self-start sm:self-end rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-soft transition-colors",
            "hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={canvasConnected ? "Sync from Canvas" : "Connect Canvas in Settings to sync"}
        >
          <RefreshCw className={cn("h-4 w-4 text-accent", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : canvasConnected ? "Sync now" : "Canvas not connected"}
        </button>
      </header>

      {/* Onboarding (auto-hides when complete) */}
      <OnboardingChecklist onChange={load} />

      {/* Stat tiles */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={GraduationCap} label="Courses" value={stats.courses} />
          <StatTile icon={ListChecks} label="Assignments" value={stats.assignments} />
          <StatTile icon={Sparkles} label="Tagged (confirmed)" value={stats.taggedAssignments} />
          <StatTile icon={BookMarked} label="Standards" value={stats.standards} />
        </div>
      </section>

      {/* Assignments */}
      <section className="grid gap-6 lg:grid-cols-2">
        <AssignmentsList
          eyebrow="What's next"
          title="Upcoming assessments"
          icon={CalendarClock}
          items={upcoming}
          emptyMessage="Nothing on the calendar yet."
          mode="upcoming"
        />
        <AssignmentsList
          eyebrow="Just past"
          title="Recent assignments"
          icon={CalendarCheck}
          items={recent}
          emptyMessage="No past assessments yet."
          mode="recent"
        />
      </section>

      <div className="pt-2 text-center">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          onClick={async () => {
            const { data: u } = await supabase.auth.getUser();
            if (!u.user) return;
            await supabase.from("profiles")
              .update({ onboarding_dismissed_at: null })
              .eq("id", u.user.id);
            window.dispatchEvent(new Event("onboarding:refresh"));
          }}
        >
          Show getting started checklist
        </button>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="group relative bg-card rounded-2xl p-6 shadow-soft overflow-hidden transition-all hover:shadow-card">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-accent scale-x-0 group-hover:scale-x-100 origin-left transition-transform" />
      <Icon className="h-5 w-5 text-accent mb-4" />
      <div className="text-3xl sm:text-4xl font-display font-semibold tabular-nums text-primary leading-none">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-2 uppercase tracking-wider font-medium">{label}</div>
    </div>
  );
}

function AssignmentsList({
  eyebrow,
  title,
  icon: Icon,
  items,
  emptyMessage,
  mode,
}: {
  eyebrow: string;
  title: string;
  icon: any;
  items: AssignmentItem[] | null;
  emptyMessage: string;
  mode: "upcoming" | "recent";
}) {
  return (
    <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-soft">
      <div className="flex items-start justify-between gap-2 mb-5">
        <div>
          <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-accent mb-2">
            {eyebrow}
          </div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl text-primary">{title}</h2>
          </div>
        </div>
        <Link to="/app/classes">
          <Button variant="ghost" size="sm" className="h-8 -mr-2 rounded-full">
            All <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
      {items === null ? (
        <div className="text-sm text-muted-foreground py-4">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">{emptyMessage}</div>
      ) : (
        <ul className="divide-y">
          {items.map((a) => (
            <li key={a.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/app/classes/${a.course_id}/assignments`}
                  className="text-sm font-medium truncate block hover:underline"
                >
                  {a.name}
                </Link>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                  <span className="truncate">{a.course?.name ?? "—"}</span>
                  {a.kind === "quiz" && <Badge variant="outline" className="text-[11px] py-0 h-4">quiz</Badge>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums shrink-0 text-right">
                {formatDue(a.due_at, mode)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDue(due: string | null, mode: "upcoming" | "recent"): string {
  if (!due) return "—";
  const d = new Date(due);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const dayMs = 86400000;
  const days = Math.round(diffMs / dayMs);
  const datePart = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (mode === "upcoming") {
    if (days <= 0) return `Today · ${datePart}`;
    if (days === 1) return `Tomorrow · ${datePart}`;
    if (days < 7) return `In ${days}d · ${datePart}`;
    return datePart;
  }
  const ago = Math.abs(days);
  if (ago === 0) return `Today · ${datePart}`;
  if (ago === 1) return `Yesterday · ${datePart}`;
  if (ago < 7) return `${ago}d ago · ${datePart}`;
  return datePart;
}
