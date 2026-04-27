import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookMarked, GraduationCap, Heart, Sparkles, Workflow } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Floating pill nav */}
      <header className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between bg-card/70 backdrop-blur rounded-full pl-6 pr-2 py-2 shadow-soft border">
          <div className="font-display text-xl text-primary">StandardsTrack</div>
          <nav className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost" className="rounded-full">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6">
                Get started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — two-up: peach card + preview card */}
      <section className="max-w-7xl mx-auto px-6 pt-8 pb-16 grid lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: huge headline in peach card */}
        <div className="bg-hero-card rounded-[2rem] p-10 lg:p-14 flex flex-col justify-between min-h-[520px] relative overflow-hidden">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/60 text-primary text-xs font-bold tracking-wide uppercase mb-8">
              <Sparkles className="h-3.5 w-3.5" /> Built for Canvas teachers
            </div>
            <h1 className="font-display text-[3.5rem] lg:text-[5.5rem] leading-[0.92] text-primary">
              Standards.<br />
              Mastered.<br />
              Instantly.
            </h1>
          </div>
          <div className="mt-10">
            <p className="text-lg text-primary/75 max-w-md mb-8 font-medium">
              One assignment can hit many standards. AI suggests the tags — you confirm in seconds, and every student's growth shows up automatically.
            </p>
            <Link to="/auth">
              <Button
                size="lg"
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-base font-bold"
              >
                Start free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Right: preview card with floating pill */}
        <div className="bg-card rounded-[2rem] p-8 lg:p-10 shadow-card relative min-h-[520px] flex flex-col">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Class mastery — 7th grade math
          </div>
          <div className="space-y-3 flex-1">
            {[
              { code: "7.RP.A.2", label: "Recognize proportional relationships", val: 0.78 },
              { code: "7.NS.A.1", label: "Add/subtract rational numbers", val: 0.92 },
              { code: "7.EE.B.4", label: "Solve real-world equations", val: 0.54 },
              { code: "7.G.B.6", label: "Solve volume/surface area", val: 0.68 },
              { code: "7.SP.A.1", label: "Random sampling & inference", val: 0.81 },
            ].map((s) => (
              <div key={s.code} className="flex items-center gap-3 text-sm">
                <div className="w-24 font-mono text-xs text-muted-foreground">{s.code}</div>
                <div className="flex-1 truncate text-foreground/85">{s.label}</div>
                <div className="w-32 h-2.5 rounded-full bg-mastery-bg overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.val * 100}%`,
                      background:
                        s.val >= 0.8
                          ? "hsl(var(--mastery-high))"
                          : s.val >= 0.6
                          ? "hsl(var(--mastery-mid))"
                          : "hsl(var(--mastery-low))",
                    }}
                  />
                </div>
                <div className="w-10 text-right tabular-nums text-xs font-semibold">
                  {Math.round(s.val * 100)}%
                </div>
              </div>
            ))}
          </div>

          {/* Floating pill */}
          <div className="absolute -bottom-5 -right-5 bg-pill-card rounded-full pl-4 pr-6 py-3 flex items-center gap-3 shadow-card">
            <div className="bg-card rounded-full p-2">
              <Heart className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-base font-bold text-primary leading-tight">+12% growth</div>
              <div className="text-xs text-primary/70">across your class this month</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
        {[
          {
            icon: GraduationCap,
            title: "Sync from Canvas",
            body: "Paste your Canvas API token once. Courses, students, assignments, and scores flow in automatically.",
          },
          {
            icon: Sparkles,
            title: "AI standards tagging",
            body: "AI reads each assignment and suggests the right state standards. You confirm — it never auto-applies.",
          },
          {
            icon: BookMarked,
            title: "Many standards, per item",
            body: "One assignment, many standards. One quiz with per-question tagging. Mastery is computed across all of it.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-card rounded-[1.75rem] p-8 shadow-soft">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-secondary mb-5">
              <f.icon className="h-6 w-6 text-primary" />
            </div>
            <div className="font-display text-2xl text-primary mb-2">{f.title}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      {/* CTA card */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-primary text-primary-foreground rounded-[2rem] p-12 lg:p-16 text-center relative overflow-hidden">
          <Workflow className="h-10 w-10 mx-auto text-accent mb-5" />
          <h2 className="font-display text-4xl lg:text-5xl mb-4 leading-[1.05]">
            No more rebuilding<br />in Mastery Connect.
          </h2>
          <p className="text-primary-foreground/75 mb-8 max-w-xl mx-auto text-lg">
            Your Canvas content stays in Canvas. StandardsTrack does the standard-level tracking that
            Canvas can't and Mastery Connect makes painful.
          </p>
          <Link to="/auth">
            <Button
              size="lg"
              className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-6 text-base font-bold"
            >
              Connect your Canvas account <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-6 py-10 text-sm text-muted-foreground flex flex-col sm:flex-row gap-3 justify-between">
        <div>© {new Date().getFullYear()} StandardsTrack</div>
        <div>Built for public school teachers.</div>
      </footer>
    </div>
  );
}
