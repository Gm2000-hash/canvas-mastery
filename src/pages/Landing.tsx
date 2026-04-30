import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookMarked, GraduationCap, Sparkles, Workflow } from "lucide-react";
import heroClassroom from "@/assets/hero-classroom.jpg";

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Floating pill nav */}
      <header className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between bg-card/80 backdrop-blur rounded-full pl-6 pr-2 py-2 shadow-soft border">
          <div className="font-display text-xl text-primary">StandardsTrack</div>
          <nav className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost" className="rounded-full">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 px-6">
                Get started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — full-bleed photo with floating white card */}
      <section className="max-w-7xl mx-auto px-6 pt-8 pb-20">
        <div className="relative rounded-[2.5rem] overflow-hidden min-h-[640px] lg:min-h-[720px]">
          <img
            src={heroClassroom}
            alt="Teacher at a laptop in a bright classroom with students working at desks"
            width={1920}
            height={1080}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Soft scrim for legibility on small screens */}
          <div className="absolute inset-0 bg-gradient-to-r from-paper/30 via-transparent to-transparent lg:hidden" />

          <div className="relative px-5 sm:px-10 lg:px-14 py-10 lg:py-14 flex">
            <div className="bg-card rounded-[2rem] shadow-card p-8 sm:p-10 lg:p-14 w-full max-w-2xl flex flex-col">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-primary text-[11px] font-bold tracking-[0.18em] uppercase mb-8 self-start">
                <Sparkles className="h-3.5 w-3.5" /> Built for Canvas teachers
              </div>
              <h1 className="font-display text-[2.75rem] sm:text-[3.75rem] lg:text-[5.25rem] leading-[0.95] text-primary tracking-tight">
                Standards.<br />
                Mastered.<br />
                Instantly.
              </h1>
              <p className="text-base sm:text-lg text-primary/70 max-w-md mt-8 mb-10">
                One assignment can hit many standards. AI suggests the tags — you confirm in seconds, and every student's growth shows up automatically.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="#how">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="rounded-full px-6 py-6 text-base font-semibold text-primary hover:bg-secondary"
                  >
                    See how it works
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About / lede */}
      <section className="max-w-5xl mx-auto px-6 py-16 lg:py-24 text-center">
        <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-accent mb-5">About</div>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-primary leading-[1.1] mb-6">
          Canvas tracks assignments.<br />We track what students have actually learned.
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          StandardsTrack sits on top of your existing Canvas course. We pull in your assignments and scores, and AI suggests the standards each one covers. You confirm — we never auto-apply — and every student's mastery picture builds itself.
        </p>
      </section>

      {/* How it works / features */}
      <section id="how" className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
        <div className="text-center mb-14">
          <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-accent mb-5">How it works</div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-primary leading-[1.1]">
            Three steps. No spreadsheets.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
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
          ].map((f, i) => (
            <div key={f.title} className="bg-card rounded-[1.75rem] p-8 shadow-soft">
              <div className="text-xs font-code text-muted-foreground tabular-nums mb-4">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-secondary mb-5">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="font-display text-2xl text-primary mb-2">{f.title}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Standards-mastery preview — moved from hero */}
      <section className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 items-center">
          <div>
            <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-accent mb-5">See it in action</div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-primary leading-[1.1] mb-6">
              Every standard.<br />Every student.<br />At a glance.
            </h2>
            <p className="text-muted-foreground text-lg max-w-md">
              Color-coded mastery tells you where to reteach, where to push further, and where students are ready to move on — without you building a single tracker by hand.
            </p>
          </div>
          <div className="bg-card rounded-[2rem] p-8 lg:p-10 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Class mastery — 7th grade math
            </div>
            <div className="space-y-3">
              {[
                { code: "7.RP.A.2", label: "Recognize proportional relationships", val: 0.78 },
                { code: "7.NS.A.1", label: "Add/subtract rational numbers", val: 0.92 },
                { code: "7.EE.B.4", label: "Solve real-world equations", val: 0.54 },
                { code: "7.G.B.6", label: "Solve volume/surface area", val: 0.68 },
                { code: "7.SP.A.1", label: "Random sampling & inference", val: 0.81 },
              ].map((s) => (
                <div key={s.code} className="flex items-center gap-3 text-sm">
                  <div className="w-24 font-code text-xs text-muted-foreground">{s.code}</div>
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
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
        <div className="bg-primary text-primary-foreground rounded-[2.5rem] p-12 lg:p-20 text-center relative overflow-hidden">
          <Workflow className="h-10 w-10 mx-auto text-accent mb-5" />
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-5 leading-[1.05]">
            No more rebuilding<br />in Mastery Connect.
          </h2>
          <p className="text-primary-foreground/75 mb-9 max-w-xl mx-auto text-lg">
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
