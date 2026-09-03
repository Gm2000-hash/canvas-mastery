import { Link } from "react-router-dom";
import { Clock, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/ProfileContext";

export default function PendingApproval() {
  const { profile } = useProfile();
  return (
    <div className="max-w-xl mx-auto py-16 text-center space-y-6">
      <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
        <Clock className="h-7 w-7 text-accent" />
      </div>
      <h1 className="font-display text-3xl text-primary">Waiting for admin approval</h1>
      <p className="text-muted-foreground">
        You asked for <strong>Principal</strong> access{profile?.school ? <> at <strong>{profile.school}</strong></> : null}.
        An administrator needs to approve the request before building-level analytics are unlocked.
        You'll get access automatically the next time you sign in after approval.
      </p>
      <div className="flex justify-center gap-3">
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/app/settings"><SettingsIcon className="h-4 w-4 mr-1.5" /> Settings</Link>
        </Button>
        <Button className="rounded-full" onClick={() => window.location.reload()}>Check again</Button>
      </div>
    </div>
  );
}
