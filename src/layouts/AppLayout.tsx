import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { BarChart3, BookMarked, CheckCheck, GraduationCap, History, Layers, LayoutDashboard, Library, ListChecks, Settings as SettingsIcon, Shield, Sparkles } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { SyncProvider, SyncStatusPill } from "@/contexts/SyncContext";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/courses", label: "Courses", icon: GraduationCap },
  { to: "/app/assignments", label: "Assignments", icon: ListChecks },
  { to: "/app/assignment-groups", label: "Assignment Groups", icon: Layers },
  { to: "/app/review", label: "Tag Review", icon: CheckCheck },
  { to: "/app/standards", label: "Standards", icon: BookMarked },
  { to: "/app/question-bank", label: "Question Bank", icon: Library },
  { to: "/app/mastery", label: "Mastery", icon: Sparkles },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/student-history", label: "Student History", icon: History },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { isAdmin } = useIsAdmin();
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
    <div className="min-h-screen flex bg-paper p-4 gap-4">
      <SyncStatusPill />
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col rounded-[1.75rem] shadow-soft border border-sidebar-border">
        <Link to="/app" className="px-6 py-6 border-b border-sidebar-border">
          <div className="font-display text-2xl text-sidebar-foreground">StandardsTrack</div>
          <div className="text-xs text-sidebar-foreground/60 mt-1 font-medium">Mastery for Canvas teachers</div>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[...nav, ...(isAdmin ? [{ to: "/app/admin", label: "Admin", icon: Shield, end: false as const }] : [])].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
            className="w-full rounded-full"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth", { replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 bg-card rounded-[1.75rem] shadow-soft border overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-8 sm:py-10">
          <Outlet />
        </div>
      </main>
    </div>
    </SyncProvider>
  );
}
