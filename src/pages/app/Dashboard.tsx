import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { GraduationCap, ListChecks, BookMarked, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const [stats, setStats] = useState({ courses: 0, students: 0, assignments: 0, taggedAssignments: 0, standards: 0 });
  const [canvasConnected, setCanvasConnected] = useState<boolean | null>(null);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const [{ count: courses }, { count: students }, { count: assignments }, { count: tagged }, { count: standards }, { data: ccRows }, { data: profile }] = await Promise.all([
      supabase.from("courses").select("id", { count: "exact", head: true }),
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("assignments").select("id", { count: "exact", head: true }),
      supabase.from("assignment_standards").select("assignment_id", { count: "exact", head: true }).eq("confirmed", true),
      supabase.from("standards").select("id", { count: "exact", head: true }),
      supabase.rpc("get_canvas_connection_status"),
      supabase.from("profiles").select("state, default_subject, default_grade").maybeSingle(),
    ]);
    setStats({
      courses: courses ?? 0,
      students: students ?? 0,
      assignments: assignments ?? 0,
      taggedAssignments: tagged ?? 0,
      standards: standards ?? 0,
    });
    const cc = Array.isArray(ccRows) ? ccRows[0] : null;
    setCanvasConnected(!!cc?.connected);
    setProfileReady(!!(profile?.state && profile?.default_subject && profile?.default_grade));
  }

  useEffect(() => { load(); }, []);

  async function syncNow() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("canvas-sync");
    setSyncing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Synced: ${data.stats.courses} courses, ${data.stats.students} students, ${data.stats.assignments} assignments`);
    load();
  }

  const needsSetup = canvasConnected === false || profileReady === false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">An at-a-glance look at your classes and standards coverage.</p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
          <CardDescription>Recommended workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Step n={1} done={profileReady === true}>Set your state, subject and grade in Settings.</Step>
          <Step n={2} done={canvasConnected === true}>Connect your Canvas API token.</Step>
          <Step n={3} done={stats.courses > 0}>Sync to import your courses & students.</Step>
          <Step n={4} done={stats.standards > 0}>Seed your state standards (Settings → Standards).</Step>
          <Step n={5} done={stats.taggedAssignments > 0}>Tag assignments with standards (AI suggests, you confirm).</Step>
          <Step n={6} done={false}>View student-level mastery in the Mastery tab.</Step>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Icon className="h-5 w-5 text-accent mb-3" />
        <div className="text-3xl font-display font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function Step({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-6 w-6 rounded-full text-xs flex items-center justify-center font-medium ${
        done ? "bg-mastery-high text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}>{done ? "✓" : n}</div>
      <span className={done ? "text-muted-foreground line-through" : ""}>{children}</span>
    </div>
  );
}
