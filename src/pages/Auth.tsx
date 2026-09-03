import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { SchoolInput } from "@/components/SchoolInput";
import { cn } from "@/lib/utils";

const signinSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const signupSchema = signinSchema.extend({
  inviteCode: z.string().trim().min(6, "Enter your invitation code").max(40),
  school: z.string().trim().min(2, "Enter your school").max(120),
  role: z.enum(["teacher", "principal"]),
});

export default function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [school, setSchool] = useState("");
  const [role, setRole] = useState<"teacher" | "principal">("teacher");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signinSchema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate("/app", { replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, inviteCode, school, role });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("signup-with-invite", {
      body: {
        code: inviteCode.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password,
        school: school.trim(),
        requestedRole: role,
      },
    });
    if (error || (data as any)?.error) {
      setLoading(false);
      toast.error((data as any)?.error ?? (error as any)?.message ?? "Signup failed");
      return;
    }
    // Sign in with the credentials we just created
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInErr) { toast.error(signInErr.message); return; }
    toast.success(role === "principal" ? "Account created. Principal access is pending admin approval." : "Welcome! Account created.");
    navigate("/app", { replace: true });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    setLoading(false);
    navigate("/app", { replace: true });
  }

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-hero text-primary-foreground">
        <Link to="/" className="font-display text-2xl font-semibold">StandardsTrack</Link>
        <div className="max-w-md">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold leading-tight mb-4">
            Finally see what every student knows.
          </h2>
          <p className="text-primary-foreground/80">
            Connect Canvas, tag assignments to your state's standards (with AI help), and watch mastery
            grow week by week. No more juggling Mastery Connect.
          </p>
        </div>
        <div className="text-sm text-primary-foreground/60">For middle school teachers, by classroom logic.</div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Welcome</CardTitle>
            <CardDescription>Sign in, or create an account with an invitation code.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-pw">Password</Label>
                    <Input id="si-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogle}
                  disabled={loading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                  Continue with Google
                </Button>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-invite">Invitation code</Label>
                    <Input
                      id="su-invite"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX"
                      autoComplete="off"
                      className="font-code tracking-wider"
                    />
                    <p className="text-xs text-muted-foreground">
                      StandardsTrack is invite-only. Ask a current user for a code.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pw">Password</Label>
                    <Input id="su-pw" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-school">School</Label>
                    <SchoolInput id="su-school" value={school} onChange={setSchool} required disableSuggestions />
                  </div>
                  <div className="space-y-2">
                    <Label>I am a…</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["teacher", "principal"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-colors",
                            role === r ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"
                          )}
                        >
                          <div className="capitalize">{r}</div>
                          <div className={cn("text-[11px] font-normal mt-0.5", role === r ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            {r === "teacher" ? "Classes, Canvas sync, library" : "Building-level analytics (admin approval)"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
