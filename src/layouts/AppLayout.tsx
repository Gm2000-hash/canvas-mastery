import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { BarChart3, BookMarked, CheckCheck, GraduationCap, LayoutDashboard, ListChecks, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncProvider, SyncStatusPill } from "@/contexts/SyncContext";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/courses", label: "Courses", icon: GraduationCap },
  { to: "/app/assignments", label: "Assignments", icon: ListChecks },
  { to: "/app/review", label: "Tag Review", icon: CheckCheck },
  { to: "/app/standards", label: "Standards", icon: BookMarked },
  { to: "/app/mastery", label: "Mastery", icon: Sparkles },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <SyncProvider>
    <div className="min-h-screen flex bg-paper">
      <SyncStatusPill />
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <Link to="/app" className="px-6 py-6 border-b border-sidebar-border">
          <div className="font-display text-2xl font-semibold text-sidebar-foreground">StandardsTrack</div>
          <div className="text-xs text-sidebar-foreground/60 mt-1">Mastery for Canvas teachers</div>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60 truncate mb-2">{user.email}</div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth", { replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
    </SyncProvider>
  );
}
