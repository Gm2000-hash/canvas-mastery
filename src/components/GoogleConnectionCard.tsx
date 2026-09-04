// Settings → Google connection: connect/disconnect the teacher's own Google
// account (Classroom, Drive, Docs, Forms) and set the default quiz format.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, Loader2, Unplug } from "lucide-react";
import { handleGoogleReturn, useGoogleConnection } from "@/hooks/useGoogleConnection";

type GCourse = { id: string; name: string; section: string | null; state: string | null; link: string | null };

export function GoogleConnectionCard() {
  const { status, busy, connect, disconnect, refresh } = useGoogleConnection();
  const [courses, setCourses] = useState<GCourse[] | null>(null);
  const [courseErr, setCourseErr] = useState<string | null>(null);
  const [quizTarget, setQuizTarget] = useState<"form" | "doc">("form");

  useEffect(() => { if (handleGoogleReturn() === "connected") refresh(); }, [refresh]);

  useEffect(() => {
    supabase.from("teacher_settings").select("google_quiz_target").maybeSingle().then(({ data }) => {
      if ((data as any)?.google_quiz_target) setQuizTarget((data as any).google_quiz_target);
    });
  }, []);

  useEffect(() => {
    if (!status?.connected) { setCourses(null); return; }
    supabase.functions.invoke("google-classroom-list-courses", { body: {} }).then(({ data, error }) => {
      const msg = (error as any)?.message ?? (data as any)?.error;
      if (msg) { setCourseErr(String(msg)); setCourses([]); return; }
      setCourseErr(null);
      setCourses(((data as any)?.courses ?? []) as GCourse[]);
    });
  }, [status?.connected]);

  async function saveQuizTarget(v: "form" | "doc") {
    setQuizTarget(v);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("teacher_settings").upsert({ teacher_id: u.user.id, google_quiz_target: v }, { onConflict: "teacher_id" });
    if (error) toast.error(error.message); else toast.success("Saved");
  }

  return (
    <Card id="google">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Google connection
          {status?.connected && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-mastery-high/10 text-mastery-high"><Check className="h-3 w-3" /> Connected</span>}
        </CardTitle>
        <CardDescription>Connect your own Google account to import from Google Classroom and send resources back as Docs, Forms and Classroom assignments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</div>
        ) : !status.connected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">A Google window will open asking you to allow access to Classroom, Drive, Docs and Forms. Only our server talks to Google — your tokens are stored encrypted and never sent to your browser.</p>
            <Button onClick={connect} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Connect Google</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border p-3">
              <div className="text-sm">
                <div className="font-medium">{status.email ?? "Google account"}</div>
                {status.connectedAt && <div className="text-xs text-muted-foreground">Connected {new Date(status.connectedAt).toLocaleDateString()}</div>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={connect} disabled={busy}>Reconnect</Button>
                <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}><Unplug className="h-4 w-4 mr-1.5" /> Disconnect</Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Classroom courses</Label>
              {courses === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : courseErr ? (
                <p className="text-sm text-destructive">{courseErr}</p>
              ) : courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No courses found where you're a teacher.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {courses.map((c) => (
                    <Badge key={c.id} variant={c.state === "ACTIVE" ? "secondary" : "outline"} className="font-normal gap-1">
                      {c.name}{c.section ? ` · ${c.section}` : ""}
                      {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer" aria-label="Open in Classroom"><ExternalLink className="h-3 w-3" /></a>}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Label className="text-sm">Default format for quizzes sent to Google</Label>
                <p className="text-xs text-muted-foreground">You can still change it each time you send.</p>
              </div>
              <Select value={quizTarget} onValueChange={(v) => saveQuizTarget(v as "form" | "doc")}>
                <SelectTrigger className="w-64 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="form">Google Form (auto-graded quiz)</SelectItem>
                  <SelectItem value="doc">Google Doc (printable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
