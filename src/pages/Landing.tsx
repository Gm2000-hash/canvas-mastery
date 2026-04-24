import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookMarked, GraduationCap, Sparkles, Workflow } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="font-display text-2xl font-semibold">StandardsTrack</div>
        <nav className="flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button>Get started</Button></Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-12 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-6">
            <Sparkles className="h-3 w-3" /> Built for the Canvas + Mastery Connect gap
          </div>
          <h1 className="font-display text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight mb-6">
            Track standards mastery <span className="text-accent">without leaving Canvas</span>.
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg">
            One assignment can hit multiple standards. One quiz question can stand on its own.
            Connect your Canvas account, let AI suggest the tags, confirm in seconds, and watch every student's growth.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-hero opacity-10 rounded-3xl blur-2xl" />
          <div className="relative bg-card rounded-2xl p-6 shadow-card border">
            <div className="text-xs text-muted-foreground mb-3">Class mastery — 7th grade math</div>
            <div className="space-y-2">
              {[
                { code: "7.RP.A.2", label: "Recognize proportional relationships", val: 0.78 },
                { code: "7.NS.A.1", label: "Add/subtract rational numbers", val: 0.92 },
                { code: "7.EE.B.4", label: "Solve real-world equations", val: 0.54 },
                { code: "7.G.B.6", label: "Solve volume/surface area", val: 0.68 },
              ].map((s) => (
                <div key={s.code} className="flex items-center gap-3 text-sm">
                  <div className="w-24 font-mono text-xs text-muted-foreground">{s.code}</div>
                  <div className="flex-1 truncate text-foreground/80">{s.label}</div>
                  <div className="w-32 h-2 rounded-full bg-mastery-bg overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.val * 100}%`,
                        background: s.val >= 0.8 ? "hsl(var(--mastery-high))"
                          : s.val >= 0.6 ? "hsl(var(--mastery-mid))"
                          : "hsl(var(--mastery-low))",
                      }}
                    />
                  </div>
                  <div className="w-10 text-right tabular-nums text-xs">{Math.round(s.val * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        {[
          { icon: GraduationCap, title: "Sync from Canvas", body: "Paste your Canvas API token once. Courses, students, assignments, and scores flow in automatically." },
          { icon: Sparkles, title: "AI standards tagging", body: "AI reads each assignment and suggests the right state standards. You confirm — it never auto-applies." },
          { icon: BookMarked, title: "Multiple standards, per item", body: "One assignment, many standards. One quiz with per-question tagging. Mastery is computed across all of it." },
        ].map((f) => (
          <div key={f.title} className="bg-card border rounded-xl p-6 shadow-soft">
            <f.icon className="h-6 w-6 text-accent mb-3" />
            <div className="font-display text-xl font-semibold mb-2">{f.title}</div>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <Workflow className="h-8 w-8 mx-auto text-accent mb-4" />
        <h2 className="font-display text-3xl font-semibold mb-3">No more recreating content in Mastery Connect.</h2>
        <p className="text-muted-foreground mb-6">
          Your Canvas content stays in Canvas. StandardsTrack does the standard-level tracking that
          Canvas can't and Mastery Connect makes painful.
        </p>
        <Link to="/auth"><Button size="lg">Connect your Canvas account</Button></Link>
      </section>

      <footer className="border-t mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-muted-foreground flex justify-between">
          <div>© {new Date().getFullYear()} StandardsTrack</div>
          <div>Built for public school teachers.</div>
        </div>
      </footer>
    </div>
  );
}
