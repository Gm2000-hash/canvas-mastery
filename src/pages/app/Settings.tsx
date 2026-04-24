import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2 } from "lucide-react";

const SUBJECTS = ["Math", "ELA", "Science", "Social Studies"];
const GRADES = ["6", "7", "8"];
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

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
  const [savingSettings, setSavingSettings] = useState(false);

  // Standards seeding
  const [seeding, setSeeding] = useState(false);

  async function load() {
    const [{ data: profile }, { data: cc }, { data: settings }] = await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase.from("canvas_connection_status").select("*").maybeSingle(),
      supabase.from("teacher_settings").select("*").maybeSingle(),
    ]);
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setState(profile.state ?? "");
      setSubject(profile.default_subject ?? "");
      setGrade(profile.default_grade ?? "");
    }
    if (cc) {
      setBaseUrl(cc.base_url ?? "");
      setCanvasConnected(!!cc.connected);
    }
    if (settings) {
      setThreshold(Math.round((settings.mastery_threshold ?? 0.8) * 100));
      setWindowN(settings.attempt_window ?? 3);
    }
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
    setSavingProfile(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
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

  async function seedStandards() {
    if (!state || !subject || !grade) { toast.error("Save your state/subject/grade first"); return; }
    setSeeding(true);
    const { data, error } = await supabase.functions.invoke("seed-standards", {
      body: { state, subject, grade },
    });
    setSeeding(false);
    if (error) { toast.error((error as any).message ?? "Failed"); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    if ((data as any).skipped) toast.info(`Already seeded (${(data as any).existing} standards available)`);
    else toast.success(`Seeded ${(data as any).inserted} standards`);
  }

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

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-4xl font-semibold mb-2">Settings</h1>
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
                <Label htmlFor="dn">Display name</Label>
                <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
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

      {/* STANDARDS SEED */}
      <Card id="standards">
        <CardHeader>
          <CardTitle>Seed your standards library</CardTitle>
          <CardDescription>Loads the official content standards for your state/subject/grade. You can add or edit individual standards on the Standards page.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={seedStandards} disabled={seeding || !state || !subject || !grade}>
            {seeding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {seeding ? "Seeding…" : `Seed ${state || "?"} ${subject || "?"} ${grade || "?"} standards`}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Tip: if your district uses non-standard codes, you can also add custom standards on the
            Standards page or upload a CSV later. <ExternalLink className="inline h-3 w-3" />
          </p>
        </CardContent>
      </Card>

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
    </div>
  );
}
