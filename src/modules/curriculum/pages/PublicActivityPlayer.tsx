import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "@/modules/curriculum/config/router";
import { ActivityPlayer } from "@/modules/curriculum/components/activities/ActivityPlayer";
import { Button } from "@/components/ui/button";
import { useLtiSession } from "@/modules/curriculum/config/lti-session";
import { Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import type { ActivityType, ActivityContent } from "@/modules/curriculum/lib/h5p-types";

interface ActivityData {
  id: string;
  title: string;
  activity_type: string;
  content: any;
}

/**
 * Public activity player for LTI launches and embed playback.
 * No authentication required — fetches activity data via a public edge function.
 */
export default function PublicActivityPlayer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isLtiLaunch, postScore, scorePosted, posting } = useLtiSession();

  useEffect(() => {
    if (!id) return;

    const ltiSession = searchParams.get("lti_session");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const params = new URLSearchParams({ id });
    if (ltiSession) params.set("lti_session", ltiSession);

    fetch(`${supabaseUrl}/functions/v1/lti-activity?${params}`, {
      headers: { apikey: anonKey, "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setActivity(data.activity);
          if (data.ltiInfo) {
            setStudentName(data.ltiInfo.studentName);
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, searchParams]);

  const handleSubmitScore = () => {
    if (isLtiLaunch) {
      // Post full marks for completion (activity was completed by interacting)
      postScore(100, 100, id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-md px-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Activity Not Found</h1>
          <p className="text-sm text-muted-foreground">{error || "This activity doesn't exist or has been removed."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal header */}
      <header className="h-12 border-b border-border/60 bg-card flex items-center px-4 gap-3">
        <h1 className="text-sm font-semibold text-foreground truncate flex-1">{activity.title}</h1>
        {studentName && (
          <span className="text-xs text-muted-foreground">
            Playing as <strong>{studentName}</strong>
          </span>
        )}
        {isLtiLaunch && scorePosted && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> Score sent
          </span>
        )}
        {isLtiLaunch && posting && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending score...
          </span>
        )}
      </header>

      <main className="flex-1 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-3xl">
          <ActivityPlayer
            type={activity.activity_type as ActivityType}
            content={activity.content as ActivityContent}
          />

          {/* LTI score submission */}
          {isLtiLaunch && !scorePosted && (
            <div className="mt-6 p-4 bg-muted/50 border border-border rounded-xl text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                When you've finished the activity, submit your completion to Canvas.
              </p>
              <Button onClick={handleSubmitScore} disabled={posting} className="gap-2">
                {posting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="h-4 w-4" /> Submit to Canvas</>
                )}
              </Button>
            </div>
          )}

          {isLtiLaunch && scorePosted && (
            <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-center">
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Score submitted to Canvas!</p>
              <p className="text-xs text-muted-foreground mt-1">You can close this window or return to Canvas.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
