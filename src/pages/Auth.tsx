import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const signinSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const signupSchema = signinSchema.extend({
  inviteCode: z.string().trim().min(6, "Enter your invitation code").max(40),
});

export default function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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
    const parsed = signupSchema.safeParse({ email, password, inviteCode });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("signup-with-invite", {
      body: {
        code: inviteCode.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password,
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
    toast.success("Welcome! Account created.");
    navigate("/app", { replace: true });
  }

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-hero text-primary-foreground">
        <Link to="/" className="font-display text-2xl font-semibold">StandardsTrack</Link>
        <div className="max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight mb-4">
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
