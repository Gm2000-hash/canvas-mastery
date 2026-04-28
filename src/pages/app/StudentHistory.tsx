// Student History — search every student you've ever taught (active or archived)
// and view their longitudinal mastery record across school years. Surfacing an
// archived student logs an entry to historical_access_log for the audit trail.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Archive, Calendar, ChevronRight, History } from "lucide-react";
import { toast } from "sonner";

type SearchHit = {
  student_id: string;
  display_name: string;
  real_name: string | null;
  course_id: string;
  course_name: string;
  course_archived: boolean;
  school_year: string | null;
  last_activity: string | null;
};

type HistoryRow = {
  school_year: string | null;
  course_id: string;
  course_name: string;
  course_archived: boolean;
  framework: string;
  subject: string;
  grade: string;
  standard_id: string;
  standard_code: string;
  standard_description: string;
  mastery_score: number | null;
  mastered: boolean | null;
  attempts: number | null;
  last_assessed: string | null;
};

export default function StudentHistory() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function runSearch(q: string) {
    setSearching(true);
    setSelected(null);
    setHistory(null);
    const { data, error } = await supabase.rpc("search_students_history", { _query: q });
    setSearching(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHits((data as SearchHit[]) ?? []);
  }

  useEffect(() => {
    // Initial load: show every student you've ever taught (most recent first)
    runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openStudent(hit: SearchHit) {
    setSelected(hit);
    setLoadingHistory(true);
    setHistory(null);
    const { data, error } = await supabase.rpc("analytics_student_history", { _student_id: hit.student_id });
    setLoadingHistory(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data as HistoryRow[]) ?? [];
    setHistory(rows);

    // Audit: log archived-record access
    if (hit.course_archived) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("historical_access_log").insert({
          teacher_id: u.user.id,
          course_id: hit.course_id,
          student_ids: [hit.student_id],
          reason: `Student history opened for ${hit.display_name}`,
        });
      }
    }
  }

  const groupedHistory = useMemo(() => {
    if (!history) return [];
    type Group = {
      key: string;
      school_year: string | null;
      course_name: string;
      framework: string;
      subject: string;
      grade: string;
      archived: boolean;
      rows: HistoryRow[];
    };
    const map = new Map<string, Group>();
    for (const r of history) {
      const key = `${r.school_year ?? "?"}|${r.course_id}|${r.framework}|${r.subject}|${r.grade}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          school_year: r.school_year,
          course_name: r.course_name,
          framework: r.framework,
          subject: r.subject,
          grade: r.grade,
          archived: r.course_archived,
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => {
      // Newest school year first, fallback to course name
      const ay = a.school_year ?? "";
      const by = b.school_year ?? "";
      if (ay !== by) return by.localeCompare(ay);
      return a.course_name.localeCompare(b.course_name);
    });
  }, [history]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold mb-2 flex items-center gap-3">
          <History className="h-8 w-8" /> Student history
        </h1>
        <p className="text-muted-foreground">
          Search every student you've ever taught — current rosters and archived classes alike.
          Mastery scores, standards tagged, and assessment activity stay tied to each student forever.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by pseudonym or revealed name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(query); }}
            className="pl-9"
          />
        </div>
        <Button onClick={() => runSearch(query)} disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_2fr] gap-6">
        {/* RESULTS LIST */}
        <Card className="h-fit max-h-[calc(100vh-12rem)] overflow-hidden flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {hits == null ? "…" : `${hits.length} student${hits.length === 1 ? "" : "s"}`}
            </CardTitle>
            <CardDescription className="text-xs">
              Sorted by last activity. Archived courses are flagged.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-y-auto pt-0">
            {hits == null ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : hits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No students found.</p>
            ) : (
              <ul className="space-y-1">
                {hits.map((h) => {
                  const active = selected?.student_id === h.student_id;
                  return (
                    <li key={h.student_id}>
                      <button
                        onClick={() => openStudent(h)}
                        className={`w-full text-left rounded-md p-2.5 text-sm transition-colors ${
                          active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">
                            {h.real_name ?? h.display_name}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="truncate">{h.course_name}</span>
                          {h.school_year && (
                            <>
                              <span>·</span>
                              <span>{h.school_year}</span>
                            </>
                          )}
                          {h.course_archived && (
                            <Badge variant="outline" className="text-[9px] gap-1 px-1 py-0">
                              <Archive className="h-2.5 w-2.5" /> archived
                            </Badge>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* HISTORY DETAIL */}
        <div>
          {!selected ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Pick a student to see their longitudinal mastery record.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-2xl flex items-center gap-2">
                    {selected.real_name ?? selected.display_name}
                    {selected.course_archived && (
                      <Badge variant="outline" className="gap-1">
                        <Archive className="h-3 w-3" /> archived course
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {selected.course_name}
                    {selected.school_year && <> · {selected.school_year}</>}
                  </CardDescription>
                </CardHeader>
              </Card>

              {loadingHistory ? (
                <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div>
              ) : !history || history.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No mastery data yet for this student.
                  </CardContent>
                </Card>
              ) : (
                groupedHistory.map((g) => (
                  <Card key={g.key}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{g.school_year ?? "—"}</Badge>
                        <Badge variant="outline">{g.framework}</Badge>
                        <span>{g.subject}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>Grade {g.grade}</span>
                        {g.archived && (
                          <Badge variant="outline" className="text-[9px] gap-1">
                            <Archive className="h-2.5 w-2.5" /> archived
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {g.course_name} · {g.rows.length} standard{g.rows.length === 1 ? "" : "s"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1.5">
                        {g.rows
                          .sort((a, b) => a.standard_code.localeCompare(b.standard_code))
                          .map((r) => (
                            <div
                              key={r.standard_id}
                              className="flex items-center gap-3 rounded-md border p-2 text-sm"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs">{r.standard_code}</span>
                                  {r.mastered && (
                                    <Badge variant="outline" className="text-[9px] bg-mastery-high/10 text-mastery-high border-mastery-high/30">
                                      mastered
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{r.standard_description}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-semibold tabular-nums">
                                  {r.mastery_score != null ? `${Math.round(r.mastery_score * 100)}%` : "—"}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {r.attempts ?? 0} attempt{(r.attempts ?? 0) === 1 ? "" : "s"}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
