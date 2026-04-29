import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { ArrowRightLeft, BarChart3, BookMarked, Building2, CheckCheck, GraduationCap, History, Layers, LayoutDashboard, Library, ListChecks, Menu, Settings as SettingsIcon, Shield } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { SyncProvider, SyncStatusPill } from "@/contexts/SyncContext";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/classes", label: "Classes", icon: GraduationCap },
  { to: "/app/assignments", label: "Assignments", icon: ListChecks },
  { to: "/app/assignment-groups", label: "Assignment Groups", icon: Layers },
  { to: "/app/review", label: "Tag Review", icon: CheckCheck },
  { to: "/app/standards", label: "Standards", icon: BookMarked },
  { to: "/app/question-bank", label: "Question Bank", icon: Library },
  { to: "/app/student-history", label: "Student History", icon: History },
  { to: "/app/department", label: "Department", icon: Building2 },
  { to: "/app/mastery-connect", label: "Mastery Connect", icon: ArrowRightLeft },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

function NavList({ items, onNavigate, userEmail, onSignOut }: {
  items: typeof nav;
  onNavigate?: () => void;
  userEmail: string;
  onSignOut: () => void;
}) {
  return (
    <>
      <Link to="/app" onClick={onNavigate} className="px-6 py-6 border-b border-sidebar-border block">
        <div className="font-display text-2xl text-sidebar-foreground">StandardsTrack</div>
        <div className="text-xs text-sidebar-foreground/60 mt-1 font-medium">Mastery for Canvas teachers</div>
      </Link>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
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
        <div className="text-xs text-sidebar-foreground/60 truncate mb-2">{userEmail}</div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full rounded-full"
          onClick={onSignOut}
        >
          Sign out
        </Button>
      </div>
    </>
  );
}

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const items = [...nav, ...(isAdmin ? [{ to: "/app/admin", label: "Admin", icon: Shield, end: false as const }] : [])];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <SyncProvider>
      <div className="min-h-screen md:flex bg-paper p-2 sm:p-4 gap-4">
        <SyncStatusPill />

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between bg-sidebar text-sidebar-foreground rounded-2xl border border-sidebar-border shadow-soft px-3 py-2 mb-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation" className="text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">Main app navigation</SheetDescription>
              <NavList
                items={items}
                onNavigate={() => setMobileOpen(false)}
                userEmail={user.email ?? ""}
                onSignOut={handleSignOut}
              />
            </SheetContent>
          </Sheet>
          <Link to="/app" className="font-display text-lg">StandardsTrack</Link>
          <div className="w-9" aria-hidden />
        </header>

        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col rounded-[1.75rem] shadow-soft border border-sidebar-border">
          <NavList items={items} userEmail={user.email ?? ""} onSignOut={handleSignOut} />
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
