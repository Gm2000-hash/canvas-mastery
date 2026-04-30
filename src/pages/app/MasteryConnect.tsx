import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRightLeft, Download, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { downloadCsv, parseCsv, toCsv } from "@/lib/mc-csv";

type Standard = { id: string; code: string; description: string; subject: string; grade: string };
type Course = { id: string; name: string };
type Student = { id: string; name: string; course_id: string };
type Assignment = { id: string; name: string; course_id: string };

type StdMap = { standard_id: string; mc_code: string; mc_name: string | null };
type AssessMap = { assignment_id: string | null; mc_assessment_id: string; mc_assessment_name: string | null };
type StudentMap = { student_id: string; mc_student_id: string | null; mc_sis_id: string | null };
type CourseMap = { course_id: string; mc_tracker_id: string; mc_tracker_name: string | null };

const SUBJECT_FILTER_KEY = "mc.subjectFilter";

function useDebouncedSave<T extends Record<string, any>>(
  table: string,
  conflictKeys: string[],
) {
  const timers = useRef<Record<string, any>>({});
  return (rowKey: string, payload: T) => {
    if (timers.current[rowKey]) clearTimeout(timers.current[rowKey]);
    timers.current[rowKey] = setTimeout(async () => {
      const { error } = await supabase
        .from(table as any)
        .upsert(payload as any, { onConflict: conflictKeys.join(",") });
      if (error) toast.error(`Save failed: ${error.message}`);
    }, 500);
  };
}

export default function MasteryConnect() {
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [standards, setStandards] = useState<Standard[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [stdMaps, setStdMaps] = useState<Record<string, StdMap>>({});
  const [assessMaps, setAssessMaps] = useState<Record<string, AssessMap>>({});
  const [studentMaps, setStudentMaps] = useState<Record<string, StudentMap>>({});
  const [courseMaps, setCourseMaps] = useState<Record<string, CourseMap>>({});

  // Map: assignment_id -> Set<subject> (derived from tagged standards)
  const [assignmentSubjects, setAssignmentSubjects] = useState<Record<string, string[]>>({});

  const [subjectFilter, setSubjectFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    return window.localStorage.getItem(SUBJECT_FILTER_KEY) ?? "all";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SUBJECT_FILTER_KEY, subjectFilter);
    }
  }, [subjectFilter]);

  useEffect(() => {
    document.title = "Mastery Connect Integration";
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setTeacherId(user.id);

      // Standards used (referenced by assignments or question tags), plus all owned/shared
      const [stdRes, crsRes, stuRes, asgRes, smRes, amRes, smnRes, cmRes, asRes] = await Promise.all([
        supabase.from("standards").select("id,code,description,subject,grade").order("code"),
        supabase.from("courses").select("id,name").order("name"),
        supabase.from("students").select("id,name,course_id").order("sortable_name"),
        supabase.from("assignments").select("id,name,course_id").order("name"),
        supabase.from("mc_standard_mappings").select("standard_id,mc_code,mc_name"),
        supabase.from("mc_assessment_mappings").select("assignment_id,mc_assessment_id,mc_assessment_name").not("assignment_id", "is", null),
        supabase.from("mc_student_mappings").select("student_id,mc_student_id,mc_sis_id"),
        supabase.from("mc_course_mappings").select("course_id,mc_tracker_id,mc_tracker_name"),
        supabase.from("assignment_standards").select("assignment_id,standard_id"),
      ]);
      const stds = (stdRes.data ?? []) as Standard[];
      setStandards(stds);
      setCourses((crsRes.data ?? []) as Course[]);
      setStudents((stuRes.data ?? []) as Student[]);
      setAssignments((asgRes.data ?? []) as Assignment[]);
      setStdMaps(Object.fromEntries(((smRes.data ?? []) as StdMap[]).map(m => [m.standard_id, m])));
      setAssessMaps(Object.fromEntries(((amRes.data ?? []) as AssessMap[]).map(m => [m.assignment_id!, m])));
      setStudentMaps(Object.fromEntries(((smnRes.data ?? []) as StudentMap[]).map(m => [m.student_id, m])));
      setCourseMaps(Object.fromEntries(((cmRes.data ?? []) as CourseMap[]).map(m => [m.course_id, m])));

      // Build assignment -> subjects map via tagged standards
      const stdSubject = new Map(stds.map(s => [s.id, s.subject]));
      const aSubs: Record<string, Set<string>> = {};
      for (const row of (asRes.data ?? []) as { assignment_id: string; standard_id: string }[]) {
        const subj = stdSubject.get(row.standard_id);
        if (!subj) continue;
        (aSubs[row.assignment_id] ||= new Set()).add(subj);
      }
      setAssignmentSubjects(
        Object.fromEntries(Object.entries(aSubs).map(([k, v]) => [k, Array.from(v)]))
      );
      setLoading(false);
    })();
  }, []);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of standards) if (s.subject) set.add(s.subject);
    return Array.from(set).sort();
  }, [standards]);

  if (loading || !teacherId) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <ArrowRightLeft className="h-7 w-7" /> Mastery Connect
          </h1>
          <p className="text-muted-foreground mt-1">
            Map standards, assessments, students, and classes between this app and Mastery Connect, then export CSV files you can upload to MC (or hand to your district for SFTP ingest).
          </p>
        </div>
        <div className="min-w-56">
          <Label className="text-xs text-muted-foreground">Subject area</Label>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjectOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      <Tabs defaultValue="standards" className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="standards">Standards</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="standards" className="mt-4">
          <StandardsTab
            teacherId={teacherId}
            standards={standards}
            maps={stdMaps}
            onChange={setStdMaps}
            subjectFilter={subjectFilter}
          />
        </TabsContent>
        <TabsContent value="assessments" className="mt-4">
          <AssessmentsTab
            teacherId={teacherId}
            assignments={assignments}
            courses={courses}
            maps={assessMaps}
            onChange={setAssessMaps}
            subjectFilter={subjectFilter}
            assignmentSubjects={assignmentSubjects}
          />
        </TabsContent>
        <TabsContent value="students" className="mt-4">
          <StudentsTab
            teacherId={teacherId}
            students={students}
            courses={courses}
            maps={studentMaps}
            onChange={setStudentMaps}
          />
        </TabsContent>
        <TabsContent value="classes" className="mt-4">
          <ClassesTab
            teacherId={teacherId}
            courses={courses}
            maps={courseMaps}
            onChange={setCourseMaps}
          />
        </TabsContent>
        <TabsContent value="export" className="mt-4">
          <ExportTab
            teacherId={teacherId}
            courses={courses}
            stdMaps={stdMaps}
            studentMaps={studentMaps}
            courseMaps={courseMaps}
            assessMaps={assessMaps}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Standards ---------- */
