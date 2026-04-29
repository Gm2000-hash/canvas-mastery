// Lets a teacher merge two student rows that represent the same human (e.g. the
// same student moved from middle-school Canvas to high-school Canvas and got a
// new canvas_user_id). Calls merge_student_records() which reassigns mastery,
// submissions, and question responses then soft-deletes the old row.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Combine, ArrowRight, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

type StudentRow = {
  id: string;
  display_name: string;
  real_name: string | null;
  course_name: string;
  school_year: string | null;
};

export default function MergeStudentsCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card id="merge-students">
      <CardHeader>
        <CardTitle>Link student records</CardTitle>
        <CardDescription>
          When a student you've taught before shows up under a new Canvas account (e.g. moving
          from middle school to high school), use this to merge the two records so all of their
          historical mastery data follows them. <strong>This is irreversible.</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Combine className="h-4 w-4 mr-2" />
              Merge two student records
            </Button>
          </DialogTrigger>
          <MergeDialog open={open} onClose={() => setOpen(false)} />
        </Dialog>
      </CardContent>
    </Card>
  );
}

function MergeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"pick-from" | "pick-to" | "confirm">("pick-from");
  const [from, setFrom] = useState<StudentRow | null>(null);
  const [to, setTo] = useState<StudentRow | null>(null);
  const [merging, setMerging] = useState(false);

  // Reset whenever dialog opens
  useEffect(() => {
    if (open) {
      setStep("pick-from");
      setFrom(null);
      setTo(null);
    }
  }, [open]);

  async function doMerge() {
    if (!from || !to) return;
    setMerging(true);
    const { data, error } = await supabase.rpc("merge_student_records", {
      _from: from.id,
      _to: to.id,
    });
    setMerging(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = (data as Array<{ reassigned_snapshots: number; reassigned_responses: number; reassigned_submissions: number }>)?.[0];
    toast.success(
      `Merged. Reassigned ${r?.reassigned_snapshots ?? 0} mastery scores, ${r?.reassigned_responses ?? 0} responses, ${r?.reassigned_submissions ?? 0} submissions.`,
    );
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Merge student records</DialogTitle>
        <DialogDescription>
          Step {step === "pick-from" ? 1 : step === "pick-to" ? 2 : 3} of 3.
          {step === "pick-from" && " Pick the OLDER record (its data will move into the new one)."}
          {step === "pick-to" && " Pick the CURRENT record (the canonical student going forward)."}
          {step === "confirm" && " Confirm the merge."}
        </DialogDescription>
      </DialogHeader>

      {step === "pick-from" && (
        <StudentSearch
          excludeId={null}
          onPick={(s) => { setFrom(s); setStep("pick-to"); }}
        />
      )}

      {step === "pick-to" && (
        <>
          <SelectedRow label="Old record" row={from} />
          <StudentSearch
            excludeId={from?.id ?? null}
            onPick={(s) => { setTo(s); setStep("confirm"); }}
          />
        </>
      )}

      {step === "confirm" && (
        <div className="space-y-3">
          <SelectedRow label="Old record (will be hidden)" row={from} />
          <div className="flex justify-center text-muted-foreground"><ArrowRight className="h-5 w-5" /></div>
          <SelectedRow label="Canonical record (everything moves here)" row={to} />
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <strong>This is irreversible.</strong> All mastery scores, submissions, and question responses
            from the old record will reassign to the canonical record. The old record stays in the database
            (hidden from views) for audit purposes.
          </div>
        </div>
      )}

      <DialogFooter>
        {step !== "pick-from" && (
          <Button variant="outline" onClick={() => setStep(step === "pick-to" ? "pick-from" : "pick-to")}>
            Back
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        {step === "confirm" && (
          <Button variant="destructive" onClick={doMerge} disabled={merging}>
            {merging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Merge records
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

function SelectedRow({ label, row }: { label: string; row: StudentRow | null }) {
  if (!row) return null;
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="font-medium">{row.real_name ?? row.display_name}</div>
      <div className="text-xs text-muted-foreground">
        {row.course_name}{row.school_year ? ` · ${row.school_year}` : ""}
      </div>
    </div>
  );
}

function StudentSearch({ excludeId, onPick }: { excludeId: string | null; onPick: (s: StudentRow) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    const { data, error } = await supabase.rpc("search_students_history", { _query: q });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const rows = ((data as any[]) ?? []).map((r) => ({
      id: r.student_id,
      display_name: r.display_name,
      real_name: r.real_name,
      course_name: r.course_name,
      school_year: r.school_year,
    })) as StudentRow[];
    setResults(rows.filter((r) => r.id !== excludeId));
  }

  useEffect(() => { search(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={search} disabled={loading}>Search</Button>
      </div>
      <div className="max-h-72 overflow-y-auto space-y-1">
        {results?.map((r) => (
          <button
            key={r.id}
            onClick={() => onPick(r)}
            className="w-full text-left rounded-md border p-2 text-sm hover:bg-muted transition-colors"
          >
            <div className="font-medium">{r.real_name ?? r.display_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>{r.course_name}</span>
              {r.school_year && <Badge variant="outline" className="text-[11px]">{r.school_year}</Badge>}
            </div>
          </button>
        ))}
        {results && results.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No results.</p>
        )}
      </div>
    </div>
  );
}
