// Post-backfill report — summarizes what landed in the database for a chosen
// set of courses and flags any district standards that didn't get any mastery
// data so the teacher can see tracking gaps at a glance.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";

export type BackfillReportRow = {
  course_id: string;
  course_name: string;
  school_year: string | null;
  subject: string | null;
  grade: string | null;
  framework: string | null;
  student_count: number;
  assignment_count: number;
  submission_count: number;
  question_response_count: number;
  mastery_record_count: number;
  district_standard_count: number;
  district_standards_with_mastery: number;
  district_standards_missing: number;
  missing_standard_codes: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseIds: string[];
};

export function BackfillReportDialog({ open, onOpenChange, courseIds }: Props) {
  const [rows, setRows] = useState<BackfillReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || courseIds.length === 0) return;
    setLoading(true);
    setRows(null);
    (async () => {
      const { data, error } = await supabase.rpc("analytics_backfill_report", {
        _course_ids: courseIds,
      });
      setLoading(false);
      if (error) {
        setRows([]);
        return;
      }
      setRows((data as BackfillReportRow[]) ?? []);
    })();
  }, [open, courseIds]);

  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      students: acc.students + r.student_count,
      assignments: acc.assignments + r.assignment_count,
      submissions: acc.submissions + r.submission_count,
      responses: acc.responses + r.question_response_count,
      mastery: acc.mastery + r.mastery_record_count,
      missing: acc.missing + r.district_standards_missing,
      district: acc.district + r.district_standard_count,
    }),
    { students: 0, assignments: 0, submissions: 0, responses: 0, mastery: 0, missing: 0, district: 0 },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Back-fill report
          </DialogTitle>
          <DialogDescription>
            Here's what landed for the courses you just back-filled, plus any district standards
            that don't yet have mastery data.
          </DialogDescription>
        </DialogHeader>

        {loading || rows === null ? (
          <div className="space-y-3 py-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No report available for these courses yet — try again in a moment.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Totals strip */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <SummaryStat label="Students" value={totals.students} />
              <SummaryStat label="Assignments" value={totals.assignments} />
              <SummaryStat label="Submissions" value={totals.submissions} />
              <SummaryStat label="Responses" value={totals.responses} />
              <SummaryStat label="Mastery records" value={totals.mastery} highlight />
            </div>

            {totals.district > 0 && (
              <div
                className={`rounded-md border p-3 text-sm flex items-start gap-2 ${
                  totals.missing > 0
                    ? "border-mastery-low/40 bg-mastery-low/5"
                    : "border-mastery-high/40 bg-mastery-high/5"
                }`}
              >
                {totals.missing > 0 ? (
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-mastery-low shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-mastery-high shrink-0" />
                )}
                <div>
                  <div className="font-medium">
                    {totals.missing > 0
                      ? `${totals.missing} district standard${totals.missing === 1 ? "" : "s"} have no mastery data yet`
                      : "Every tracked district standard has mastery data — nice."}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Across {rows.length} course{rows.length === 1 ? "" : "s"} · {totals.district} district standard{totals.district === 1 ? "" : "s"} compared
                  </div>
                </div>
              </div>
            )}

            {/* Per-course breakdown */}
            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {rows.map((r) => (
                <Card key={r.course_id}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.course_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                          {r.school_year && <Badge variant="outline" className="text-[9px]">{r.school_year}</Badge>}
                          {r.subject && <span>{r.subject}</span>}
                          {r.grade && <><span>·</span><span>Grade {r.grade}</span></>}
                          {r.framework && <Badge variant="outline" className="text-[9px]">{r.framework}</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                      <Stat label="Students" value={r.student_count} />
                      <Stat label="Assignments" value={r.assignment_count} />
                      <Stat label="Submissions" value={r.submission_count} />
                      <Stat label="Responses" value={r.question_response_count} />
                      <Stat label="Mastery" value={r.mastery_record_count} />
                    </div>

                    {r.district_standard_count > 0 && (
                      <div className="text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">District coverage:</span>
                          <span className="font-medium tabular-nums">
                            {r.district_standards_with_mastery} / {r.district_standard_count}
                          </span>
                          {r.district_standards_missing > 0 && (
                            <Badge variant="outline" className="text-[9px] gap-1 bg-mastery-low/10 text-mastery-low border-mastery-low/30">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {r.district_standards_missing} gap{r.district_standards_missing === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </div>
                        {r.missing_standard_codes.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {r.missing_standard_codes.map((code) => (
                              <span key={code} className="font-mono text-[10px] rounded bg-muted px-1.5 py-0.5">
                                {code}
                              </span>
                            ))}
                            {r.district_standards_missing > r.missing_standard_codes.length && (
                              <span className="text-[10px] text-muted-foreground self-center">
                                +{r.district_standards_missing - r.missing_standard_codes.length} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 text-center ${highlight ? "bg-accent/5 border-accent/30" : ""}`}>
      <div className="text-xl font-display font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
