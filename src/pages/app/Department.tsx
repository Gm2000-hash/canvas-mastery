// Department landing page — lists subjects the teacher participates in
// (derived from teacher_disciplines) with summary counts of peers, classes,
// and students for the current school year.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Atom, Beaker, BookOpen, Calculator, Globe2, Users, Loader2, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { currentSchoolYearLabel } from "@/lib/schoolYear";
import { SUBJECTS } from "@/lib/frameworks";

type Row = {
  subject: string;
  grades: string[] | null;
  teacher_count: number;
  class_count: number;
  student_count: number;
};

const ICONS: Record<string, any> = {
  Science: Beaker,
  "Social Studies": Globe2,
  Math: Calculator,
  ELA: BookOpen,
};

const FEATURED = ["Science", "Social Studies", "Math", "ELA"];

export default function Department() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const year = currentSchoolYearLabel();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("department_subjects", { _school_year: year });
      if (!error) setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [year]);

  const byKey = new Map(rows.map((r) => [r.subject, r]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Department</h1>
        <p className="text-muted-foreground mt-1">
          See data collectively across all teachers who teach the same subject and grade.
          You see real names only for your own students; peers' students appear with safe pseudonyms.
        </p>
        <p className="text-xs text-muted-foreground mt-2">School year: {year}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {FEATURED.map((subject) => {
          const r = byKey.get(subject);
          const Icon = ICONS[subject] ?? Atom;
          const enabled = !!r;
          return (
            <Card key={subject} className={enabled ? "" : "opacity-60"}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="rounded-full bg-primary/10 text-primary p-3">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl">{subject}</CardTitle>
                  <CardDescription>
                    {enabled
                      ? `${r!.grades?.join(", ") || "—"} · ${r!.teacher_count} ${r!.teacher_count === 1 ? "teacher" : "teachers"}`
                      : "Not in your disciplines yet"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : enabled ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Stat label="Teachers" value={r!.teacher_count} />
                      <Stat label="Classes" value={r!.class_count} />
                      <Stat label="Students" value={r!.student_count} />
                    </div>
                    <Button asChild className="w-full rounded-full">
                      <Link to={`/app/department/${encodeURIComponent(subject)}`}>
                        Open department <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add this subject in <Link to="/app/settings" className="text-primary underline">Settings → Disciplines</Link> to join the department.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Other subjects (Health/PE, etc.) where the teacher has a discipline */}
      {rows.filter((r) => !FEATURED.includes(r.subject)).length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Other subjects</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.filter((r) => !FEATURED.includes(r.subject)).map((r) => (
              <Card key={r.subject}>
                <CardHeader>
                  <CardTitle className="text-base">{r.subject}</CardTitle>
                  <CardDescription>{r.grades?.join(", ")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      <Users className="inline h-3.5 w-3.5 mr-1" />
                      {r.teacher_count} · {r.class_count} classes · {r.student_count} students
                    </span>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/app/department/${encodeURIComponent(r.subject)}`}>Open</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 py-2">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
