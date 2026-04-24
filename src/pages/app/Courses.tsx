import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type CourseRow = {
  id: string; name: string; course_code: string | null; term: string | null; last_synced_at: string | null;
  studentCount: number; assignmentCount: number;
};

export default function Courses() {
  const [rows, setRows] = useState<CourseRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: courses } = await supabase
        .from("courses").select("id, name, course_code, term, last_synced_at").order("name");
      const out: CourseRow[] = [];
      for (const c of courses ?? []) {
        const [{ count: sc }, { count: ac }] = await Promise.all([
          supabase.from("students").select("id", { count: "exact", head: true }).eq("course_id", c.id),
          supabase.from("assignments").select("id", { count: "exact", head: true }).eq("course_id", c.id),
        ]);
        out.push({ ...c, studentCount: sc ?? 0, assignmentCount: ac ?? 0 });
      }
      setRows(out);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold mb-2">Courses</h1>
        <p className="text-muted-foreground">Synced from Canvas. Use the dashboard to re-sync.</p>
      </div>

      {rows === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <CardTitle className="font-display text-xl mb-2">No courses yet</CardTitle>
            <CardDescription className="mb-4">Connect Canvas and run a sync to see your courses.</CardDescription>
            <Link to="/app/settings#canvas"><Button>Set up Canvas</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="font-display text-xl">{c.name}</CardTitle>
                <CardDescription>{c.course_code ?? "—"} {c.term ? `· ${c.term}` : ""}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <div className="flex gap-6">
                  <div><div className="text-2xl font-display font-semibold tabular-nums">{c.studentCount}</div><div className="text-xs text-muted-foreground">students</div></div>
                  <div><div className="text-2xl font-display font-semibold tabular-nums">{c.assignmentCount}</div><div className="text-xs text-muted-foreground">assignments</div></div>
                </div>
                <Link to={`/app/assignments?course=${c.id}`}>
                  <Button variant="ghost" size="sm">Assignments <ExternalLink className="h-3 w-3 ml-1" /></Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
