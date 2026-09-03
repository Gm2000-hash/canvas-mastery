import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/modules/curriculum/config/router";
import { useAuth } from "@/modules/curriculum/config/auth";
import { usePageTitle } from "@/modules/curriculum/config/page-title";
import { supabase } from "@/modules/curriculum/config/supabase";
import { AppNavSheet } from "@/modules/curriculum/config/chrome-nav-sheet";
import { Breadcrumbs } from "@/modules/curriculum/config/chrome-breadcrumbs";
import { BentoHero } from "@/modules/curriculum/config/chrome-bento-hero";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ArrowUpRight, Calendar, Layers, Sparkles, Tag, Filter, X, BookOpen,
} from "lucide-react";

type Source = "lesson_plan" | "curriculum";

interface LessonRow {
  id: string;
  source: Source;
  title: string;
  unit_id: string | null;
  unit_title: string | null;
  discipline: string | null;
  grade_level: string | null;
  lesson_date: string | null;
  duration_minutes: number | null;
  objectives: string;
  activities_count: number;
  has_reading: boolean;
  vocabulary: string[];
  standards: { code: string; description: string }[];
  updated_at: string;
}

const ANY = "__any__";

function stripHtml(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function LessonsBrowser() {
  usePageTitle("Lessons");
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LessonRow[]>([]);

  // Filters
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState<string>(ANY);
  const [grade, setGrade] = useState<string>(ANY);
  const [source, setSource] = useState<string>(ANY);
  const [hasActivities, setHasActivities] = useState<string>(ANY); // "yes" | "no" | ANY
  const [hasReading, setHasReading] = useState<string>(ANY);
  const [standardCode, setStandardCode] = useState<string>(ANY);
  const [sort, setSort] = useState<string>("updated_desc");

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      const [unitsRes, lpRes, lpStdRes, clRes, clStdRes] = await Promise.all([
        supabase.from("units")
          .select("id, title, discipline, grade_level")
          .eq("user_id", user.id),
        supabase.from("lesson_plans")
          .select("id, unit_id, title, lesson_date, duration_minutes, objectives, activities, embedded_activities, vocabulary, updated_at")
          .eq("user_id", user.id),
        supabase.from("lesson_plan_standards")
          .select("lesson_plan_id, ngss_code, ngss_description"),
        supabase.from("curriculum_lessons")
          .select("id, unit_id, title, intro, explanation, key_terms, interactive_activities, reading_paragraphs, updated_at")
          .eq("user_id", user.id),
        supabase.from("curriculum_lesson_standards")
          .select("lesson_id, ngss_code, ngss_description"),
      ]);

      const unitMap = new Map<string, { title: string; discipline: string | null; grade_level: string | null }>();
      (unitsRes.data || []).forEach((u: any) => unitMap.set(u.id, { title: u.title, discipline: u.discipline, grade_level: u.grade_level }));

      const lpStdMap = new Map<string, { code: string; description: string }[]>();
      (lpStdRes.data || []).forEach((s: any) => {
        const arr = lpStdMap.get(s.lesson_plan_id) || [];
        arr.push({ code: s.ngss_code, description: s.ngss_description });
        lpStdMap.set(s.lesson_plan_id, arr);
      });

      const clStdMap = new Map<string, { code: string; description: string }[]>();
      (clStdRes.data || []).forEach((s: any) => {
        const arr = clStdMap.get(s.lesson_id) || [];
        arr.push({ code: s.ngss_code, description: s.ngss_description });
        clStdMap.set(s.lesson_id, arr);
      });

      const fromLP: LessonRow[] = (lpRes.data || []).map((l: any) => {
        const u = l.unit_id ? unitMap.get(l.unit_id) : null;
        const acts = Array.isArray(l.activities) ? l.activities.length : 0;
        const embedded = Array.isArray(l.embedded_activities) ? l.embedded_activities.length : 0;
        const vocab = Array.isArray(l.vocabulary)
          ? l.vocabulary.map((v: any) => (typeof v === "string" ? v : v?.term || v?.word || "")).filter(Boolean)
          : [];
        return {
          id: l.id,
          source: "lesson_plan",
          title: l.title,
          unit_id: l.unit_id,
          unit_title: u?.title ?? null,
          discipline: u?.discipline ?? null,
          grade_level: u?.grade_level ?? null,
          lesson_date: l.lesson_date,
          duration_minutes: l.duration_minutes,
          objectives: stripHtml(l.objectives),
          activities_count: acts + embedded,
          has_reading: false,
          vocabulary: vocab,
          standards: lpStdMap.get(l.id) || [],
          updated_at: l.updated_at,
        };
      });

      const fromCL: LessonRow[] = (clRes.data || []).map((l: any) => {
        const u = l.unit_id ? unitMap.get(l.unit_id) : null;
        const intro = Array.isArray(l.intro) ? l.intro.map(stripHtml).join(" ") : "";
        const explanation = Array.isArray(l.explanation) ? l.explanation.map(stripHtml).join(" ") : "";
        const keyTerms = Array.isArray(l.key_terms)
          ? l.key_terms.map((k: any) => (typeof k === "string" ? k : k?.term || "")).filter(Boolean)
          : [];
        const acts = Array.isArray(l.interactive_activities) ? l.interactive_activities.length : 0;
        const reading = Array.isArray(l.reading_paragraphs) && l.reading_paragraphs.length > 0;
        return {
          id: l.id,
          source: "curriculum",
          title: l.title,
          unit_id: l.unit_id,
          unit_title: u?.title ?? null,
          discipline: u?.discipline ?? null,
          grade_level: u?.grade_level ?? null,
          lesson_date: null,
          duration_minutes: null,
          objectives: stripHtml(intro || explanation).slice(0, 240),
          activities_count: acts,
          has_reading: reading,
          vocabulary: keyTerms,
          standards: clStdMap.get(l.id) || [],
          updated_at: l.updated_at,
        };
      });

      setRows([...fromLP, ...fromCL]);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  // Derive filter option sets
  const disciplines = useMemo(
    () => Array.from(new Set(rows.map(r => r.discipline).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const grades = useMemo(
    () => Array.from(new Set(rows.map(r => r.grade_level).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const standardCodes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => r.standards.forEach(s => set.add(s.code)));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter(r => {
      if (discipline !== ANY && r.discipline !== discipline) return false;
      if (grade !== ANY && r.grade_level !== grade) return false;
      if (source !== ANY && r.source !== source) return false;
      if (hasActivities === "yes" && r.activities_count === 0) return false;
      if (hasActivities === "no" && r.activities_count > 0) return false;
      if (hasReading === "yes" && !r.has_reading) return false;
      if (hasReading === "no" && r.has_reading) return false;
      if (standardCode !== ANY && !r.standards.some(s => s.code === standardCode)) return false;
      if (needle) {
        const haystack = [
          r.title, r.objectives, r.unit_title || "",
          r.vocabulary.join(" "),
          r.standards.map(s => `${s.code} ${s.description}`).join(" "),
        ].join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "updated_asc":
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        case "date_asc":
          return (a.lesson_date || "9999").localeCompare(b.lesson_date || "9999");
        case "date_desc":
          return (b.lesson_date || "0").localeCompare(a.lesson_date || "0");
        case "updated_desc":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
    return out;
  }, [rows, q, discipline, grade, source, hasActivities, hasReading, standardCode, sort]);

  const clearAll = () => {
    setQ(""); setDiscipline(ANY); setGrade(ANY); setSource(ANY);
    setHasActivities(ANY); setHasReading(ANY); setStandardCode(ANY); setSort("updated_desc");
  };

  const activeFilterCount = [
    discipline !== ANY, grade !== ANY, source !== ANY,
    hasActivities !== ANY, hasReading !== ANY, standardCode !== ANY, q.trim() !== "",
  ].filter(Boolean).length;

  const openLesson = (r: LessonRow) => {
    if (r.source === "lesson_plan") {
      navigate(`/app/curriculum/lessons/${r.id}`);
    } else if (r.unit_id) {
      // Curriculum lessons live inside their unit's curriculum tab
      navigate(`/app/curriculum/units/${r.unit_id}?tab=curriculum&lesson=${r.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-white glass-header flex items-center px-4 gap-4">
        <AppNavSheet />
        <Breadcrumbs items={[{ label: "Lesson Planner", path: "/app/curriculum/lesson-planner" }, { label: "Lessons" }]} />
      </header>

      <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full space-y-6">
        <BentoHero
          eyebrow="Lessons"
          title={<>Every lesson,<br/><span className="italic font-light">searchable.</span></>}
          subtitle="Filter by subject, grade, theme, or activities — across both lesson plans and curriculum readings."
          stats={[
            { label: "Lessons", value: rows.length },
            { label: "Subjects", value: disciplines.length },
            { label: "Standards", value: standardCodes.length },
          ]}
          primaryAction={{
            label: "Back to Units",
            icon: Layers,
            onClick: () => navigate("/app/curriculum/lesson-planner"),
            variant: "ink",
          }}
          sideTiles={[
            {
              variant: "coral",
              eyebrow: "Tip",
              title: "Search themes & terms",
              body: "The search box looks inside titles, objectives, vocabulary and standards.",
            },
            {
              variant: "sky",
              eyebrow: "Filter",
              title: "Activities first",
              body: "Set 'Has activities' to Yes to find lessons students can interact with.",
            },
          ]}
        />

        {/* Filter bar */}
        <div className="rounded-2xl border border-border bg-white p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, theme, vocabulary, standard…"
                className="pl-9"
              />
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="md:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_desc">Recently updated</SelectItem>
                <SelectItem value="updated_asc">Oldest updated</SelectItem>
                <SelectItem value="title_asc">Title A→Z</SelectItem>
                <SelectItem value="title_desc">Title Z→A</SelectItem>
                <SelectItem value="date_desc">Lesson date ↓</SelectItem>
                <SelectItem value="date_asc">Lesson date ↑</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any subject</SelectItem>
                {disciplines.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any grade</SelectItem>
                {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any type</SelectItem>
                <SelectItem value="lesson_plan">Lesson plans</SelectItem>
                <SelectItem value="curriculum">Curriculum readings</SelectItem>
              </SelectContent>
            </Select>
            <Select value={hasActivities} onValueChange={setHasActivities}>
              <SelectTrigger><SelectValue placeholder="Activities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Activities: any</SelectItem>
                <SelectItem value="yes">Has activities</SelectItem>
                <SelectItem value="no">No activities</SelectItem>
              </SelectContent>
            </Select>
            <Select value={hasReading} onValueChange={setHasReading}>
              <SelectTrigger><SelectValue placeholder="Reading" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Reading: any</SelectItem>
                <SelectItem value="yes">Has reading</SelectItem>
                <SelectItem value="no">No reading</SelectItem>
              </SelectContent>
            </Select>
            <Select value={standardCode} onValueChange={setStandardCode}>
              <SelectTrigger><SelectValue placeholder="Standard" /></SelectTrigger>
              <SelectContent className="max-h-[280px]">
                <SelectItem value={ANY}>Any standard</SelectItem>
                {standardCodes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" />
              {filtered.length} of {rows.length} lessons
              {activeFilterCount > 0 && (
                <span className="text-foreground font-medium">· {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}</span>
              )}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No lessons match</h3>
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "You haven't created any lessons yet. Start from the Curriculum page."
                : "Try clearing some filters or broadening your search."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((r) => (
              <button
                key={`${r.source}-${r.id}`}
                onClick={() => openLesson(r)}
                className="text-left rounded-2xl border border-border bg-white p-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">
                      {r.source === "lesson_plan" ? "Lesson Plan" : "Curriculum Reading"}
                      {r.unit_title && <> · {r.unit_title}</>}
                    </p>
                    <h3 className="text-lg font-bold mt-1.5 leading-snug group-hover:underline underline-offset-4 decoration-2">
                      {r.title}
                    </h3>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 mt-1 opacity-50 group-hover:opacity-100" />
                </div>

                {r.objectives && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {r.objectives}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                  {r.discipline && <Badge variant="secondary" className="rounded-full">{r.discipline}</Badge>}
                  {r.grade_level && <Badge variant="secondary" className="rounded-full">{r.grade_level}</Badge>}
                  {r.activities_count > 0 && (
                    <Badge variant="secondary" className="rounded-full inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> {r.activities_count} activit{r.activities_count === 1 ? "y" : "ies"}
                    </Badge>
                  )}
                  {r.has_reading && <Badge variant="secondary" className="rounded-full">Reading</Badge>}
                  {r.lesson_date && (
                    <Badge variant="secondary" className="rounded-full inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(r.lesson_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Badge>
                  )}
                </div>

                {(r.standards.length > 0 || r.vocabulary.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border/60">
                    {r.standards.slice(0, 3).map(s => (
                      <span key={s.code} className="inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        <Tag className="h-2.5 w-2.5" /> {s.code}
                      </span>
                    ))}
                    {r.standards.length > 3 && (
                      <span className="text-[11px] text-muted-foreground">+{r.standards.length - 3}</span>
                    )}
                    {r.vocabulary.slice(0, 3).map(v => (
                      <span key={v} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground italic">
                        {v}
                      </span>
                    ))}
                    {r.vocabulary.length > 3 && (
                      <span className="text-[11px] text-muted-foreground">+{r.vocabulary.length - 3} terms</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
