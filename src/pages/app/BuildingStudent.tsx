// Principal drill-down: one student's mastery history across every course at the school.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { RevealNamesToggle } from "@/components/RevealNamesToggle";
import { toast } from "sonner";

type Row = {
  school_year: string; course_id: string; course_name: string; teacher_name: string; subject: string | null; grade: string | null;
  standard_id: string; standard_code: string; standard_description: string; mastery_score: number; mastered: boolean; attempts: number; last_assessed: string;
};

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(Number(v) * 100)}%`);

export default function BuildingStudent() {
  const { studentId } = useParams<{ studentId: string }>();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [label, setLabel] = useState<string>("Student");
  const [realName, setRealName] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const [{ data, error }, { data: br }] = await Promise.all([
        (supabase as any).rpc("building_student_history", { _student_id: studentId }),
        (supabase as any).rpc("building_breakdown", { _dims: ["student"], _student_search: null }),
      ]);
      if (error) toast.error(error.message);
      setRows((data as Row[]) ?? []);
      const me = (br ?? []).find((r: any) => r.key1 === studentId);
      if (me) setLabel(me.label1);
    })();
  }, [studentId]);

  const byCourse = useMemo(() => {
    const m = new Map<string, { name: string; teacher: string; year: string; subject: string | null; grade: string | null; rows: Row[] }>();
    for (const r of rows ?? []) {
      const g = m.get(r.course_id) ?? { name: r.course_name, teacher: r.teacher_name, year: r.school_year, subject: r.subject, grade: r.grade, rows: [] };
      g.rows.push(r); m.set(r.course_id, g);
    }
    return [...m.entries()];
  }, [rows]);

  const overall = useMemo(() => {
    const r = rows ?? [];
    if (!r.length) return null;
    return { avg: r.reduce((a, x) => a + Number(x.mastery_score), 0) / r.length, mastered: r.filter((x) => x.mastered).length, total: r.length };
  }, [rows]);

  async function reveal(pin: string, reason?: string) {
    setRevealing(true);
    const { data, error } = await (supabase as any).rpc("reveal_building_identities", { _student_ids: [studentId], _pin: pin, _reason: reason ?? null });
    setRevealing(false);
    if (error) { toast.error(error.message.includes("PIN_INVALID") ? "Incorrect PIN." : error.message); return false; }
    setRealName(data?.[0]?.real_name ?? null);
    if (!data?.length) toast.info("No identity record for this student.");
    return true;
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/app/building"><ArrowLeft className="h-4 w-4 mr-1" /> Building analytics</Link></Button>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-accent mb-2">Student history</div>
          <h1 className="font-display text-3xl text-primary">{realName ?? label}</h1>
          {overall && <p className="text-muted-foreground mt-1">Avg mastery {pct(overall.avg)} · {overall.mastered}/{overall.total} standards mastered across {byCourse.length} course{byCourse.length === 1 ? "" : "s"}</p>}
        </div>
        <RevealNamesToggle revealed={!!realName} loading={revealing} onReveal={reveal} onHide={() => setRealName(null)} />
      </header>

      {!rows ? <Skeleton className="h-40" /> : byCourse.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No mastery data for this student yet.</CardContent></Card>
      ) : byCourse.map(([courseId, c]) => (
        <Card key={courseId}>
          <CardHeader>
            <CardTitle className="text-lg">{c.name}</CardTitle>
            <CardDescription>{c.teacher} · {c.subject ?? "—"}{c.grade ? ` · Grade ${c.grade}` : ""} · {c.year}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Standard</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Mastery</TableHead><TableHead className="text-right">Last assessed</TableHead></TableRow></TableHeader>
              <TableBody>
                {c.rows.map((r) => (
                  <TableRow key={r.standard_id}>
                    <TableCell className="font-code text-xs">{r.standard_code}</TableCell>
                    <TableCell className="text-sm max-w-md truncate" title={r.standard_description}>{r.standard_description}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.attempts}</TableCell>
                    <TableCell className="text-right"><Badge variant={r.mastered ? "default" : "outline"}>{pct(r.mastery_score)}</Badge></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(r.last_assessed).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
