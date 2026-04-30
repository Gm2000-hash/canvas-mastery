import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Check, Loader2, Star, Trash2, Plus, Pencil, RefreshCw, FileUp } from "lucide-react";
import ImportStandardsDialog from "@/components/ImportStandardsDialog";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FRAMEWORKS, getFramework, SUBJECTS, GRADES, STATES, type FrameworkId } from "@/lib/frameworks";
import InvitationsCard from "@/components/InvitationsCard";
import MergeStudentsCard from "@/components/MergeStudentsCard";
import { Switch } from "@/components/ui/switch";
import { Archive } from "lucide-react";

export default function Settings() {
  const location = useLocation();
  // Profile
  const [displayName, setDisplayName] = useState("");
  const [state, setState] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [grade, setGrade] = useState<string>("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Canvas
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [savingCanvas, setSavingCanvas] = useState(false);

  // Mastery settings
  const [threshold, setThreshold] = useState(80);
  const [windowN, setWindowN] = useState(3);
  const [autoArchive, setAutoArchive] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingArchive, setSavingArchive] = useState(false);

  // (legacy single seed kept for migration; new seeding lives per-discipline below)

  // Disciplines (multi)
  type Discipline = { id: string; state: string; subject: string; grade: string; is_default: boolean; framework: string | null };
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  // Multi-pick add form
  const [newFramework, setNewFramework] = useState<FrameworkId>("STATE");
  const [newState, setNewState] = useState("");
  const [newSubjects, setNewSubjects] = useState<string[]>([]);
  const [newGrades, setNewGrades] = useState<string[]>([]);
  const [addingDisc, setAddingDisc] = useState(false);
  const [seedingDiscId, setSeedingDiscId] = useState<string | null>(null);
  // Edit dialog
  const [editing, setEditing] = useState<Discipline | null>(null);
  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importDefaults, setImportDefaults] = useState<{ framework?: any; state?: string; subject?: string; grade?: string } | undefined>(undefined);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    const [{ data: profile }, { data: ccRows }, { data: settings }, { data: discs }] = await Promise.all([
      uid
        ? supabase.from("profiles").select("*").eq("id", uid).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.rpc("get_canvas_connection_status"),
      uid
        ? supabase.from("teacher_settings").select("*").eq("teacher_id", uid).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("teacher_disciplines").select("id, state, subject, grade, is_default, framework").order("created_at"),
    ]);
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setState(profile.state ?? "");
      setSubject(profile.default_subject ?? "");
      setGrade(profile.default_grade ?? "");
    }
    const cc = Array.isArray(ccRows) ? ccRows[0] : null;
    if (cc) {
      setBaseUrl(cc.base_url ?? "");
      setCanvasConnected(!!cc.connected);
    }
    if (settings) {
      setThreshold(Math.round((settings.mastery_threshold ?? 0.8) * 100));
      setWindowN(settings.attempt_window ?? 3);
      setAutoArchive(settings.auto_archive_enabled ?? true);
    }
    setDisciplines((discs ?? []) as Discipline[]);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    // scroll to hash section
    if (location.hash) {
      const el = document.querySelector(location.hash);
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: u.user.id,
      display_name: displayName.trim() || null,
      state: state || null,
      default_subject: subject || null,
      default_grade: grade || null,
    });
    if (error) {
      setSavingProfile(false);
      toast.error(error.message);
      return;
    }

    // Auto-enroll the teacher in the matching subject "department" by ensuring
    // a teacher_disciplines row exists. This is what powers /app/department.
    let deptJoined = false;
    if (subject && grade) {
      const { data: existing } = await supabase
        .from("teacher_disciplines")
        .select("id")
        .eq("teacher_id", u.user.id)
        .eq("subject", subject)
        .eq("grade", grade)
        .eq("state", state || "")
        .maybeSingle();
      if (!existing) {
        const isFirst = disciplines.length === 0;
        const { error: discErr } = await supabase.from("teacher_disciplines").insert({
          teacher_id: u.user.id,
          state: state || "",
          subject,
          grade,
          framework: "CUSTOM",
          is_default: isFirst,
        });
        if (!discErr) {
          deptJoined = true;
          load();
        }
      }
    }

    setSavingProfile(false);
    toast.success(deptJoined ? `Profile saved · joined ${subject} department` : "Profile saved");
  }

  async function saveCanvas(e: React.FormEvent) {
    e.preventDefault();
    if (!baseUrl.trim() || !token.trim()) { toast.error("Both fields required"); return; }
    setSavingCanvas(true);
    const { data, error } = await supabase.functions.invoke("canvas-save-token", {
      body: { base_url: baseUrl.trim(), api_token: token.trim() },
    });
    setSavingCanvas(false);
    if (error) { toast.error((error as any).message ?? "Failed to save"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    toast.success(`Connected as ${(data as any).canvas_user?.name ?? "Canvas user"}`);
    setToken("");
    setCanvasConnected(true);
  }

  // Legacy single-shot seeder removed — see per-discipline "Seed" / "Re-seed" buttons above.


  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("teacher_settings").upsert({
      teacher_id: u.user.id,
      mastery_threshold: threshold / 100,
      attempt_window: windowN,
    });
    setSavingSettings(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  }

  async function updateAutoArchive(next: boolean) {
    setAutoArchive(next); // optimistic
    setSavingArchive(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSavingArchive(false); return; }
    const { error } = await supabase.from("teacher_settings").upsert({
      teacher_id: u.user.id,
      auto_archive_enabled: next,
    });
    setSavingArchive(false);
    if (error) {
      setAutoArchive(!next);
      toast.error(error.message);
    } else {
      toast.success(next ? "Auto-archive enabled" : "Auto-archive disabled");
    }
  }
  async function addDisciplines() {
    const fw = getFramework(newFramework);
    if (!fw.national && !newState) { toast.error("Pick a state"); return; }
    if (newSubjects.length === 0 || newGrades.length === 0) {
      toast.error("Pick at least one subject and one grade");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setAddingDisc(true);

    const stateForRow = fw.national ? (newState || "") : newState;
    const isFirst = disciplines.length === 0;
    const rows: Array<{
      teacher_id: string; state: string; subject: string; grade: string;
      is_default: boolean; framework: string;
    }> = [];
    for (const s of newSubjects) {
      for (const g of newGrades) {
        rows.push({
          teacher_id: u.user.id,
          state: stateForRow,
          subject: s,
          grade: g,
          framework: newFramework,
          is_default: false,
        });
      }
    }
    if (isFirst && rows.length > 0) rows[0].is_default = true;

    // Insert one-by-one so duplicates (unique-index violation) don't block the rest
    let inserted = 0, dupes = 0, failed = 0;
    for (const r of rows) {
      const { error } = await supabase.from("teacher_disciplines").insert(r);
      if (!error) inserted++;
      else if ((error as any).code === "23505") dupes++;
      else failed++;
    }
    setAddingDisc(false);
    if (inserted > 0) toast.success(`Added ${inserted} discipline${inserted === 1 ? "" : "s"}${dupes ? ` · ${dupes} already existed` : ""}`);
    else if (dupes > 0) toast.info(`All ${dupes} already existed`);
    if (failed > 0) toast.error(`${failed} failed to add`);

    setNewSubjects([]); setNewGrades([]);
    load();
  }

  async function removeDiscipline(id: string) {
    const { error } = await supabase.from("teacher_disciplines").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Discipline removed");
    load();
  }

  async function makeDefault(id: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error: e1 } = await supabase
      .from("teacher_disciplines").update({ is_default: false }).eq("teacher_id", u.user.id).eq("is_default", true);
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await supabase
      .from("teacher_disciplines").update({ is_default: true }).eq("id", id);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Default discipline updated");
    load();
  }

  async function saveEditDiscipline(updated: Discipline) {
    const { error } = await supabase.from("teacher_disciplines").update({
      framework: updated.framework ?? "STATE",
      state: updated.state,
      subject: updated.subject,
      grade: updated.grade,
    }).eq("id", updated.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Discipline updated");
    setEditing(null);
    load();
  }

  async function seedDiscipline(d: Discipline, replace = false) {
    setSeedingDiscId(d.id);
    const { data, error } = await supabase.functions.invoke("seed-standards", {
      body: {
        framework: d.framework ?? "STATE",
        state: d.state,
        subject: d.subject,
        grade: d.grade,
        replace,
      },
    });
    setSeedingDiscId(null);
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    if ((data as any).skipped) toast.info(`Already seeded (${(data as any).existing} standards). Use Re-seed to replace.`);
    else toast.success(`Seeded ${(data as any).inserted} standards`);
  }

  const newFrameworkMeta = useMemo(() => getFramework(newFramework), [newFramework]);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Settings</h1>
        <p className="text-muted-foreground">Profile, Canvas connection, standards, and mastery rules.</p>
      </div>

      {/* PROFILE */}
      <Card id="profile">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your state, subject and grade determine which standards are loaded.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dn">Preferred name</Label>
                <Input
                  id="dn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  placeholder="What should we call you?"
                />
                <p className="text-xs text-muted-foreground">
                  Shown on your dashboard greeting. If left blank, we'll use your email.
                </p>
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grade</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</Button>
          </form>
        </CardContent>
      </Card>

      {/* CANVAS */}
      <Card id="canvas">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Canvas connection
            {canvasConnected && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-mastery-high/10 text-mastery-high"><Check className="h-3 w-3" /> Connected</span>}
          </CardTitle>
          <CardDescription>Each teacher uses their own personal Canvas API token.</CardDescription>
        </CardHeader>
        <CardContent>
          <details className="mb-4 rounded-md border p-3 text-sm bg-muted/40">
            <summary className="cursor-pointer font-medium">How to get your Canvas API token (1 minute)</summary>
            <ol className="list-decimal pl-5 mt-3 space-y-1 text-muted-foreground">
              <li>In Canvas, click your profile avatar → <strong>Account</strong> → <strong>Settings</strong>.</li>
              <li>Scroll to <strong>Approved Integrations</strong> → click <strong>+ New Access Token</strong>.</li>
              <li>Purpose: "StandardsTrack". Leave expiry blank (or 1 year). Click <strong>Generate Token</strong>.</li>
              <li>Copy the token — it's shown only once — and paste it below.</li>
              <li>Your <strong>Canvas URL</strong> is the address you see in your browser when in Canvas (e.g. <code>district.instructure.com</code>).</li>
            </ol>
          </details>
          <form onSubmit={saveCanvas} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bu">Canvas URL</Label>
              <Input id="bu" placeholder="district.instructure.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tk">API token {canvasConnected && <span className="text-muted-foreground text-xs">(replace existing)</span>}</Label>
              <Input id="tk" type="password" placeholder="Paste your token" value={token} onChange={(e) => setToken(e.target.value)} />
              <p className="text-xs text-muted-foreground">Stored encrypted. Only used by our server to talk to Canvas — never sent back to your browser.</p>
            </div>
            <Button type="submit" disabled={savingCanvas}>
              {savingCanvas && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {canvasConnected ? "Update token" : "Connect Canvas"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* DISCIPLINES (multi) */}
      <Card id="disciplines">
        <CardHeader>
          <CardTitle>What I teach</CardTitle>
          <CardDescription>
            Add every <strong>framework · subject · grade</strong> you teach. Each course on the Courses page can be tagged with one of these so the AI uses the right standards library.
            You can mix state-specific standards (e.g. Idaho Science) and national frameworks (e.g. NGSS, Common Core) side-by-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {disciplines.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No disciplines yet. Add your first below.
            </div>
          ) : (
            <div className="space-y-2">
              {disciplines.map((d) => {
                const fw = getFramework(d.framework);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[11px] font-medium"
                        title={fw.description}
                      >
                        {fw.shortLabel}
                      </Badge>
                      <span className="font-medium">{d.subject}</span>
                      <span className="text-muted-foreground">·</span>
                      <span>Grade {d.grade}</span>
                      {d.state && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span>{d.state}</span>
                        </>
                      )}
                      {d.is_default && (
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <Star className="h-2.5 w-2.5" /> default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!d.is_default && (
                        <Button size="sm" variant="ghost" onClick={() => makeDefault(d.id)} title="Make default">
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(d)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {fw.seedable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => seedDiscipline(d)}
                          disabled={seedingDiscId === d.id}
                          title="Seed standards for this discipline"
                        >
                          {seedingDiscId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Seed"}
                        </Button>
                      )}
                      {fw.seedable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Replace the existing ${fw.shortLabel} ${d.subject} grade ${d.grade} standards library? This deletes the shared seeded standards and re-asks the AI.`)) {
                              seedDiscipline(d, true);
                            }
                          }}
                          disabled={seedingDiscId === d.id}
                          title="Re-seed (replace existing)"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setImportDefaults({ framework: (d.framework ?? "CUSTOM") as any, state: d.state, subject: d.subject, grade: d.grade });
                          setImportOpen(true);
                        }}
                        title="Import standards from URL or PDF"
                      >
                        <FileUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeDiscipline(d.id)} title="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MULTI-PICK ADD FORM */}
          <div className="rounded-md border p-4 space-y-4 bg-muted/20">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Standards framework</Label>
                <Select value={newFramework} onValueChange={(v) => setNewFramework(v as FrameworkId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FRAMEWORKS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{newFrameworkMeta.description}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  State {newFrameworkMeta.national && <span className="text-muted-foreground">(optional — {newFrameworkMeta.shortLabel} is national)</span>}
                </Label>
                <Select value={newState} onValueChange={setNewState}>
                  <SelectTrigger><SelectValue placeholder={newFrameworkMeta.national ? "Optional" : "State"} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Subjects (pick one or more)</Label>
              <ChipMultiSelect
                options={SUBJECTS}
                selected={newSubjects}
                onChange={setNewSubjects}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Grades (pick one or more)</Label>
              <ChipMultiSelect
                options={GRADES}
                selected={newGrades}
                onChange={setNewGrades}
                gridCols={7}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {newSubjects.length > 0 && newGrades.length > 0
                  ? `Will add ${newSubjects.length * newGrades.length} discipline${newSubjects.length * newGrades.length === 1 ? "" : "s"} (existing combos are skipped).`
                  : "Pick at least one subject and one grade."}
              </p>
              <Button
                onClick={addDisciplines}
                disabled={
                  addingDisc ||
                  newSubjects.length === 0 ||
                  newGrades.length === 0 ||
                  (!newFrameworkMeta.national && !newState)
                }
              >
                {addingDisc && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Plus className="h-4 w-4 mr-1" /> Add disciplines
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IMPORT STANDARDS (standalone) */}
      <Card id="import-standards">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4" /> Import standards from a website or PDF
          </CardTitle>
          <CardDescription>
            Don't see your framework in the list? Paste a URL to your state's standards page, or upload an official PDF (e.g. an Idaho SDE Essential Standards guide). The AI will pull every standard out, you'll review the list, and they'll be saved to your private library.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              setImportDefaults(undefined);
              setImportOpen(true);
            }}
          >
            <FileUp className="h-4 w-4 mr-2" /> Open importer
          </Button>
        </CardContent>
      </Card>

      {/* IMPORT DIALOG */}
      <ImportStandardsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaults={importDefaults}
        onImported={() => load()}
      />
      {/* EDIT DIALOG */}
      {editing && (
        <EditDisciplineDialog
          discipline={editing}
          onClose={() => setEditing(null)}
          onSave={saveEditDiscipline}
        />
      )}

      {/* MASTERY RULES */}
      <Card id="mastery">
        <CardHeader>
          <CardTitle>Mastery rules</CardTitle>
          <CardDescription>How "mastered" is calculated.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Mastery threshold</Label>
                <span className="text-sm font-medium tabular-nums">{threshold}%</span>
              </div>
              <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={50} max={100} step={5} />
              <p className="text-xs text-muted-foreground">A student is "mastering" a standard when their average is at or above this.</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Attempt window</Label>
                <span className="text-sm font-medium tabular-nums">{windowN} most recent</span>
              </div>
              <Slider value={[windowN]} onValueChange={(v) => setWindowN(v[0])} min={1} max={10} step={1} />
              <p className="text-xs text-muted-foreground">We look at the most recent N attempts on items tagged with each standard.</p>
            </div>
            <Button type="submit" disabled={savingSettings}>{savingSettings ? "Saving…" : "Save mastery rules"}</Button>
          </form>
        </CardContent>
      </Card>

      {/* AUTO-ARCHIVE */}
      <Card id="auto-archive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Auto-archive past school years
          </CardTitle>
          <CardDescription>
            When Canvas marks a course completed <strong>and</strong> the school year that course belonged to has ended (June 9), the course and its students are automatically moved out of your default views. You'll still see every student you've taught this school year regardless of trimester. Archived data is never deleted — open it any time from the Student History page or by toggling "Show historical" on Mastery and Analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="auto-archive"
              checked={autoArchive}
              onCheckedChange={updateAutoArchive}
              disabled={savingArchive}
            />
            <Label htmlFor="auto-archive" className="cursor-pointer">
              {autoArchive ? "Auto-archive is on" : "Auto-archive is off"}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* MERGE STUDENT RECORDS */}
      <MergeStudentsCard />

      {/* INVITATIONS */}
      <InvitationsCard />
    </div>
  );
}

// ----- Helper components -----

function ChipMultiSelect({
  options, selected, onChange, gridCols = 4,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  gridCols?: number;
}) {
  const set = new Set(selected);
  function toggle(v: string) {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    // Preserve original option order
    onChange(options.filter((o) => next.has(o)));
  }
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = set.has(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={
              "px-2 py-1 rounded-md text-xs border transition-colors " +
              (active
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-background text-foreground/80 border-border hover:bg-muted")
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function EditDisciplineDialog({
  discipline, onClose, onSave,
}: {
  discipline: { id: string; state: string; subject: string; grade: string; framework: string | null; is_default: boolean };
  onClose: () => void;
  onSave: (d: { id: string; state: string; subject: string; grade: string; framework: string | null; is_default: boolean }) => void;
}) {
  const [framework, setFramework] = useState<FrameworkId>((discipline.framework as FrameworkId) || "STATE");
  const [stateVal, setStateVal] = useState(discipline.state || "");
  const [subjectVal, setSubjectVal] = useState(discipline.subject);
  const [gradeVal, setGradeVal] = useState(discipline.grade);
  const fwMeta = getFramework(framework);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit discipline</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Standards framework</Label>
            <Select value={framework} onValueChange={(v) => setFramework(v as FrameworkId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FRAMEWORKS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{fwMeta.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">State {fwMeta.national && <span className="text-muted-foreground">(opt.)</span>}</Label>
              <Select value={stateVal} onValueChange={setStateVal}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Select value={subjectVal} onValueChange={setSubjectVal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Grade</Label>
              <Select value={gradeVal} onValueChange={setGradeVal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({
              ...discipline,
              framework,
              state: fwMeta.national ? stateVal : stateVal,
              subject: subjectVal,
              grade: gradeVal,
            })}
            disabled={!subjectVal || !gradeVal || (!fwMeta.national && !stateVal)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

