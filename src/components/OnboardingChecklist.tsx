// First-login getting-started checklist for the dashboard.
// Three steps: pick a discipline → connect Canvas → import courses.
// Auto-hides once all three are complete or the teacher dismisses it.
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";

type StepKey = "discipline" | "canvas" | "courses";

type Step = {
  key: StepKey;
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  done: boolean;
};

type Props = {
  /** Called after the card auto-hides or is dismissed, so the parent can re-render. */
  onChange?: () => void;
};

export function OnboardingChecklist({ onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const [profileRes, discRes, ccRes, courseRes] = await Promise.all([
      supabase.from("profiles").select("onboarding_dismissed_at").eq("id", userId).maybeSingle(),
      supabase.from("teacher_disciplines").select("id", { count: "exact", head: true }),
      supabase.rpc("get_canvas_connection_status"),
      supabase.from("courses").select("id", { count: "exact", head: true })
        .eq("hidden", false).is("archived_at", null),
    ]);

    if (profileRes.data?.onboarding_dismissed_at) {
      setHidden(true);
      setLoading(false);
      return;
    }

    const cc = Array.isArray(ccRes.data) ? ccRes.data[0] : null;
    const discDone = (discRes.count ?? 0) > 0;
    const canvasDone = !!(cc as any)?.connected;
    const coursesDone = (courseRes.count ?? 0) > 0;

    const next: Step[] = [
      {
        key: "discipline",
        title: "Pick what you teach",
        subtitle: "Choose your subject and grade — we'll auto-load the matching standards library.",
        cta: "Open disciplines",
        to: "/app/settings#disciplines",
        done: discDone,
      },
      {
        key: "canvas",
        title: "Connect Canvas",
        subtitle: "Paste your Canvas URL and access token so we can sync your courses.",
        cta: "Connect Canvas",
        to: "/app/settings#canvas",
        done: canvasDone,
      },
      {
        key: "courses",
        title: "Import your courses",
        subtitle: "Pick which Canvas courses to track — students, assignments, and scores follow.",
        cta: "Go to courses",
        to: "/app/courses",
        done: coursesDone,
      },
    ];
    setSteps(next);

    // Auto-dismiss once all steps are complete (silently) so the card disappears for good.
    if (next.every((s) => s.done)) {
      await supabase.from("profiles")
        .update({ onboarding_dismissed_at: new Date().toISOString() })
        .eq("id", userId);
      setHidden(true);
      onChange?.();
    }
    setLoading(false);
  }, [onChange]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onCustom = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("onboarding:refresh", onCustom);
    window.addEventListener("canvas-sync:done", onCustom);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("onboarding:refresh", onCustom);
      window.removeEventListener("canvas-sync:done", onCustom);
    };
  }, [refresh]);

  async function dismiss() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    await supabase.from("profiles")
      .update({ onboarding_dismissed_at: new Date().toISOString() })
      .eq("id", userId);
    setHidden(true);
    onChange?.();
  }

  if (hidden) return null;
  if (loading) return <Skeleton className="h-44" />;

  const completed = steps.filter((s) => s.done).length;

  return (
    <Card className="border-accent/40 bg-gradient-to-br from-accent/5 to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <CardTitle className="text-lg">Get started</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {completed}/{steps.length} complete
            </span>
          </div>
          <CardDescription>Three quick steps to start tracking mastery.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.key}
            className={`flex items-start gap-3 rounded-md border p-3 ${
              step.done ? "bg-mastery-high/5 border-mastery-high/30" : "bg-card"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-mastery-high" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-code text-muted-foreground tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`font-medium ${step.done ? "line-through text-muted-foreground" : ""}`}>
                  {step.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{step.subtitle}</p>
            </div>
            {!step.done && (
              <Link to={step.to} className="shrink-0">
                <Button size="sm" variant={i === completed ? "default" : "outline"}>
                  {step.cta}
                </Button>
              </Link>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
