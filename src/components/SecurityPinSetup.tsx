// First-login security PIN setup. Required to reveal real student names.
// Auto-shows once per session if the user has no PIN set.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export function SecurityPinSetup() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await supabase.rpc("has_security_pin");
      if (cancelled || error) return;
      if (!data) setOpen(true);
      setChecked(true);
    })();
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (pin.length < 6 || pin.length > 12) {
      toast.error("PIN must be 6–12 characters.");
      return;
    }
    if (pin !== confirm) {
      toast.error("PINs do not match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_security_pin", { _pin: pin });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Security PIN created.");
    setPin(""); setConfirm("");
    setOpen(false);
  }

  if (!checked) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { /* required — cannot dismiss */ if (o) setOpen(true); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Create your security PIN
          </DialogTitle>
          <DialogDescription>
            You'll need this PIN any time you reveal real student names. Choose 6–12 characters.
            It never expires, but an admin can reset it if you forget.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="pin-new">New PIN</Label>
            <Input
              id="pin-new"
              type="password"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              minLength={6}
              maxLength={12}
              placeholder="6–12 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin-confirm">Confirm PIN</Label>
            <Input
              id="pin-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              maxLength={12}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || pin.length < 6}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
