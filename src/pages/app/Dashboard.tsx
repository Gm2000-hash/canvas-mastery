import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { GraduationCap, ListChecks, BookMarked, Sparkles, RefreshCw, AlertCircle, CalendarClock, CalendarCheck, ArrowRight } from "lucide-react";
import { useSync } from "@/contexts/SyncContext";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

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
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [upcoming, setUpcoming] = useState<AssignmentItem[] | null>(null);
  const [recent, setRecent] = useState<AssignmentItem[] | null>(null);
  const { syncing, runCanvasSync } = useSync();

  async function load() {
    const nowIso = new Date().toISOString();

    // Get visible (non-hidden, non-archived) course ids first so all stats reflect current rosters.
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
      { data: profile },
      { data: up },
      { data: rc },
    ] = await Promise.all([
      studentsQ,
      assignmentsQ,
      taggedQ,
      supabase.from("standards").select("id", { count: "exact", head: true }),
      supabase.rpc("get_canvas_connection_status"),
      supabase.from("profiles").select("state, default_subject, default_grade").maybeSingle(),
      // Upcoming: due in the future, soonest first.
      supabase
        .from("assignments")
        .select("id, name, kind, due_at, course_id, course:courses!inner(name, hidden, archived_at)")
        .gte("due_at", nowIso)
        .order("due_at", { ascending: true })
        .limit(20),
      // Recent: due in the past, most recent first.
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
    setProfileReady(!!(profile?.state && profile?.default_subject && profile?.default_grade));
    // Drop assignments whose course has been hidden, then keep top 5 of each.
    const filterVisible = (rows: any[] | null) =>
      ((rows ?? []) as AssignmentItem[]).filter((a) => a.course && !a.course.hidden && !a.course.archived_at).slice(0, 5);
    setUpcoming(filterVisible(up));
    setRecent(filterVisible(rc));
  }

  useEffect(() => {
    load();
    const onDone = () => load();
    window.addEventListener("canvas-sync:done", onDone);
    return () => window.removeEventListener("canvas-sync:done", onDone);
  }, []);

  async function syncNow() {
    await runCanvasSync();
  }

  const needsSetup = canvasConnected === false || profileReady === false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">An at-a-glance look at your classes and standards coverage.</p>
      </div>

      <OnboardingChecklist onChange={load} />

      {needsSetup && (
        <Card className="border-accent/40 bg-accent/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-accent" />
              <CardTitle className="text-lg">Finish setup</CardTitle>
            </div>
            <CardDescription>You're a few steps away from tracking mastery.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {profileReady === false && (
              <Link to="/app/settings#profile"><Button>Set state, subject & grade</Button></Link>
            )}
            {canvasConnected === false && (
              <Link to="/app/settings#canvas"><Button variant="outline">Connect Canvas</Button></Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Courses" value={stats.courses} />
        <StatCard icon={ListChecks} label="Assignments" value={stats.assignments} />
        <StatCard icon={Sparkles} label="Tagged (confirmed)" value={stats.taggedAssignments} />
        <StatCard icon={BookMarked} label="Standards" value={stats.standards} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sync with Canvas</CardTitle>
            <CardDescription>Pulls the latest courses, students, assignments and scores.</CardDescription>
          </div>
          <Button onClick={syncNow} disabled={syncing || !canvasConnected}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AssignmentsList
          title="Upcoming assessments"
          description="Due next, soonest first."
          icon={CalendarClock}
          items={upcoming}
          emptyMessage="Nothing on the calendar yet."
          mode="upcoming"
        />
        <AssignmentsList
          title="Recent assessments"
          description="Most recently due."
          icon={CalendarCheck}
          items={recent}
          emptyMessage="No past assessments yet."
          mode="recent"
        />
      </div>

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

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Icon className="h-5 w-5 text-accent mb-3" />
        <div className="text-2xl sm:text-3xl font-display font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function AssignmentsList({
  title,
  description,
  icon: Icon,
  items,
  emptyMessage,
  mode,
}: {
  title: string;
  description: string;
  icon: any;
  items: AssignmentItem[] | null;
  emptyMessage: string;
  mode: "upcoming" | "recent";
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-accent" />
              <CardTitle>{title}</CardTitle>
            </div>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Link to="/app/assignments">
            <Button variant="ghost" size="sm" className="h-8 -mr-2">
              All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items === null ? (
          <div className="text-sm text-muted-foreground py-4">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">{emptyMessage}</div>
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/app/assignments?course=${a.course_id}`}
                    className="text-sm font-medium truncate block hover:underline"
                  >
                    {a.name}
                  </Link>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
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
      </CardContent>
    </Card>
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