function StandardsTab({ teacherId, standards, maps, onChange, subjectFilter }: {
  teacherId: string;
  standards: Standard[];
  maps: Record<string, StdMap>;
  onChange: (m: Record<string, StdMap>) => void;
  subjectFilter: string;
}) {
  const visibleStandards = subjectFilter === "all"
    ? standards
    : standards.filter(s => s.subject === subjectFilter);
  const save = useDebouncedSave<{ teacher_id: string; standard_id: string; mc_code: string; mc_name: string | null }>(
    "mc_standard_mappings", ["teacher_id", "standard_id"]
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (standard_id: string, patch: Partial<StdMap>) => {
    const next = { ...maps, [standard_id]: { standard_id, mc_code: "", mc_name: null, ...maps[standard_id], ...patch } };
    onChange(next);
    const v = next[standard_id];
    if (v.mc_code) save(standard_id, { teacher_id: teacherId, standard_id, mc_code: v.mc_code, mc_name: v.mc_name });
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { toast.error("CSV is empty"); return; }
    const header = rows[0].map(h => h.toLowerCase().trim());
    const codeIdx = header.findIndex(h => h === "code" || h === "standard_code" || h === "mc_code");
    const mcCodeIdx = header.findIndex(h => h === "mc_code" || h === "mastery_connect_code" || h === "mc code");
    const nameIdx = header.findIndex(h => h === "name" || h === "mc_name" || h === "description");
    if (codeIdx < 0) { toast.error("CSV must contain a 'code' column"); return; }

    const byCode = new Map(standards.map(s => [s.code.toLowerCase(), s]));
    const upserts: any[] = [];
    let matched = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const code = (r[codeIdx] ?? "").trim();
      const std = byCode.get(code.toLowerCase());
      if (!std) continue;
      const mc_code = mcCodeIdx >= 0 ? (r[mcCodeIdx] ?? "").trim() : code;
      const mc_name = nameIdx >= 0 ? (r[nameIdx] ?? "").trim() || null : null;
      if (!mc_code) continue;
      upserts.push({ teacher_id: teacherId, standard_id: std.id, mc_code, mc_name });
      matched++;
    }
    if (!upserts.length) { toast.error("No matching standards found"); return; }
    const { error } = await supabase.from("mc_standard_mappings").upsert(upserts, { onConflict: "teacher_id,standard_id" });
    if (error) { toast.error(error.message); return; }
    const next = { ...maps };
    upserts.forEach(u => { next[u.standard_id] = { standard_id: u.standard_id, mc_code: u.mc_code, mc_name: u.mc_name }; });
    onChange(next);
    toast.success(`Imported ${matched} standard mappings`);
  };

  const mapped = Object.values(maps).filter(m => m.mc_code).length;
  const subjLabel = subjectFilter === "all" ? "" : ` (${subjectFilter})`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Standard mappings{subjLabel}</CardTitle>
            <CardDescription>Showing {visibleStandards.length} of {standards.length} standards · {mapped} mapped overall.</CardDescription>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Import MC standards CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[60vh] overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left">
                <th className="p-2">Code</th>
                <th className="p-2">Subject / Grade</th>
                <th className="p-2">MC code</th>
                <th className="p-2">MC name (optional)</th>
              </tr>
            </thead>
            <tbody>
              {visibleStandards.map(s => {
                const m = maps[s.id];
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{s.code}</td>
                    <td className="p-2 text-muted-foreground text-xs">{s.subject} · {s.grade}</td>
                    <td className="p-2"><Input value={m?.mc_code ?? ""} onChange={e => set(s.id, { mc_code: e.target.value })} placeholder="MC.STD.X" /></td>
                    <td className="p-2"><Input value={m?.mc_name ?? ""} onChange={e => set(s.id, { mc_name: e.target.value })} placeholder="Optional MC name" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Assessments ---------- */
function AssessmentsTab({ teacherId, assignments, courses, maps, onChange }: {
  teacherId: string;
  assignments: Assignment[];
  courses: Course[];
  maps: Record<string, AssessMap>;
  onChange: (m: Record<string, AssessMap>) => void;
}) {
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const save = useDebouncedSave<any>("mc_assessment_mappings", ["teacher_id", "assignment_id"]);

  const set = (assignment_id: string, patch: Partial<AssessMap>) => {
    const next = { ...maps, [assignment_id]: { assignment_id, mc_assessment_id: "", mc_assessment_name: null, ...maps[assignment_id], ...patch } };
    onChange(next);
    const v = next[assignment_id];
    if (v.mc_assessment_id) save(assignment_id, {
      teacher_id: teacherId, assignment_id, assignment_group_id: null,
      mc_assessment_id: v.mc_assessment_id, mc_assessment_name: v.mc_assessment_name,
    });
  };

  const filtered = courseFilter === "all" ? assignments : assignments.filter(a => a.course_id === courseFilter);
  const courseName = (id: string) => courses.find(c => c.id === id)?.name ?? "—";
  const mapped = Object.values(maps).filter(m => m.mc_assessment_id).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Assessment mappings</CardTitle>
            <CardDescription>{mapped} of {assignments.length} Canvas assignments mapped.</CardDescription>
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[60vh] overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left">
                <th className="p-2">Assignment</th>
                <th className="p-2">Class</th>
                <th className="p-2">MC assessment ID</th>
                <th className="p-2">MC name</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const m = maps[a.id];
                return (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.name}</td>
                    <td className="p-2 text-muted-foreground text-xs">{courseName(a.course_id)}</td>
                    <td className="p-2"><Input value={m?.mc_assessment_id ?? ""} onChange={e => set(a.id, { mc_assessment_id: e.target.value })} placeholder="MC assessment ID" /></td>
                    <td className="p-2"><Input value={m?.mc_assessment_name ?? ""} onChange={e => set(a.id, { mc_assessment_name: e.target.value })} placeholder="Optional" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Students ---------- */
function StudentsTab({ teacherId, students, courses, maps, onChange }: {
  teacherId: string;
  students: Student[];
  courses: Course[];
  maps: Record<string, StudentMap>;
  onChange: (m: Record<string, StudentMap>) => void;
}) {
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const save = useDebouncedSave<any>("mc_student_mappings", ["teacher_id", "student_id"]);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (student_id: string, patch: Partial<StudentMap>) => {
    const cur = maps[student_id] ?? { student_id, mc_student_id: null, mc_sis_id: null };
    const next = { ...maps, [student_id]: { ...cur, ...patch } };
    onChange(next);
    const v = next[student_id];
    if (v.mc_student_id || v.mc_sis_id) save(student_id, {
      teacher_id: teacherId, student_id, mc_student_id: v.mc_student_id, mc_sis_id: v.mc_sis_id,
    });
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { toast.error("CSV is empty"); return; }
    const header = rows[0].map(h => h.toLowerCase().trim());
    const nameIdx = header.findIndex(h => h === "name" || h === "student_name" || h === "real_name");
    const sisIdx = header.findIndex(h => h === "sis_id" || h === "mc_sis_id" || h === "student_sis_id");
    const mcIdx = header.findIndex(h => h === "mc_student_id" || h === "student_id");
    if (nameIdx < 0) { toast.error("CSV must contain a 'name' column"); return; }

    // Try to match by real name via student_identities, fallback to displayed name
    const { data: identities } = await supabase
      .from("student_identities")
      .select("student_id,real_name");
    const byReal = new Map((identities ?? []).map((i: any) => [String(i.real_name).toLowerCase().trim(), i.student_id]));
    const byDisplay = new Map(students.map(s => [s.name.toLowerCase().trim(), s.id]));

    const upserts: any[] = [];
    let matched = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[nameIdx] ?? "").trim().toLowerCase();
      const sid = byReal.get(name) ?? byDisplay.get(name);
      if (!sid) continue;
      upserts.push({
        teacher_id: teacherId, student_id: sid,
        mc_student_id: mcIdx >= 0 ? (r[mcIdx] ?? "").trim() || null : null,
        mc_sis_id: sisIdx >= 0 ? (r[sisIdx] ?? "").trim() || null : null,
      });
      matched++;
    }
    if (!upserts.length) { toast.error("No matching students"); return; }
    const { error } = await supabase.from("mc_student_mappings").upsert(upserts, { onConflict: "teacher_id,student_id" });
    if (error) { toast.error(error.message); return; }
    const next = { ...maps };
    upserts.forEach(u => { next[u.student_id] = { student_id: u.student_id, mc_student_id: u.mc_student_id, mc_sis_id: u.mc_sis_id }; });
    onChange(next);
    toast.success(`Imported ${matched} student mappings`);
  };

  const filtered = courseFilter === "all" ? students : students.filter(s => s.course_id === courseFilter);
  const courseName = (id: string) => courses.find(c => c.id === id)?.name ?? "—";
  const mapped = Object.values(maps).filter(m => m.mc_student_id || m.mc_sis_id).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Student mappings</CardTitle>
            <CardDescription>{mapped} of {students.length} students mapped.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[60vh] overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left">
                <th className="p-2">Student (display name)</th>
                <th className="p-2">Class</th>
                <th className="p-2">MC student ID</th>
                <th className="p-2">MC SIS ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const m = maps[s.id];
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.name}</td>
                    <td className="p-2 text-muted-foreground text-xs">{courseName(s.course_id)}</td>
                    <td className="p-2"><Input value={m?.mc_student_id ?? ""} onChange={e => set(s.id, { mc_student_id: e.target.value })} /></td>
                    <td className="p-2"><Input value={m?.mc_sis_id ?? ""} onChange={e => set(s.id, { mc_sis_id: e.target.value })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Classes ---------- */
function ClassesTab({ teacherId, courses, maps, onChange }: {
  teacherId: string;
  courses: Course[];
  maps: Record<string, CourseMap>;
  onChange: (m: Record<string, CourseMap>) => void;
}) {
  const save = useDebouncedSave<any>("mc_course_mappings", ["teacher_id", "course_id"]);

  const set = (course_id: string, patch: Partial<CourseMap>) => {
    const cur = maps[course_id] ?? { course_id, mc_tracker_id: "", mc_tracker_name: null };
    const next = { ...maps, [course_id]: { ...cur, ...patch } };
    onChange(next);
    const v = next[course_id];
    if (v.mc_tracker_id) save(course_id, {
      teacher_id: teacherId, course_id, mc_tracker_id: v.mc_tracker_id, mc_tracker_name: v.mc_tracker_name,
    });
  };

  const mapped = Object.values(maps).filter(m => m.mc_tracker_id).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Class mappings</CardTitle>
        <CardDescription>{mapped} of {courses.length} classes mapped to Mastery Connect trackers/sections.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="p-2">Class</th>
                <th className="p-2">MC tracker / section ID</th>
                <th className="p-2">MC tracker name</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => {
                const m = maps[c.id];
                return (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.name}</td>
                    <td className="p-2"><Input value={m?.mc_tracker_id ?? ""} onChange={e => set(c.id, { mc_tracker_id: e.target.value })} /></td>
                    <td className="p-2"><Input value={m?.mc_tracker_name ?? ""} onChange={e => set(c.id, { mc_tracker_name: e.target.value })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Export ---------- */
type ExportType = "mastery_by_standard" | "item_analysis" | "assessment_scores";

function ExportTab({ teacherId, courses, stdMaps, studentMaps, courseMaps, assessMaps }: {
  teacherId: string;
  courses: Course[];
  stdMaps: Record<string, StdMap>;
  studentMaps: Record<string, StudentMap>;
  courseMaps: Record<string, CourseMap>;
  assessMaps: Record<string, AssessMap>;
}) {
  const [type, setType] = useState<ExportType>("mastery_by_standard");
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "");
  const [includeUnmapped, setIncludeUnmapped] = useState(false);
  const [busy, setBusy] = useState(false);

  const courseLabel = courses.find(c => c.id === courseId)?.name ?? "class";
  const courseMc = courseMaps[courseId];

  const generate = async () => {
    if (!courseId) { toast.error("Pick a class"); return; }
    setBusy(true);
    try {
      let csv = "";
      let rowCount = 0;
      let skipped = 0;

      if (type === "mastery_by_standard") {
        const { data, error } = await supabase
          .from("mastery_snapshots")
          .select("student_id,standard_id,mastery_score,mastered,attempts,computed_at,students!inner(course_id,name),standards!inner(code,description)")
          .eq("teacher_id", teacherId);
        if (error) throw error;
        const filtered = (data ?? []).filter((r: any) => r.students.course_id === courseId);
        const rows: any[] = [];
        for (const r of filtered as any[]) {
          const stuMap = studentMaps[r.student_id];
          const stdMap = stdMaps[r.standard_id];
          const ok = (stuMap?.mc_student_id || stuMap?.mc_sis_id) && stdMap?.mc_code;
          if (!ok && !includeUnmapped) { skipped++; continue; }
          rows.push([
            stuMap?.mc_student_id ?? "",
            stuMap?.mc_sis_id ?? "",
            r.students.name,
            stdMap?.mc_code ?? "",
            r.standards.code,
            r.standards.description,
            courseMc?.mc_tracker_id ?? "",
            r.mastery_score,
            r.mastered ? "Y" : "N",
            r.attempts,
            r.computed_at,
          ]);
        }
        rowCount = rows.length;
        csv = toCsv(
          ["mc_student_id", "mc_sis_id", "student_name", "mc_standard_code", "source_standard_code", "standard_description", "mc_tracker_id", "mastery_score", "mastered", "attempts", "computed_at"],
          rows,
        );
      } else if (type === "assessment_scores") {
        const { data, error } = await supabase
          .from("submissions")
          .select("student_id,assignment_id,score,points_possible,percentage,submitted_at,graded_at,students!inner(course_id,name),assignments!inner(name,course_id)")
          .eq("teacher_id", teacherId);
        if (error) throw error;
        const filtered = (data ?? []).filter((r: any) => r.assignments.course_id === courseId);
        const rows: any[] = [];
        for (const r of filtered as any[]) {
          const stuMap = studentMaps[r.student_id];
          const asgMap = assessMaps[r.assignment_id];
          const ok = (stuMap?.mc_student_id || stuMap?.mc_sis_id) && asgMap?.mc_assessment_id;
          if (!ok && !includeUnmapped) { skipped++; continue; }
          rows.push([
            stuMap?.mc_student_id ?? "",
            stuMap?.mc_sis_id ?? "",
            r.students.name,
            asgMap?.mc_assessment_id ?? "",
            r.assignments.name,
            courseMc?.mc_tracker_id ?? "",
            r.score,
            r.points_possible,
            r.percentage,
            r.submitted_at,
            r.graded_at,
          ]);
        }
        rowCount = rows.length;
        csv = toCsv(
          ["mc_student_id", "mc_sis_id", "student_name", "mc_assessment_id", "source_assignment_name", "mc_tracker_id", "score", "points_possible", "percentage", "submitted_at", "graded_at"],
          rows,
        );
      } else {
        // item_analysis
        const { data, error } = await supabase
          .from("question_responses")
          .select("student_id,question_id,points,points_possible,correct,created_at,students!inner(course_id,name),quiz_questions!inner(assignment_id,position,question_text,assignments!inner(course_id,name))")
          .eq("teacher_id", teacherId);
        if (error) throw error;
        const filtered = (data ?? []).filter((r: any) => r.students.course_id === courseId);

        // Pull standards-per-question once
        const qIds = Array.from(new Set(filtered.map((r: any) => r.question_id))) as string[];
        const standardsByQ = new Map<string, string[]>();
        if (qIds.length) {
          const { data: qs } = await supabase
            .from("question_standards")
            .select("question_id,standard_id,confirmed,ai_suggested")
            .in("question_id", qIds);
          for (const t of (qs ?? []) as any[]) {
            if (!t.confirmed && !t.ai_suggested) continue;
            const arr = standardsByQ.get(t.question_id) ?? [];
            arr.push(t.standard_id);
            standardsByQ.set(t.question_id, arr);
          }
        }

        const rows: any[] = [];
        for (const r of filtered as any[]) {
          const stuMap = studentMaps[r.student_id];
          const asgMap = assessMaps[r.quiz_questions.assignment_id];
          const stdIds = standardsByQ.get(r.question_id) ?? [];
          const mcCodes = stdIds.map(id => stdMaps[id]?.mc_code).filter(Boolean).join("; ");
          const ok = (stuMap?.mc_student_id || stuMap?.mc_sis_id) && asgMap?.mc_assessment_id;
          if (!ok && !includeUnmapped) { skipped++; continue; }
          rows.push([
            stuMap?.mc_student_id ?? "",
            stuMap?.mc_sis_id ?? "",
            r.students.name,
            asgMap?.mc_assessment_id ?? "",
            r.quiz_questions.assignments.name,
            r.quiz_questions.position ?? "",
            mcCodes,
            r.correct === null ? "" : (r.correct ? "Y" : "N"),
            r.points,
            r.points_possible,
            r.created_at,
          ]);
        }
        rowCount = rows.length;
        csv = toCsv(
          ["mc_student_id", "mc_sis_id", "student_name", "mc_assessment_id", "source_assignment_name", "question_position", "mc_standard_codes", "correct", "points", "points_possible", "responded_at"],
          rows,
        );
      }

      if (rowCount === 0) {
        toast.error("No rows to export. Add mappings or enable 'include unmapped'.");
        return;
      }

      const fname = `mc-${type}-${courseLabel.replace(/\W+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(fname, csv);
      await supabase.from("mc_export_log").insert({ teacher_id: teacherId, export_type: type, course_id: courseId, row_count: rowCount });
      toast.success(`Exported ${rowCount} rows${skipped ? ` (${skipped} skipped — unmapped)` : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  };

  // Quick warnings
  const warnings: string[] = [];
  if (courseId && !courseMc?.mc_tracker_id) warnings.push("This class has no MC tracker mapping — tracker ID will be blank in the export.");
  if (Object.values(stdMaps).filter(m => m.mc_code).length === 0) warnings.push("No standards have been mapped yet.");
  if (Object.values(studentMaps).filter(m => m.mc_student_id || m.mc_sis_id).length === 0) warnings.push("No students have been mapped yet.");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Generate export</CardTitle>
        <CardDescription>Download a CSV ready for Mastery Connect upload (or district SFTP ingest).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Class</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Pick a class" /></SelectTrigger>
              <SelectContent>
                {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Export type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ExportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mastery_by_standard">Per-student mastery by standard</SelectItem>
                <SelectItem value="item_analysis">Item analysis (per-question)</SelectItem>
                <SelectItem value="assessment_scores">Assessment scores</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeUnmapped} onChange={e => setIncludeUnmapped(e.target.checked)} />
              Include unmapped rows (blank MC fields)
            </label>
          </div>
        </div>

        {warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc pl-5 space-y-1">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={generate} disabled={busy || !courseId}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Generate CSV
          </Button>
          <Badge variant="outline">No data leaves your browser until you click Generate.</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
