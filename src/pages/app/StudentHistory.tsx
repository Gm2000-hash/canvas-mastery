// Student History — narrow by content area, grade, trimester, school year,
// then search. Mastery scores stay tied to each student forever; opening an
// archived record logs an entry to historical_access_log for audit.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Archive, Calendar, ChevronRight, History, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { recentSchoolYears } from "@/lib/schoolYear";

type SearchHit = {
  student_id: string;
  display_name: string;
  real_name: string | null;
  course_id: string;
  course_name: string;
  course_archived: boolean;
  school_year: string | null;
  last_activity: string | null;
  subject: string | null;
  grade: string | null;
  term: string | null;
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

const ANY = "__any__";
const TRIMESTERS = [
  { value: "T1", label: "T1 — First trimester" },
  { value: "T2", label: "T2 — Second trimester" },
  { value: "T3", label: "T3 — Third trimester" },
  { value: "S1", label: "S1 — First semester" },
  { value: "S2", label: "S2 — Second semester" },
];

export default function StudentHistory() {
  // Filter state
  const [subject, setSubject] = useState<string>(ANY);
  const [grade, setGrade] = useState<string>(ANY);
  const [trimester, setTrimester] = useState<string>(ANY);
  const [schoolYear, setSchoolYear] = useState<string>(ANY);
  const [query, setQuery] = useState("");

  // Filter option sources
  const [subjects, setSubjects] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const schoolYearOptions = useMemo(() => recentSchoolYears(6), []);

  // Results
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load this teacher's distinct subjects/grades for the filter dropdowns.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teacher_disciplines")
        .select("subject, grade");
      if (!data) return;
      const sub = Array.from(new Set(data.map((d) => d.subject).filter(Boolean))).sort();
      const gr = Array.from(new Set(data.map((d) => d.grade).filter(Boolean))).sort();
      setSubjects(sub as string[]);
      setGrades(gr as string[]);
    })();
  }, []);

  const hasAnyFilter =
    subject !== ANY ||
    grade !== ANY ||
    trimester !== ANY ||
    schoolYear !== ANY ||
    query.trim().length > 0;

  async function runSearch() {
    setSearching(true);
    setSelected(null);
    setHistory(null);
    const { data, error } = await supabase.rpc("search_students_history", {
      _query: query,
      _subject: subject === ANY ? null : subject,
      _grade: grade === ANY ? null : grade,
      _trimester: trimester === ANY ? null : trimester,
      _school_year: schoolYear === ANY ? null : schoolYear,
    });
    setSearching(false);
    setSearched(true);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHits((data as SearchHit[]) ?? []);
  }

  function clearFilters() {
    setSubject(ANY);
    setGrade(ANY);
    setTrimester(ANY);
    setSchoolYear(ANY);
    setQuery("");
    setHits(null);
    setSearched(false);
    setSelected(null);
    setHistory(null);
  }

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
    setHistory((data as HistoryRow[]) ?? []);

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
      const ay = a.school_year ?? "";
      const by = b.school_year ?? "";
      if (ay !== by) return by.localeCompare(ay);
      return a.course_name.localeCompare(b.course_name);
    });
  }, [history]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2 flex items-center gap-3">
          <History className="h-8 w-8" /> Student history
        </h1>
        <p className="text-muted-foreground">
          Narrow by content area, grade level, trimester, and school year — then search.
          Mastery scores and assessment activity stay tied to each student forever.
        </p>
      </div>

      {/* FILTERS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Narrow your search
          </CardTitle>
          <CardDescription>
            Pick the criteria below, then run the search. Leave any filter on "Any" to widen the net.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Content area</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any subject</SelectItem>
                  {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Content level</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any grade</SelectItem>
                  {grades.map((g) => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Trimester / semester</Label>
              <Select value={trimester} onValueChange={setTrimester}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any trimester</SelectItem>
                  {TRIMESTERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">School year</Label>
              <Select value={schoolYear} onValueChange={setSchoolYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any school year</SelectItem>
                  {schoolYearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Optional: name or pseudonym…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                className="pl-9"
              />
            </div>
            <Button onClick={runSearch} disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </Button>
            {hasAnyFilter && (
              <Button variant="ghost" onClick={clearFilters} disabled={searching}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RESULTS — only render after first search */}
      {searched && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_2fr] gap-6">
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
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No students matched these filters. Try widening your search.
                </p>
              ) : (
                <ul className="space-y-1">
                  {hits.map((h) => {
                    const active = selected?.student_id === h.student_id;
                    return (
                      <li key={`${h.student_id}-${h.course_id}`}>
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
                            {h.school_year && (<><span>·</span><span>{h.school_year}</span></>)}
                            {h.course_archived && (
                              <Badge variant="outline" className="text-[11px] gap-1 px-1 py-0">
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
                            <Badge variant="outline" className="text-[11px] gap-1">
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
                                    <span className="font-code text-xs">{r.standard_code}</span>
                                    {r.mastered && (
                                      <Badge variant="outline" className="text-[11px] bg-mastery-high/10 text-mastery-high border-mastery-high/30">
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
                                  <div className="text-[11px] text-muted-foreground">
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
      )}

      {!searched && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Set your filters above and hit <span className="font-medium">Search</span> to see results.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
